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

type MatchCluster = Exclude<RiotAPITypes.Cluster, PlatformId.ESPORTS>

/** A match whose events could not be fetched is not asked for again before this. */
const BACKFILL_RETRY_MS = 10 * 60 * 1000

class MatchesService {
  private updates = new SyncGuard()
  private matches = new SyncGuard()
  private backfills = new SyncGuard()
  private backfillFailures = new Map<string, number>()

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

    const existingIds = await matchRepository.getExistingIds(matchIds)
    const newIds = matchIds.filter((id) => !existingIds.has(id))

    if (!newIds.length) {
      return []
    }

    const results = await Promise.all(
      newIds.map((matchId) => this.fetchAndStoreMatch(matchId, cluster))
    )

    const summoner = await Summoner.find(puuid)
    if (summoner) {
      void SummonerUpdated.dispatch(puuid, summoner.platform).catch((error) =>
        logger.warn({ err: error, puuid }, 'Post-sync summoner listener failed')
      )
    }

    return results
  }

  /**
   * Kill and objective events of a match stored before they were kept: one timeline request,
   * once. A failed attempt is not retried for a while, so a page opened repeatedly never turns
   * into a stream of Riot calls. Returns whether events were stored.
   */
  async backfillEvents(match: {
    matchId: string
    platform: string
    gameStartMs: number
    participants: Array<{ puuid: string; teamId: number }>
  }) {
    const last = this.backfillFailures.get(match.matchId)
    if (last && Date.now() - last < BACKFILL_RETRY_MS) return false
    if (this.backfillFailures.size > 5000) this.backfillFailures.clear()
    const run = async () => {
      try {
        const timeline = await riotApiService.client.matchV5.getMatchTimelineById({
          matchId: match.matchId,
          cluster: riotApiService.platformToRegion(match.platform) as MatchCluster,
        })
        const teamByPuuid = new Map(match.participants.map((p) => [p.puuid, p.teamId]))
        const teamOf = new Map<number, number>()
        for (const p of timeline.info?.participants ?? []) {
          const team = teamByPuuid.get(p.puuid)
          if (team) teamOf.set(p.participantId, team)
        }
        const stored = await ingestionService.ingestEvents(
          match.matchId,
          match.platform,
          match.gameStartMs,
          timeline,
          teamOf
        )
        if (!stored) return false
        await invalidateResponseCache([`match:${match.matchId}`]).catch(() => {})
        return true
      } catch (error) {
        this.backfillFailures.set(match.matchId, Date.now())
        logger.warn({ err: error, matchId: match.matchId }, 'match events backfill failed')
        return false
      }
    }
    // The guard itself throws while Riot rate-limits us: the page opens without events.
    return this.backfills.run(match.matchId, run).catch(() => false)
  }

  async fetchAndStoreMatch(matchId: string, cluster: MatchCluster) {
    return this.matches.run(`${cluster}:${matchId}`, () => this.storeMatch(matchId, cluster))
  }

  private async storeMatch(matchId: string, cluster: MatchCluster) {
    const matchData = await riotApiService.client.matchV5.getMatchById({
      matchId,
      cluster,
    })

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

    let meta: Awaited<ReturnType<typeof ingestionService.ingestMatch>>
    try {
      meta = await ingestionService.ingestMatch(matchId, matchData)
    } catch (error) {
      await matchSourceService.release(matchId).catch(() => {})
      throw error
    }

    const timelineData = await riotApiService.client.matchV5.getMatchTimelineById({
      matchId,
      cluster,
    })
    await ingestionService.ingestTimeline(matchId, matchData, timelineData, meta)
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
