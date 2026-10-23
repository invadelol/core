import riotApiService, { type RiotAPITypes } from '#services/riot/api'
import matchRepository from '#services/analytics/match_repository'
import ingestionService from '#services/analytics/ingestion_service'
import SummonerUpdated from '#events/summoner_updated'
import Summoner from '#models/summoner'
import compressionService from '#services/compression_service'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import { invalidateResponseCache } from '#services/http_response_cache'
import type { PlatformId } from '@fightmegg/riot-api'
import { DEFAULT_MATCH_COUNT } from '#config/constants'
import { SyncGuard } from '#utils/sync_guard'
import { platformFromMatchId, toInt } from '#utils/clickhouse'
import matchSourceService from '#services/match_source_service'
import { riotCompleteness } from '#services/desktop/conversion'
import { isExcludedQueue } from '#constants/riot'

type MatchCluster = Exclude<RiotAPITypes.Cluster, PlatformId.ESPORTS>

/** A match whose events could not be fetched is not asked for again before this. */
const BACKFILL_RETRY_MS = 10 * 60 * 1000

/** How many skipped match ids (Brawl, League Classic) are remembered, so they are not fetched again. */
const EXCLUDED_MEMORY = 5000

class MatchesService {
  private updates = new SyncGuard()
  private olders = new SyncGuard()
  private matches = new SyncGuard()
  private backfills = new SyncGuard()
  private backfillFailures = new Map<string, number>()
  /** Games of an excluded queue seen on match-v5: never stored, and not asked for again. */
  private excluded = new Set<string>()

  /** The ids worth fetching: neither stored nor known to be of an excluded queue. */
  private async unseen(matchIds: string[]) {
    const existing = await matchRepository.getExistingIds(matchIds)
    return matchIds.filter((id) => !existing.has(id) && !this.excluded.has(id))
  }

  async update(puuid: string, cluster: MatchCluster) {
    return this.updates.run(`${cluster}:${puuid}`, () => this.updatePlayer(puuid, cluster))
  }

  private async updatePlayer(puuid: string, cluster: MatchCluster) {
    const matchIds = await riotApiService.client.matchV5.getIdsByPuuid({
      puuid,
      cluster,
      params: {
        count: DEFAULT_MATCH_COUNT,
      },
    })

    if (!matchIds.length) {
      return []
    }

    const newIds = await this.unseen(matchIds)

    if (!newIds.length) {
      return []
    }

    const fetched = await Promise.all(
      newIds.map((matchId) => this.fetchAndStoreMatch(matchId, cluster))
    )
    const results = fetched.filter((result) => result !== null)

    const summoner = await Summoner.find(puuid)
    if (summoner) {
      void SummonerUpdated.dispatch(puuid, summoner.platform).catch((error) =>
        logger.warn({ err: error, puuid }, 'Post-sync summoner listener failed')
      )
    }

    return results
  }

  /**
   * The games of `puuid` that started before `before` (epoch ms) and are not stored yet: one
   * match-v5 ids page of `count` from Riot, each new game fetched and stored. Returns how many
   * were stored; none for a player this server never resolved. The caller paces it (`MatchPager`).
   */
  async older(puuid: string, before: number, count: number) {
    return this.olders.run(`${puuid}:${before}:${count}`, async () => {
      const summoner = await Summoner.find(puuid)
      if (!summoner) return 0
      const cluster = riotApiService.platformToRegion(summoner.platform) as MatchCluster
      const matchIds = await riotApiService.client.matchV5.getIdsByPuuid({
        puuid,
        cluster,
        params: { count, endTime: Math.ceil(before / 1000) },
      })
      if (!matchIds.length) return 0
      const newIds = await this.unseen(matchIds)
      const stored = await Promise.all(
        newIds.map((matchId) => this.fetchAndStoreMatch(matchId, cluster))
      )
      return stored.filter((result) => result !== null).length
    })
  }

  /**
   * What a stored match lacks of its timeline, fetched once now that someone looks: the kills
   * and objectives of a match stored before they were kept, or the whole timeline of one whose
   * timeline could not be stored with it. A failed attempt is not retried for a while, so a page
   * opened repeatedly never turns into a stream of Riot calls. Returns whether anything was stored.
   */
  async backfillTimeline(
    match: {
      matchId: string
      platform: string
      gameStartMs: number
      participants: Array<{ puuid: string; teamId: number }>
    },
    missing: { frames: boolean; events: boolean }
  ) {
    const last = this.backfillFailures.get(match.matchId)
    if (last && Date.now() - last < BACKFILL_RETRY_MS) return false
    if (this.backfillFailures.size > 5000) this.backfillFailures.clear()
    const run = async () => {
      try {
        const cluster = riotApiService.platformToRegion(match.platform) as MatchCluster
        const timeline = await riotApiService.client.matchV5.getMatchTimelineById({
          matchId: match.matchId,
          cluster,
        })
        let stored = 0
        if (missing.frames) {
          // Frames are numbered by the game's players: read from the archived game, so only a
          // game stored before the archive costs a second Riot call. The players' skill orders
          // stay empty (they live on participant rows, never rewritten): its page shows none.
          const matchData =
            (await this.archived(match.matchId)) ??
            (await riotApiService.client.matchV5.getMatchById({ matchId: match.matchId, cluster }))
          const frames = await ingestionService.ingestFrames(
            match.matchId,
            match.platform,
            match.gameStartMs,
            matchData.info,
            timeline
          )
          if (frames) {
            await matchSourceService
              .update(match.matchId, { completeness: riotCompleteness(true) })
              .catch(() => {})
          }
          stored += frames
        }
        if (missing.events) {
          const teamByPuuid = new Map(match.participants.map((p) => [p.puuid, p.teamId]))
          const teamOf = new Map<number, number>()
          for (const p of timeline.info?.participants ?? []) {
            const team = teamByPuuid.get(p.puuid)
            if (team) teamOf.set(p.participantId, team)
          }
          stored += await ingestionService.ingestEvents(
            match.matchId,
            match.platform,
            match.gameStartMs,
            timeline,
            teamOf
          )
        }
        if (!stored) {
          // Riot has nothing more for it either: not asked again before the retry window.
          this.backfillFailures.set(match.matchId, Date.now())
          return false
        }
        await invalidateResponseCache([`match:${match.matchId}`]).catch(() => {})
        return true
      } catch (error) {
        this.backfillFailures.set(match.matchId, Date.now())
        logger.warn({ err: error, matchId: match.matchId }, 'match timeline backfill failed')
        return false
      }
    }
    // The guard itself throws while Riot rate-limits us: the page opens without a timeline.
    return this.backfills.run(match.matchId, run).catch(() => false)
  }

  async fetchAndStoreMatch(matchId: string, cluster: MatchCluster) {
    return this.matches.run(`${cluster}:${matchId}`, () => this.storeMatch(matchId, cluster))
  }

  private async storeMatch(matchId: string, cluster: MatchCluster) {
    // The timeline is asked for only once the match is in. Asked for alongside it, a timeline
    // (megabytes once parsed) that comes back first sits in memory until its match does, and
    // while the Riot key is spent those two queues drift apart by minutes and hundreds of games.
    const matchData = await riotApiService.client.matchV5.getMatchById({ matchId, cluster })

    // Brawl and League Classic are never stored, not even archived (EXCLUDED_QUEUE_IDS).
    if (isExcludedQueue(matchData.info?.queueId)) {
      if (this.excluded.size >= EXCLUDED_MEMORY) this.excluded.clear()
      this.excluded.add(matchId)
      return null
    }

    await this.archive(matchId, matchData)

    // The desktop app may be publishing this very game. Only the writer that
    // claims the match ingests it; the other one would duplicate every row.
    const claimed = await matchSourceService.claim(matchId, {
      source: 'riot',
      verification: 'verified',
      completeness: riotCompleteness(true),
    })
    if (!claimed) {
      const info = matchData.info
      return {
        matchId,
        platform:
          (typeof info.platformId === 'string' && info.platformId) || platformFromMatchId(matchId),
        gameStartMs: toInt(info.gameStartTimestamp ?? info.gameCreation ?? 0, 0),
      }
    }

    // The timeline comes before the game is written: its players' skill orders are stored on
    // their participant rows, which are never rewritten. A game whose timeline fails is still
    // stored, without one: the next sync would skip it, and the whole sync must not fail over one
    // game. The match page fetches the timeline again when someone opens it.
    let timeline: RiotAPITypes.MatchV5.MatchTimelineDTO | null = null
    try {
      timeline = await riotApiService.client.matchV5.getMatchTimelineById({ matchId, cluster })
    } catch (error) {
      logger.warn({ err: error, matchId }, 'match stored without a timeline')
    }

    let meta: Awaited<ReturnType<typeof ingestionService.ingestMatch>>
    try {
      meta = await ingestionService.ingestMatch(matchId, matchData, timeline)
    } catch (error) {
      await matchSourceService.release(matchId).catch(() => {})
      throw error
    }

    let stored = false
    if (timeline) {
      try {
        await ingestionService.ingestTimeline(matchId, matchData, timeline, meta)
        stored = true
      } catch (error) {
        logger.warn({ err: error, matchId }, 'match stored without a timeline')
      }
    }
    if (!stored) {
      await matchSourceService
        .update(matchId, { completeness: riotCompleteness(false) })
        .catch(() => {})
    }
    // All participants' cached analytics changed, including players whose own
    // profile wasn't the one that triggered this sync. Invalidate before replying.
    await invalidateResponseCache([
      `match:${matchId}`,
      ...matchData.info.participants.filter((p) => p.puuid).map((p) => `summoner:${p.puuid}`),
    ]).catch((error) => logger.warn({ err: error, matchId }, 'match cache invalidation failed'))

    return {
      matchId,
      ...meta,
    }
  }

  /** The archived Riot JSON of a match; null when it was never archived or cannot be read. */
  private async archived(matchId: string) {
    try {
      const r2 = drive.use('r2')
      const filePath = `matches/${matchId}.json`
      if (!(await r2.exists(filePath))) return null
      return await compressionService.decompress(await r2.get(filePath))
    } catch (error) {
      logger.warn({ err: error, matchId }, 'archived match unreadable')
      return null
    }
  }

  /** Riot's JSON, kept so a game can be re-ingested without asking Riot again. */
  async archive(matchId: string, matchData: RiotAPITypes.MatchV5.MatchDTO) {
    const filePath = `matches/${matchId}.json`
    const r2 = drive.use('r2')

    const fileExists = await r2.exists(filePath)
    if (!fileExists) {
      const compressed = await compressionService.compress(matchData)
      await r2.put(filePath, compressed)
    }
  }
}

export default new MatchesService()
