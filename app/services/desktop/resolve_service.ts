import cache from '@adonisjs/cache/services/main'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import Summoner from '#models/summoner'
import summonerService from '#services/summoner_service'
import playerInsightsService from '#services/player_insights_service'
import matchRepository from '#services/analytics/match_repository'
import { profileUrl } from '#services/desktop/device_service'
import { translateRiotError, riotErrorStatus } from '#utils/riot_errors'
import { DesktopException } from '#exceptions/desktop_exception'

/** league-v4 is asked again only when the stored rank is older than this. */
const RANK_FRESHNESS = { minutes: 10 }
const RECENT_GAMES = 20
const TOP_MASTERY = 5

export interface ResolvedRank {
  tier: string
  division: string | null
  lp: number
  wins: number
  /** Null when the newest rank came from another player's client, which hides losses (§6.4). */
  losses: number | null
  /** `riot`, or `desktop` when the Invade app reported it (§6.5). */
  source: 'riot' | 'desktop'
  /** Epoch ms the rank was last known true: its row or its confirmation, whichever is later. */
  observedAt: number
}

/**
 * Onboarding without the League client (docs/desktop-sync.md §2.4): one
 * answer with everything the app needs to personalise itself, built from
 * what core already stores. Riot is asked only for what is missing or
 * stale, through the same coalesced, cached paths the website uses, and
 * never for match-v5: recent games come from ClickHouse alone.
 */
class ResolveService {
  enabled() {
    return env.get('DESKTOP_RESOLVE_ENABLED', true)
  }

  async resolve(gameName: string, tagLine: string, platform?: string) {
    if (!this.enabled()) throw DesktopException.paused('resolve')

    let stale = false
    let player: Summoner
    try {
      player = await summonerService.resolveAndUpsert(`${gameName}-${tagLine}`, platform)
    } catch (error) {
      const translated = translateRiotError(error)
      if (riotErrorStatus(translated) === 404) throw DesktopException.notFound()
      // Riot failing is no reason to forget a player we already know.
      const stored = await summonerService
        .findStored(`${gameName}-${tagLine}`, platform)
        .catch(() => null)
      if (!stored) throw translated
      player = stored
      stale = true
    }

    const [ranks, mastery, recent] = await Promise.all([
      this.ranks(player),
      this.mastery(player.puuid),
      this.recent(player.puuid),
    ])

    return {
      puuid: player.puuid,
      gameName: player.gameName,
      tagLine: player.tagLine,
      platform: player.platform,
      profileIconId: player.profileIconId,
      summonerLevel: player.summonerLevel,
      solo: ranks.byQueue.get('RANKED_SOLO_5x5') ?? null,
      flex: ranks.byQueue.get('RANKED_FLEX_SR') ?? null,
      mastery: mastery.entries,
      recent,
      profileUrl: profileUrl(player.gameName, player.tagLine),
      fetchedAt: Date.now(),
      stale: stale || ranks.stale || mastery.stale,
    }
  }

  private async latestRanks(puuid: string) {
    const [rows, confirmations] = await Promise.all([
      db
        .from('riot_rank')
        .distinctOn('queue_type')
        .select(
          'queue_type',
          'tier',
          'division',
          'league_points',
          'wins',
          'losses',
          'fetched_at',
          'source'
        )
        .where('puuid', puuid)
        .orderBy('queue_type')
        .orderBy('fetched_at', 'desc'),
      db.from('riot_rank_confirmed').select('queue_type', 'confirmed_at').where('puuid', puuid),
    ])
    const confirmed = new Map<string, number>(
      confirmations.map((row) => [row.queue_type, new Date(row.confirmed_at).getTime()])
    )
    return rows.map((row) => ({
      ...row,
      observed_at: Math.max(new Date(row.fetched_at).getTime(), confirmed.get(row.queue_type) ?? 0),
    }))
  }

  /**
   * Stored ranks, refreshed from league-v4 when none was known current in
   * the last ten minutes: a rank row or a confirmation, from Riot or from
   * the desktop app (§6.5). The refresh is remembered for ten minutes too,
   * so an unranked player (who never gets a row) costs one call per window
   * instead of one per request.
   */
  async ranks(player: Summoner) {
    let rows = await this.latestRanks(player.puuid)
    let stale = false
    const fresh = await summonerService.ranksFresh(player.puuid, RANK_FRESHNESS).catch(() => false)

    if (!fresh) {
      try {
        await cache.getOrSet({
          key: `desktop:ranks-refreshed:${player.puuid}`,
          ttl: '10m',
          factory: async () => {
            await summonerService.updateRanks(player.puuid, player.platform)
            return Date.now()
          },
        })
        rows = await this.latestRanks(player.puuid)
      } catch (error) {
        logger.warn(
          { err: error, puuid: player.puuid },
          'rank refresh failed, serving stored ranks'
        )
        stale = true
      }
    }

    const byQueue = new Map<string, ResolvedRank>()
    for (const row of rows) {
      byQueue.set(row.queue_type, {
        tier: row.tier,
        division: row.division,
        lp: Number(row.league_points) || 0,
        wins: Number(row.wins) || 0,
        losses: row.losses === null || row.losses === undefined ? null : Number(row.losses),
        source: row.source ?? 'riot',
        observedAt: row.observed_at,
      })
    }
    return { byQueue, stale }
  }

  /**
   * Top champions by points: from a desktop snapshot younger than a day,
   * else from the website's own cached mastery read (1 h).
   */
  async mastery(puuid: string) {
    try {
      const top = await playerInsightsService.top(puuid, TOP_MASTERY)
      const entries = top.map((entry) => ({
        championId: entry.championId,
        championLevel: entry.championLevel,
        championPoints: entry.championPoints,
        lastPlayTime: entry.lastPlayTime,
        source: entry.source,
        observedAt: entry.observedAt,
      }))
      return { entries, stale: false }
    } catch (error) {
      logger.warn({ err: error, puuid }, 'mastery unavailable for desktop resolve')
      return { entries: [], stale: true }
    }
  }

  /** The player's latest games, from ClickHouse only. */
  async recent(puuid: string) {
    try {
      const matches = await matchRepository.getByPuuid(puuid, {
        view: 'summary',
        count: RECENT_GAMES,
      })
      return matches.flatMap((match: any) => {
        const me = match.participants.find((p: any) => p.puuid === puuid)
        if (!me) return []
        return [
          {
            matchId: match.matchId,
            championId: Number(me.championId),
            win: Boolean(Number(me.win)),
            queueId: Number(match.queueId),
            gameStartMs: Number(match.gameStartMs),
            durationSec: Number(match.duration),
            kills: Number(me.kills),
            deaths: Number(me.deaths),
            assists: Number(me.assists),
          },
        ]
      })
    } catch (error) {
      logger.warn({ err: error, puuid }, 'recent games unavailable for desktop resolve')
      return []
    }
  }
}

export default new ResolveService()
