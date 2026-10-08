import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import { appKey } from '#config/app'
import riotApiService, { type RiotAPITypes } from '#services/riot/api'
import riotAssets from '#services/riot/assets'
import ingestionService from '#services/analytics/ingestion_service'
import matchRepository from '#services/analytics/match_repository'
import matchesService from '#services/matches_service'
import summonerService from '#services/summoner_service'
import matchSourceService from '#services/match_source_service'
import { invalidateResponseCache } from '#services/http_response_cache'
import identityService, {
  type IdentityInput,
  type IdentityResolution,
} from '#services/desktop/identity_service'
import deviceService, { isTrusted, profileUrl } from '#services/desktop/device_service'
import lpService from '#services/desktop/lp_service'
import { RetryScheduler } from '#services/desktop/retry_scheduler'
import { MATCH_AUDIT_ONE_IN, oneIn } from '#services/desktop/sampling'
import { validateStructure } from '#services/desktop/match_validation'
import { hashAddress } from '#services/desktop/tokens'
import * as snapshotHooks from '#services/desktop/snapshot_hooks'
import {
  canonicalHash,
  compareFacts,
  completenessOf,
  riotCompleteness,
  riotFacts,
  timelineFits,
  toMatchDto,
  toTimelineDto,
  uploadFacts,
  type GameFacts,
} from '#services/desktop/conversion'
import { DesktopException } from '#exceptions/desktop_exception'
import DesktopDevice from '#models/desktop_device'
import DesktopDeviceAccount from '#models/desktop_device_account'
import DesktopMatchUpload, { type LpStatus, type UploadStatus } from '#models/desktop_match_upload'
import type MatchSource from '#models/match_source'
import Summoner from '#models/summoner'
import { RiotUpstreamException, riotErrorStatus } from '#utils/riot_errors'
import type { MatchUpload } from '#types/desktop'

type MatchDTO = RiotAPITypes.MatchV5.MatchDTO

export type PublicStatus = 'stored' | 'duplicate' | 'verified' | 'deferred'

export interface UploadResult {
  matchId: string
  status: PublicStatus
  lp: LpStatus
  url: string
}

interface Upload {
  payload: MatchUpload
  device: DesktopDevice
  link: DesktopDeviceAccount
  platform: string
  record: Pick<DesktopMatchUpload, 'payloadHash' | 'ipHash'>
}

/** What happened to a game, and whether its LP report may be stored. */
interface Outcome {
  status: PublicStatus
  lp: boolean
}

export function identitiesOf(upload: MatchUpload): IdentityInput[] {
  return upload.game.participantIdentities.map((identity) => ({
    participantId: identity.participantId,
    rawPuuid: identity.player.puuid.toLowerCase(),
    gameName: identity.player.gameName,
    tagLine: identity.player.tagLine,
  }))
}

/**
 * Riot not having the game yet (404), or not answering right now: neither
 * says anything about the upload, so the game waits instead of failing.
 */
export function isRetriable(error: unknown) {
  if (error instanceof RiotUpstreamException) return true
  const status = riotErrorStatus(error)
  return status === 404 || status === 429 || (status !== null && status >= 500)
}

/**
 * The upload pipeline (docs/desktop-sync.md §4).
 *
 * Its whole point is to remove match-v5 calls, so the Riot budget decides
 * the shape: a game already stored costs nothing; a trusted device's game
 * costs nothing; anything else costs exactly one `getMatchById`, whose
 * answer is then used for everything at once — publishing the game, judging
 * the device, and learning every participant's identity. A game Riot has not
 * published yet waits in-process and costs at most three more.
 */
export class PublicationService {
  retries = new RetryScheduler()

  /** One upload in ten from a trusted device is still checked against match-v5. */
  sample = () => oneIn(MATCH_AUDIT_ONE_IN)
  now = () => Date.now()

  /** Concurrent uploads of one game run one after the other in this process. */
  private chains = new Map<string, Promise<unknown>>()

  /**
   * Champion ids from the asset proxy's Community Dragon manifest, which the
   * website already caches for names and icons. Null when unavailable: the
   * structural check then falls back to the id range.
   */
  async championIds(): Promise<Set<number> | null> {
    try {
      const ids = await riotAssets.ids('champion')
      return ids.length ? new Set(ids.map(Number)) : null
    } catch {
      return null
    }
  }

  enabled() {
    return env.get('DESKTOP_UPLOADS_ENABLED', true)
  }

  async upload(payload: MatchUpload, context: { device: DesktopDevice; ip: string }) {
    if (!this.enabled()) throw DesktopException.paused('uploads')

    const problem = validateStructure(payload, {
      now: this.now(),
      championIds: await this.championIds(),
    })
    if (problem) throw DesktopException.invalidMatch(problem)

    const platform = payload.game.platformId
    const raw = payload.uploader.toLowerCase()
    let link = await deviceService.uploaderLink(context.device.id, raw)
    if (!link) {
      // Linked by Riot ID only: the uploader's own identity is the bridge.
      const identity = identitiesOf(payload).find((entry) => entry.rawPuuid === raw)!
      const mapped = await identityService.map(platform, [identity])
      link = await deviceService.uploaderLink(context.device.id, raw, mapped.puuids.get(raw))
    }
    if (!link) throw DesktopException.notLinked()

    const uploader = await Summoner.find(link.puuid)
    if (link.platform !== platform && uploader?.platform !== platform) {
      throw DesktopException.invalidMatch(`the linked account does not play on ${platform}`)
    }

    const url = `${profileUrl(uploader?.gameName ?? '', uploader?.tagLine ?? '')}/match/${payload.matchId}`
    const ipHash = hashAddress(context.ip, appKey.release())
    return this.serialize(payload.matchId, () =>
      this.publish(payload, { device: context.device, link, platform, ipHash, url })
    )
  }

  private async serialize<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.chains.get(key) ?? Promise.resolve()
    const next = previous.catch(() => {}).then(task)
    const tail = next.catch(() => {})
    this.chains.set(key, tail)
    void tail.then(() => {
      if (this.chains.get(key) === tail) this.chains.delete(key)
    })
    return next
  }

  private async publish(
    payload: MatchUpload,
    context: {
      device: DesktopDevice
      link: DesktopDeviceAccount
      platform: string
      ipHash: string
      url: string
    }
  ): Promise<UploadResult> {
    const { matchId } = payload
    const { device, link, url } = context

    // The same device sending the same game again changes nothing.
    const previous = await DesktopMatchUpload.query()
      .where('match_id', matchId)
      .where('device_id', device.id)
      .first()
    if (previous) return { matchId, status: 'duplicate', lp: previous.lpStatus, url }

    let record: DesktopMatchUpload
    try {
      record = await DesktopMatchUpload.create({
        matchId,
        deviceId: device.id,
        uploaderPuuid: link.puuid,
        uploaderRawPuuid: payload.uploader.toLowerCase(),
        payloadHash: canonicalHash(payload),
        status: 'processing',
        lpStatus: 'none',
        ipHash: context.ipHash,
        app: payload.app,
      })
    } catch (error) {
      // Another server process took the same re-send first.
      if ((error as { code?: string }).code === '23505') {
        return { matchId, status: 'duplicate', lp: 'none', url }
      }
      throw error
    }

    try {
      const upload: Upload = { payload, device, link, platform: context.platform, record }
      const outcome = await this.decide(upload)
      const lp: LpStatus = outcome.lp
        ? await lpService.record(payload, { matchId, puuid: link.puuid, deviceId: device.id })
        : payload.lp
          ? 'rejected'
          : 'none'
      await this.finish(matchId, device.id, outcome.status, lp)
      await this.invalidate([`summoner:${link.puuid}`], matchId)
      return { matchId, status: outcome.status, lp, url }
    } catch (error) {
      // Leave nothing behind, so the app's retry is processed from scratch.
      await record.delete().catch(() => {})
      throw error
    }
  }

  /** Keyed by game and device, so a deferred retry finds the row even if the app re-sent it. */
  private async finish(matchId: string, deviceId: string, status: UploadStatus, lp?: LpStatus) {
    await db
      .from('desktop_match_upload')
      .where('match_id', matchId)
      .where('device_id', deviceId)
      .update({
        status,
        ...(lp ? { lp_status: lp } : {}),
        processed_at: new Date(),
      })
  }

  /** §4.2, in order: already stored, trusted and fully mapped, or ask Riot once. */
  private async decide(upload: Upload): Promise<Outcome> {
    const { matchId } = upload.payload
    const source = await matchSourceService.find(matchId)
    if (source || (await this.inClickhouse(matchId))) return this.duplicate(upload, source)

    const resolution = await identityService.map(upload.platform, identitiesOf(upload.payload))
    if (isTrusted(upload.device) && resolution.unmapped.length === 0) {
      if (await this.ingestDesktop(upload, resolution)) {
        if (this.sample()) this.audit(upload.payload.matchId, upload.platform)
        return { status: 'stored', lp: true }
      }
      return this.duplicate(upload, await matchSourceService.find(matchId))
    }

    return this.fromRiot(upload, { defer: true })
  }

  private async inClickhouse(matchId: string) {
    const existing = await matchRepository.getExistingIds([matchId])
    return existing.has(matchId)
  }

  private cluster(platform: string) {
    return riotApiService.platformToRegion(platform)
  }

  /** The one match-v5 call of the Riot path. */
  private async fromRiot(upload: Upload, options: { defer: boolean }): Promise<Outcome> {
    let match: MatchDTO
    try {
      match = await riotApiService.client.matchV5.getMatchById({
        matchId: upload.payload.matchId,
        cluster: this.cluster(upload.platform),
      })
    } catch (error) {
      if (!isRetriable(error)) throw error
      if (options.defer) this.defer(upload)
      return { status: 'deferred', lp: true }
    }
    return this.applyRiot(upload, match)
  }

  /**
   * Riot's game, used for everything: judging the device, learning every
   * participant's identity, and publishing — Riot's data, not the upload.
   */
  private async applyRiot(upload: Upload, match: MatchDTO): Promise<Outcome> {
    const { payload, device } = upload
    const differences = compareFacts(uploadFacts(payload), riotFacts(match.info))
    const agrees = differences.length === 0

    if (agrees) {
      const aliases = verifiedAliases(payload, match.info)
      await identityService.learnVerified(aliases)
      // Snapshots of these players may have been waiting for exactly this (§6.3).
      snapshotHooks.aliasesVerified(aliases.map((alias) => alias.rawPuuid))
      await deviceService.verified(device.id)
    } else {
      await deviceService.mismatch(device.id, payload.matchId, differences)
      // An LP report stored while the game was deferred came from the same lie.
      await db
        .from('lp_change')
        .where('match_id', payload.matchId)
        .where('device_id', device.id)
        .update({ status: 'conflict' })
    }

    const stored = await this.ingestRiot(upload, match, agrees)
    return { status: stored ? 'verified' : 'duplicate', lp: agrees }
  }

  private async ingestRiot(upload: Upload, match: MatchDTO, trustTimeline: boolean) {
    const { payload, device } = upload
    const { matchId } = payload
    const claimed = await matchSourceService.claim(matchId, {
      source: 'riot',
      verification: 'verified',
      completeness: riotCompleteness(true),
      firstDeviceId: device.id,
    })
    // Somebody else holds the lock, or a writer from before the lock stored it.
    if (!claimed || (await this.inClickhouse(matchId))) return false

    let meta: { platform: string; gameStartMs: number }
    try {
      meta = await ingestionService.ingestMatch(matchId, match)
    } catch (error) {
      await matchSourceService.release(matchId).catch(() => {})
      throw error
    }
    await this.archive(matchId, match)

    // The client's timeline saves the timeline call whenever it lines up with Riot's players.
    const ownTimeline =
      trustTimeline &&
      Boolean(payload.timeline?.frames?.length) &&
      timelineFits(payload, match.info)
    try {
      const timeline = ownTimeline
        ? toTimelineDto(
            payload.timeline!,
            matchId,
            payload.game.gameId,
            match.info.participants.map((p) => ({ participantId: p.participantId, puuid: p.puuid }))
          )
        : await riotApiService.client.matchV5.getMatchTimelineById({
            matchId,
            cluster: this.cluster(upload.platform),
          })
      await ingestionService.ingestTimeline(matchId, match, timeline, meta)
    } catch (error) {
      logger.warn({ err: error, matchId }, 'desktop upload stored without a timeline')
      await matchSourceService.update(matchId, { completeness: riotCompleteness(false) })
    }

    // Riot named everyone in the game; remembering them is free.
    await summonerService
      .upsertFromParticipants(
        match.info.participants.map((p) => ({
          puuid: p.puuid,
          gameName: (p as { riotIdGameName?: string }).riotIdGameName ?? '',
          tagLine: p.riotIdTagline,
          profileIconId: p.profileIcon,
          summonerLevel: p.summonerLevel,
        })),
        meta.platform
      )
      .catch((error) => logger.warn({ err: error, matchId }, 'participant upsert failed'))

    await this.invalidate(
      match.info.participants.map((p) => `summoner:${p.puuid}`),
      matchId
    )
    return true
  }

  /** A trusted device's game, published as the client reported it. */
  private async ingestDesktop(upload: Upload, resolution: IdentityResolution) {
    const { payload, device } = upload
    const { matchId } = payload
    const completeness = completenessOf(payload)
    const claimed = await matchSourceService.claim(matchId, {
      source: 'desktop',
      verification: 'unverified',
      completeness,
      firstDeviceId: device.id,
    })
    if (!claimed) return false

    const match = toMatchDto(payload, resolution.puuids)
    let meta: { platform: string; gameStartMs: number }
    try {
      meta = await ingestionService.ingestMatch(matchId, match)
    } catch (error) {
      await matchSourceService.release(matchId).catch(() => {})
      throw error
    }

    if (completeness.timeline) {
      try {
        const participants = match.info.participants.map((p) => ({
          participantId: p.participantId,
          puuid: p.puuid,
        }))
        await ingestionService.ingestTimeline(
          matchId,
          match,
          toTimelineDto(payload.timeline!, matchId, payload.game.gameId, participants),
          meta
        )
      } catch (error) {
        logger.warn({ err: error, matchId }, 'desktop timeline not stored')
        await matchSourceService.update(matchId, {
          completeness: { ...completeness, timeline: false },
        })
      }
    }

    await this.invalidate(
      [...resolution.puuids.values()].map((puuid) => `summoner:${puuid}`),
      matchId
    )
    return true
  }

  /**
   * The game is stored already. Riot's data (or data Riot confirmed) judges
   * the upload for free; a desktop-only game is compared with its first upload:
   * a second device from another address that agrees corroborates it, one
   * that disagrees puts it in conflict until Riot settles it.
   */
  private async duplicate(upload: Upload, source: MatchSource | null): Promise<Outcome> {
    const { payload, device, record } = upload
    const { matchId } = payload

    if (!source || source.verification === 'verified') {
      const stored = await matchRepository.getFacts(matchId)
      if (!stored) return { status: 'duplicate', lp: true }
      const differences = compareFacts(uploadFacts(payload), {
        duration: stored.duration,
        arena: stored.mapId === 30,
        players: stored.players,
      })
      if (differences.length) {
        await deviceService.mismatch(device.id, matchId, differences)
        return { status: 'duplicate', lp: false }
      }
      await deviceService.verified(device.id)
      return { status: 'duplicate', lp: true }
    }

    const first = source.firstDeviceId
      ? await DesktopMatchUpload.query()
          .where('match_id', matchId)
          .where('device_id', source.firstDeviceId)
          .first()
      : null
    if (!first || first.deviceId === device.id) return { status: 'duplicate', lp: true }

    if (first.payloadHash === record.payloadHash) {
      if (first.ipHash !== record.ipHash) {
        await matchSourceService.update(matchId, { verification: 'corroborated' }, ['unverified'])
        await this.invalidate([], matchId)
      }
      return { status: 'duplicate', lp: true }
    }

    await matchSourceService.update(matchId, { verification: 'conflict' }, [
      'unverified',
      'corroborated',
    ])
    await this.invalidate([], matchId)
    this.audit(matchId, upload.platform, [{ deviceId: device.id, facts: uploadFacts(payload) }])
    return { status: 'duplicate', lp: false }
  }

  /**
   * Riot has not published the game: answer `deferred` and try again in
   * 2, 5 and 15 minutes. Past that the web sync picks the game up.
   */
  private defer(upload: Upload) {
    const { matchId } = upload.payload
    this.retries.schedule(
      `publish:${matchId}:${upload.device.id}`,
      () =>
        this.serialize(matchId, async () => {
          const source = await matchSourceService.find(matchId)
          let outcome: Outcome
          if (source || (await this.inClickhouse(matchId))) {
            outcome = await this.duplicate(upload, source)
          } else {
            outcome = await this.fromRiot(upload, { defer: false })
            if (outcome.status === 'deferred') return 'retry'
          }
          await this.finish(matchId, upload.device.id, outcome.status)
          return 'done'
        }),
      () => this.finish(matchId, upload.device.id, 'expired')
    )
  }

  /**
   * Checks a stored desktop game against match-v5 after the fact: one upload
   * in ten from trusted devices, and every game two devices disagree on.
   * The stored rows and any other reports are judged by the same answer.
   */
  private audit(
    matchId: string,
    platform: string,
    others: Array<{ deviceId: string; facts: GameFacts }> = []
  ) {
    this.retries.schedule(`audit:${matchId}`, async () => {
      let match: MatchDTO
      try {
        match = await riotApiService.client.matchV5.getMatchById({
          matchId,
          cluster: this.cluster(platform),
        })
      } catch (error) {
        if (isRetriable(error)) return 'retry'
        throw error
      }
      const riot = riotFacts(match.info)
      const [source, stored] = await Promise.all([
        matchSourceService.find(matchId),
        matchRepository.getFacts(matchId),
      ])
      if (source?.firstDeviceId && stored) {
        const differences = compareFacts(
          { duration: stored.duration, arena: stored.mapId === 30, players: stored.players },
          riot
        )
        if (differences.length) {
          await matchSourceService.update(matchId, { verification: 'conflict' })
          await deviceService.mismatch(source.firstDeviceId, matchId, differences)
        } else {
          await matchSourceService.update(matchId, { verification: 'verified' })
          await deviceService.verified(source.firstDeviceId)
        }
      }
      for (const other of others) {
        const differences = compareFacts(other.facts, riot)
        if (differences.length) await deviceService.mismatch(other.deviceId, matchId, differences)
        else await deviceService.verified(other.deviceId)
      }
      await this.invalidate([], matchId)
      return 'done'
    })
  }

  /** Riot's JSON goes to the same archive as the web sync's, when storage is reachable. */
  async archive(matchId: string, match: MatchDTO) {
    await matchesService
      .archive(matchId, match)
      .catch((error) => logger.warn({ err: error, matchId }, 'match archive failed'))
  }

  private async invalidate(resources: string[], matchId: string) {
    await invalidateResponseCache([`match:${matchId}`, ...resources]).catch((error) =>
      logger.warn({ err: error, matchId }, 'desktop cache invalidation failed')
    )
  }
}

/**
 * Participants whose slot in Riot's game matches the client's on Riot ID and
 * champion: their raw PUUID is now proven to be that API PUUID.
 */
export function verifiedAliases(upload: MatchUpload, info: RiotAPITypes.MatchV5.MatchInfoDTO) {
  const riot = new Map((info.participants ?? []).map((p) => [p.participantId, p]))
  const identities = new Map(upload.game.participantIdentities.map((i) => [i.participantId, i]))
  const same = (a: unknown, b: unknown) =>
    typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase()

  return upload.game.participants.flatMap((participant) => {
    const theirs = riot.get(participant.participantId)
    const identity = identities.get(participant.participantId)
    if (!theirs?.puuid || !identity) return []
    const gameName = (theirs as { riotIdGameName?: string }).riotIdGameName
    if (
      theirs.championId !== participant.championId ||
      !same(gameName, identity.player.gameName) ||
      !same(theirs.riotIdTagline, identity.player.tagLine)
    ) {
      return []
    }
    return [
      {
        rawPuuid: identity.player.puuid.toLowerCase(),
        puuid: theirs.puuid,
        gameName: identity.player.gameName,
        tagLine: identity.player.tagLine,
      },
    ]
  })
}

export default new PublicationService()
