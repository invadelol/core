import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { appKey } from '#config/app'
import riotApiService from '#services/riot/api'
import riotAssets from '#services/riot/assets'
import { normalizePlatform } from '#services/riot/routing'
import summonerService from '#services/summoner_service'
import identityService from '#services/desktop/identity_service'
import deviceService, { isTrusted } from '#services/desktop/device_service'
import { RetryScheduler } from '#services/desktop/retry_scheduler'
import { PLAYER_AUDIT_ONE_IN, oneIn } from '#services/desktop/sampling'
import { hashAddress } from '#services/desktop/tokens'
import {
  AUDIT_WINDOW_MS,
  OBSERVATION_MAX_AGE_MS,
  RANKED_QUEUE_TYPES,
  corroborates,
  implausibleJump,
  judgeSnapshot,
  sameRank,
  snapshotHash,
  validatePlayer,
  type PreviousReport,
  type RiotEntry,
  type StoredRank,
} from '#services/desktop/player_rules'
import { invalidateResponseCache } from '#services/http_response_cache'
import DesktopDevice from '#models/desktop_device'
import DesktopDeviceAccount from '#models/desktop_device_account'
import PlayerObservation, { type ObservationStatus } from '#models/player_observation'
import RiotPuuidAlias from '#models/riot_puuid_alias'
import Summoner from '#models/summoner'
import SummonerHistory from '#models/summoner_history'
import { RiotUpstreamException, riotErrorStatus } from '#utils/riot_errors'
import { SyncGuard } from '#utils/sync_guard'
import type { ObservedMastery, ObservedRank, PlayerBatch, PlayerSnapshot } from '#types/desktop'

export type PlayerStatus = 'applied' | 'staged' | 'unchanged' | 'stale' | 'held' | 'rejected'

export interface PlayerResult {
  rawPuuid: string
  status: PlayerStatus
  code?: string
  message?: string
}

type PartStatus = 'applied' | 'unchanged' | 'stale'

/** Who reported a snapshot, as the trust rules need it. */
interface Reporter {
  device: DesktopDevice
  ipHash: string | null
  links: DesktopDeviceAccount[]
}

/** The most-informative outcome of a snapshot's parts (ranks, profile, mastery). */
function overall(parts: PartStatus[]): 'applied' | 'unchanged' | 'stale' {
  if (parts.includes('applied')) return 'applied'
  if (parts.includes('unchanged') || !parts.length) return 'unchanged'
  return 'stale'
}

function sameMastery(a: ObservedMastery[], b: ObservedMastery[]) {
  const key = (entries: ObservedMastery[]) =>
    JSON.stringify(
      [...entries]
        .sort((x, y) => x.championId - y.championId)
        .map((e) => [e.championId, e.championLevel, e.championPoints, e.lastPlayTime])
    )
  return key(a) === key(b)
}

function supportedPlatform(value: string): string | null {
  try {
    return normalizePlatform(value)
  } catch {
    return null
  }
}

/** A stored report, back in the shape the rules take. */
function snapshotOf(row: PlayerObservation): PlayerSnapshot {
  return {
    rawPuuid: row.rawPuuid,
    gameName: row.gameName,
    tagLine: row.tagLine,
    platform: row.platform,
    profileIconId: row.profileIconId,
    summonerLevel: row.summonerLevel,
    privacy: row.privacy,
    self: row.self,
    context: row.context as PlayerSnapshot['context'],
    observedAt: row.observedAt.toMillis(),
    ranks: row.ranks,
    mastery: row.mastery,
  }
}

function previousOf(row: PlayerObservation | undefined): PreviousReport | null {
  if (!row) return null
  return {
    deviceId: row.deviceId,
    ipHash: row.ipHash,
    gameName: row.gameName,
    tagLine: row.tagLine,
    platform: row.platform,
    observedAt: row.observedAt.toMillis(),
    ranks: row.ranks,
    status: row.status,
  }
}

/**
 * Player snapshots from the desktop app (docs/desktop-sync.md §6).
 *
 * The point is fewer Riot calls: a rank, an icon or a mastery list the
 * League client already showed somebody does not need league-v4 or
 * champion-mastery-v4. So nothing here calls Riot on the way in. A report
 * is mapped to its API PUUID for free (alias, else the stored player with
 * that Riot ID on that platform) or kept `staged` until core learns whose
 * it is; it is applied only when the device is trusted or a second device
 * on another network agrees (linking an account proves nothing), and it
 * never overwrites anything newer, nor anything Riot said
 * later. A sample of what trusted devices report is checked against
 * league-v4 afterwards, and one lie undoes everything the device wrote.
 */
export class PlayerSnapshotService {
  now = () => Date.now()
  sample = () => oneIn(PLAYER_AUDIT_ONE_IN)
  /** One league-v4 read a minute after applying, one more if that failed. */
  audits = new RetryScheduler([60_000, 4 * 60_000])
  private auditGuard = new SyncGuard()
  /** Set while Riot rate limits an audit; audits are skipped until then. */
  private riotCooldownUntil = 0

  async championIds(): Promise<Set<number> | null> {
    try {
      const ids = await riotAssets.ids('champion')
      return ids.length ? new Set(ids.map(Number)) : null
    } catch {
      return null
    }
  }

  /** `POST /api/desktop/players`: one result per player, in the order they were sent. */
  async ingest(
    batch: PlayerBatch,
    context: { device: DesktopDevice; ip: string }
  ): Promise<{ results: PlayerResult[] }> {
    const now = this.now()
    const platform = supportedPlatform(batch.platform)
    const championIds = await this.championIds()
    const ipHash = hashAddress(context.ip, appKey.release())

    const results: PlayerResult[] = []
    const valid: Array<{ index: number; player: PlayerSnapshot }> = []
    batch.players.forEach((input, index) => {
      const verdict = validatePlayer(input, { now, platform, championIds })
      if (verdict.ok) {
        valid.push({ index, player: verdict.player })
        results.push({ rawPuuid: verdict.player.rawPuuid, status: 'staged' })
      } else {
        results.push({
          rawPuuid: String(input.rawPuuid),
          status: 'rejected',
          code: 'E_INVALID_PLAYER',
          message: verdict.reason,
        })
      }
    })
    if (!valid.length) return { results }

    const raws = valid.map(({ player }) => player.rawPuuid)
    const rows = await PlayerObservation.query().whereIn('raw_puuid', raws)
    const stored = new Map(rows.map((row) => [row.rawPuuid, row]))

    // Core holds a newer report of these already: nothing to map or apply.
    const current = valid.filter(({ index, player }) => {
      const previous = stored.get(player.rawPuuid)
      if (previous && previous.observedAt.toMillis() > player.observedAt) {
        results[index].status = 'stale'
        return false
      }
      return true
    })
    if (!current.length) return { results }

    // §3 order, for free: alias, then the stored player with that Riot ID on that platform.
    const identity = await identityService.map(
      platform!,
      current.map(({ player }, i) => ({
        participantId: i,
        rawPuuid: player.rawPuuid,
        gameName: player.gameName,
        tagLine: player.tagLine,
      }))
    )
    const reporter: Reporter = {
      device: context.device,
      ipHash,
      links: await DesktopDeviceAccount.query().where('device_id', context.device.id),
    }

    for (const { index, player } of current) {
      results[index].status = await this.observe(
        player,
        identity.puuids.get(player.rawPuuid) ?? null,
        reporter,
        previousOf(stored.get(player.rawPuuid))
      )
    }
    return { results }
  }

  /** Stores the report as the latest one, then applies it when its player is known. */
  private async observe(
    player: PlayerSnapshot,
    puuid: string | null,
    reporter: Reporter,
    previous: PreviousReport | null
  ): Promise<PlayerStatus> {
    const kept = await this.store(player, reporter)
    // A newer report of the same player landed in between.
    if (!kept) return 'stale'
    if (!puuid) return 'staged'
    return this.settle(player, puuid, reporter, previous)
  }

  /** Newest wins: an older report never replaces a newer one, even under concurrency. */
  private async store(player: PlayerSnapshot, reporter: Reporter): Promise<boolean> {
    const rows = await db
      .knexQuery()
      .table('player_observation')
      .insert({
        raw_puuid: player.rawPuuid,
        game_name: player.gameName,
        tag_line: player.tagLine,
        platform: player.platform,
        profile_icon_id: player.profileIconId,
        summoner_level: player.summonerLevel,
        privacy: player.privacy,
        self: player.self,
        context: player.context,
        ranks: player.ranks === null ? null : JSON.stringify(player.ranks),
        mastery: player.mastery === null ? null : JSON.stringify(player.mastery),
        observed_at: new Date(player.observedAt),
        received_at: new Date(),
        device_id: reporter.device.id,
        ip_hash: reporter.ipHash,
        payload_hash: snapshotHash(player),
        puuid: null,
        applied_at: null,
        status: 'staged',
      })
      .onConflict('raw_puuid')
      .merge()
      .whereRaw('player_observation.observed_at <= excluded.observed_at')
      .returning('raw_puuid')
    return rows.length > 0
  }

  /** Records what became of the stored report, unless a newer one replaced it meanwhile. */
  private async mark(player: PlayerSnapshot, status: ObservationStatus, puuid: string) {
    await db
      .from('player_observation')
      .where('raw_puuid', player.rawPuuid)
      .where('observed_at', new Date(player.observedAt))
      .update({
        status,
        puuid,
        ...(status === 'applied' ? { applied_at: new Date() } : {}),
      })
  }

  /** §6.4: hold what is not trusted or not plausible, apply the rest. */
  private async settle(
    player: PlayerSnapshot,
    puuid: string,
    reporter: Reporter,
    previous: PreviousReport | null
  ): Promise<PlayerStatus> {
    const { device } = reporter
    const own = reporter.links.some(
      (link) => link.puuid === puuid || link.rawPuuid?.toLowerCase() === player.rawPuuid
    )
    const trusted = isTrusted(device)
    const ranks = await this.latestRanks(puuid)

    if (implausibleJump(player.ranks, ranks, player.observedAt)) {
      logger.info({ deviceId: device.id, puuid }, 'desktop player snapshot held: implausible rank')
      await this.mark(player, 'held', puuid)
      return 'held'
    }
    // Linking takes nothing but a Riot ID, so an untrusted device's word on its "own" account
    // counts no more than on anyone else's: held until another network agrees or it is trusted.
    if (
      !trusted &&
      !corroborates(previous, player, { deviceId: device.id, ipHash: reporter.ipHash })
    ) {
      await this.mark(player, 'held', puuid)
      return 'held'
    }

    // Losses are only believed from a trusted device about its own account.
    const snapshot: PlayerSnapshot =
      trusted && own
        ? player
        : { ...player, ranks: player.ranks?.map((rank) => ({ ...rank, losses: null })) ?? null }

    const { status, ranksApplied } = await this.apply(snapshot, puuid, ranks, device.id)
    await this.mark(player, status, puuid)
    if (status !== 'stale') {
      await invalidateResponseCache([`summoner:${puuid}`]).catch((error) =>
        logger.warn({ err: error, puuid }, 'desktop snapshot cache invalidation failed')
      )
    }
    if (trusted && ranksApplied.length && this.sample()) {
      this.audit(puuid, player.platform, player.observedAt, ranksApplied, device.id)
    }
    return status
  }

  /** The newest `riot_rank` row of each queue, any source. */
  private async latestRanks(puuid: string): Promise<Map<string, StoredRank>> {
    const rows = await db
      .from('riot_rank')
      .distinctOn('queue_type')
      .select('queue_type', 'tier', 'division', 'league_points', 'wins', 'losses', 'fetched_at')
      .where('puuid', puuid)
      .orderBy('queue_type')
      .orderBy('fetched_at', 'desc')
    return new Map(
      rows.map((row) => [
        row.queue_type,
        {
          queue: row.queue_type,
          tier: row.tier,
          division: row.division,
          lp: row.league_points === null ? null : Number(row.league_points),
          wins: row.wins === null ? null : Number(row.wins),
          losses: row.losses === null ? null : Number(row.losses),
          fetchedAt: new Date(row.fetched_at).getTime(),
        },
      ])
    )
  }

  /**
   * Writes what is newer than what core holds, part by part (§6.4): ranks
   * per queue, icon and level (and a rename, only through a verified alias),
   * mastery. Unchanged data only moves its freshness.
   */
  private async apply(
    player: PlayerSnapshot,
    puuid: string,
    latest: Map<string, StoredRank>,
    deviceId: string
  ) {
    const parts: PartStatus[] = []
    const ranksApplied: ObservedRank[] = []
    const observedAt = new Date(player.observedAt)

    if (player.ranks) {
      for (const rank of player.ranks) {
        const newest = latest.get(rank.queue)
        if (newest && sameRank(newest, rank)) {
          await this.confirm(puuid, rank.queue, observedAt, deviceId)
          parts.push('unchanged')
        } else if (newest && newest.fetchedAt >= player.observedAt) {
          // Riot (or another report) said something later; it stands.
          parts.push('stale')
        } else {
          await db
            .knexQuery()
            .table('riot_rank')
            .insert({
              puuid,
              queue_type: rank.queue,
              tier: rank.tier,
              division: rank.division,
              league_points: rank.lp,
              wins: rank.wins,
              losses: rank.losses,
              fetched_at: observedAt,
              source: 'desktop',
              device_id: deviceId,
            })
            .onConflict(['puuid', 'queue_type', 'fetched_at'])
            .ignore()
          parts.push('applied')
          ranksApplied.push(rank)
        }
      }
      // A queue the client listed no rank for, and core never saw one in: seen unranked.
      for (const queue of RANKED_QUEUE_TYPES) {
        if (player.ranks.some((rank) => rank.queue === queue) || latest.has(queue)) continue
        await this.confirm(puuid, queue, observedAt, deviceId)
      }
    }

    const profile = await this.applyProfile(player, puuid)
    if (profile) parts.push(profile)

    if (player.mastery) parts.push(await this.applyMastery(player, puuid, deviceId))

    return { status: overall(parts), ranksApplied }
  }

  /** "Seen unchanged at": moves forward only. */
  private async confirm(puuid: string, queue: string, at: Date, deviceId: string) {
    await db
      .knexQuery()
      .table('riot_rank_confirmed')
      .insert({ puuid, queue_type: queue, confirmed_at: at, device_id: deviceId })
      .onConflict(['puuid', 'queue_type'])
      .merge(['confirmed_at', 'device_id'])
      .whereRaw('riot_rank_confirmed.confirmed_at < excluded.confirmed_at')
  }

  /**
   * Icon and level when the report is newer than the last Riot refresh. A
   * different Riot ID is a rename only when match-v5 proved the raw PUUID
   * (a `verified` alias); then it is applied with a history row, as the
   * Riot path does.
   */
  private async applyProfile(player: PlayerSnapshot, puuid: string): Promise<PartStatus | null> {
    const stored = await Summoner.find(puuid)
    if (!stored) return null
    const renamed = stored.gameName !== player.gameName || stored.tagLine !== player.tagLine
    if (player.profileIconId === null && player.summonerLevel === null && !renamed) return null
    if (stored.lastRefreshAt && stored.lastRefreshAt.toMillis() >= player.observedAt) return 'stale'

    const changes: Partial<
      Pick<Summoner, 'gameName' | 'tagLine' | 'profileIconId' | 'summonerLevel'>
    > = {}
    if (player.profileIconId !== null && player.profileIconId !== stored.profileIconId) {
      changes.profileIconId = player.profileIconId
    }
    if (player.summonerLevel !== null && player.summonerLevel !== stored.summonerLevel) {
      changes.summonerLevel = player.summonerLevel
    }
    if (renamed) {
      const alias = await RiotPuuidAlias.find(player.rawPuuid)
      if (alias?.status === 'verified' && alias.puuid === puuid) {
        changes.gameName = player.gameName
        changes.tagLine = player.tagLine
      }
    }
    if (!Object.keys(changes).length) return 'unchanged'

    stored.merge(changes)
    try {
      await stored.save()
    } catch (error) {
      // Someone else holds that Riot ID in our table (an old row of a name
      // that changed hands): keep the rename for Riot to settle.
      if ((error as { code?: string }).code !== '23505' || !changes.gameName) throw error
      const rest = { ...changes }
      delete rest.gameName
      delete rest.tagLine
      await stored.refresh()
      if (!Object.keys(rest).length) return 'unchanged'
      stored.merge(rest)
      await stored.save()
      delete changes.gameName
    }
    if (changes.gameName || changes.profileIconId !== undefined) {
      await SummonerHistory.create({
        puuid,
        gameName: stored.gameName,
        tagLine: stored.tagLine,
        profileIconId: stored.profileIconId,
      })
    }
    return 'applied'
  }

  /** Newest wins, whichever source the stored list came from. */
  private async applyMastery(
    player: PlayerSnapshot,
    puuid: string,
    deviceId: string
  ): Promise<PartStatus> {
    const existing = await db
      .from('player_mastery')
      .select('entries', 'observed_at')
      .where('puuid', puuid)
      .first()
    if (existing && new Date(existing.observed_at).getTime() >= player.observedAt) return 'stale'

    await db
      .knexQuery()
      .table('player_mastery')
      .insert({
        puuid,
        entries: JSON.stringify(player.mastery),
        observed_at: new Date(player.observedAt),
        source: 'desktop',
        device_id: deviceId,
      })
      .onConflict('puuid')
      .merge(['entries', 'observed_at', 'source', 'device_id'])
      .whereRaw('player_mastery.observed_at < excluded.observed_at')
    return existing && sameMastery(existing.entries, player.mastery!) ? 'unchanged' : 'applied'
  }

  /**
   * Core just learned whose these Riot IDs are (§6.3): apply their staged
   * reports while they are recent. One probe of a partial index that only
   * holds staged rows.
   */
  async applyStagedByRiotId(
    players: Array<{ gameName: string; tagLine: string; platform: string }>
  ) {
    const since = new Date(this.now() - OBSERVATION_MAX_AGE_MS)
    const rows = await PlayerObservation.query()
      .where('status', 'staged')
      .where('observed_at', '>', since)
      .where((query) => {
        for (const p of players) {
          query.orWhere((pair) =>
            pair
              .where('game_name', p.gameName)
              .where('tag_line', p.tagLine)
              .where('platform', p.platform)
          )
        }
      })
    for (const row of rows) await this.applyStaged(row)
  }

  /** match-v5 proved these raw PUUIDs (§6.3). */
  async applyStagedByRawPuuid(rawPuuids: string[]) {
    const since = new Date(this.now() - OBSERVATION_MAX_AGE_MS)
    const rows = await PlayerObservation.query()
      .where('status', 'staged')
      .where('observed_at', '>', since)
      .whereIn(
        'raw_puuid',
        rawPuuids.map((raw) => raw.toLowerCase())
      )
    for (const row of rows) await this.applyStaged(row)
  }

  /** Maps a staged report now that its player is known (recording the alias), then settles it. */
  private async applyStaged(row: PlayerObservation) {
    const device = row.deviceId ? await DesktopDevice.find(row.deviceId) : null
    // A device revoked since then no longer speaks for anyone.
    if (!device || device.revokedAt) return
    const identity = await identityService.map(row.platform, [
      { participantId: 0, rawPuuid: row.rawPuuid, gameName: row.gameName, tagLine: row.tagLine },
    ])
    const puuid = identity.puuids.get(row.rawPuuid)
    if (!puuid) return
    const links = await DesktopDeviceAccount.query().where('device_id', device.id)
    await this.settle(snapshotOf(row), puuid, { device, ipHash: row.ipHash, links }, null)
  }

  /** The newest report of the player that is on the web profile (§6.5 `lastObservedAt`). */
  async lastObservedAt(puuid: string): Promise<DateTime | null> {
    const row = await db
      .from('player_observation')
      .where('puuid', puuid)
      .whereIn('status', ['applied', 'unchanged'])
      .max('observed_at as at')
      .first()
    return row?.at ? DateTime.fromJSDate(new Date(row.at)) : null
  }

  /**
   * Continuous verification (§1.2): one league-v4 read of a sampled applied
   * snapshot from a trusted device, while it can still be judged (within
   * ten minutes of the observation). Best effort: skipped while Riot rate
   * limits, never retried past the window. Riot's answer is stored like any
   * league-v4 read, so the call is not wasted.
   */
  audit(
    puuid: string,
    platform: string,
    observedAt: number,
    ranks: ObservedRank[],
    deviceId: string
  ) {
    this.audits.schedule(`player:${puuid}:${observedAt}`, async () => {
      const now = this.now()
      if (now - observedAt > AUDIT_WINDOW_MS || now < this.riotCooldownUntil) return 'done'

      let entries: RiotEntry[]
      try {
        entries = await this.auditGuard.run(`audit:${puuid}`, () =>
          riotApiService.client.league.getEntriesByPUUID({ region: platform as any, puuid })
        )
      } catch (error) {
        const rateLimited =
          (error instanceof RiotUpstreamException && error.code === 'E_RIOT_RATE_LIMITED') ||
          riotErrorStatus(error) === 429
        if (rateLimited) {
          const retryAfter = (error as { retryAfter?: number }).retryAfter ?? 60
          this.riotCooldownUntil = now + retryAfter * 1000
          return 'done'
        }
        const status = riotErrorStatus(error)
        return status !== null && status >= 500 ? 'retry' : 'done'
      }

      await summonerService
        .storeRanks(puuid, entries)
        .catch((error) => logger.warn({ err: error, puuid }, 'audited ranks not stored'))
      const verdict = judgeSnapshot(ranks, entries, { observedAt, checkedAt: this.now() })
      if (verdict.verdict === 'mismatch') {
        await deviceService.mismatch(deviceId, `player:${puuid}`, verdict.differences)
      }
      return 'done'
    })
  }
}

export default new PlayerSnapshotService()
