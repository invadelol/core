import { DateTime } from 'luxon'
import { normalizePlatform } from '#services/riot/routing'
import { Exception } from '@adonisjs/core/exceptions'
import cache from '@adonisjs/cache/services/main'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import Summoner from '#models/summoner'
import Rank from '#models/rank'
import PlayerMastery from '#models/player_mastery'
import statsRepository from '#services/analytics/stats_repository'
import { translateRiotError } from '#utils/riot_errors'
import { SyncGuard } from '#utils/sync_guard'
import { demoLiveEnabled, demoLiveGame } from '#services/live/demo_live_game'
import {
  buildLiveGame,
  isPuuid,
  LOBBY_HISTORY_GAMES,
  type LiveGame,
  type SpectatorGame,
} from '#services/live/live_game'

const insightsGuard = new SyncGuard()

export interface ChampionMastery {
  championId: number
  championLevel: number
  championPoints: number
  lastPlayTime: number
  /** Riot only; the League client's mastery list does not carry them. */
  championPointsUntilNextLevel?: number
  tokensEarned?: number
  /** Provenance (docs/desktop-sync.md §6.5): `riot`, or `desktop` for the Invade app. */
  source: 'riot' | 'desktop'
  /** Epoch ms the entry was read; null for a Riot read cached before provenance existed. */
  observedAt: number | null
}

/** Entries a desktop snapshot holds: the top ten by points (§6.1). */
export const SNAPSHOT_MASTERY_SIZE = 10
/** How long a desktop mastery snapshot stands in for champion-mastery-v4 (§6.5). */
const SNAPSHOT_MASTERY_FRESHNESS = { hours: 24 }

const byPoints = (a: { championPoints: number }, b: { championPoints: number }) =>
  b.championPoints - a.championPoints

/**
 * Mastery and live game, read from Riot's current PUUID APIs; the installed
 * Riot SDK still targets the retired spectator API. Shared by the website's
 * profile and the desktop app's onboarding, so both hit the same cache.
 */
class PlayerInsightsService {
  async get(puuid: string, kind: 'mastery' | 'live') {
    const player = await Summoner.findBy('puuid', puuid)
    if (!player) throw new Exception('Player not found', { status: 404 })
    if (kind === 'live' && demoLiveEnabled(puuid)) {
      const demo = await demoLiveGame(player)
      if (demo) return { game: await this.liveGame(demo) }
    }
    const platform = normalizePlatform(player.platform).toLowerCase()
    const key = `player-insights:${platform}:${puuid}:${kind}`
    return cache.getOrSet({
      key,
      ttl: kind === 'live' ? '30s' : '1h',
      factory: () =>
        insightsGuard.run(key, async () => {
          const path =
            kind === 'live'
              ? `spectator/v5/active-games/by-summoner/${encodeURIComponent(puuid)}`
              : `champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(puuid)}`
          let res: Response
          try {
            res = await fetch(`https://${platform}.api.riotgames.com/lol/${path}`, {
              headers: { 'X-Riot-Token': env.get('RIOT_API_KEY') },
              signal: AbortSignal.timeout(12_000),
            })
          } catch {
            throw new Exception('Riot is temporarily unavailable', { status: 503 })
          }
          if (kind === 'live' && res.status === 404) return { game: null }
          if (!res.ok) throw translateRiotError(res)
          const data: any = await res.json()
          if (kind === 'mastery') {
            const observedAt = Date.now()
            const entries: ChampionMastery[] = data.map((entry: any) => ({
              championId: entry.championId,
              championLevel: entry.championLevel,
              championPoints: entry.championPoints,
              lastPlayTime: entry.lastPlayTime,
              championPointsUntilNextLevel: entry.championPointsUntilNextLevel,
              tokensEarned: entry.tokensEarned,
              source: 'riot',
              observedAt,
            }))
            await this.rememberTop(puuid, entries, observedAt)
            return entries
          }
          return { game: await this.liveGame(data) }
        }),
    })
  }

  /**
   * A spectator-v5 game as the profile shows it. Ranks and stored games come from what is already
   * tracked, in one read each (no extra Riot call per player); the lanes are inferred from them.
   * Observer credentials never leave the server.
   */
  private async liveGame(data: SpectatorGame): Promise<LiveGame> {
    const ids = [...new Set(data.participants.map((p) => p.puuid).filter(isPuuid))]
    const [ranks, games] = await Promise.all([
      ids.length
        ? Rank.query()
            .whereIn('puuid', ids)
            .where('queueType', 'RANKED_SOLO_5x5')
            .distinctOn('puuid')
            .orderBy('puuid')
            .orderBy('fetchedAt', 'desc')
            .catch(() => [])
        : [],
      statsRepository.getRecentGames(ids, LOBBY_HISTORY_GAMES).catch(() => []),
    ])
    return buildLiveGame(data, ranks, games)
  }

  /**
   * Every champion's mastery, from champion-mastery-v4 (cached 1 h). When Riot
   * cannot answer, the newest stored snapshot (Riot's or the Invade app's top
   * ten) stands in with its provenance, rather than nothing.
   */
  async mastery(puuid: string): Promise<ChampionMastery[]> {
    let entries: ChampionMastery[]
    try {
      entries = (await this.get(puuid, 'mastery')) as ChampionMastery[]
    } catch (error) {
      const snapshot = await PlayerMastery.find(puuid).catch(() => null)
      if (!snapshot?.entries?.length) throw error
      const observedAt = snapshot.observedAt.toMillis()
      return [...snapshot.entries]
        .sort(byPoints)
        .map((entry) => ({ ...entry, source: snapshot.source, observedAt }))
    }
    // Reads cached before provenance existed lack it; they expire within the hour.
    return entries.map((entry) => ({
      ...entry,
      source: entry.source ?? 'riot',
      observedAt: entry.observedAt ?? null,
    }))
  }

  /**
   * The `count` champions with the most points. A desktop snapshot younger
   * than 24 h holds the top ten, so for up to ten entries it stands in for
   * champion-mastery-v4 (docs/desktop-sync.md §6.5); anything longer, or no
   * fresh snapshot, reads the full list from Riot as before.
   */
  async top(puuid: string, count: number): Promise<ChampionMastery[]> {
    if (count <= SNAPSHOT_MASTERY_SIZE) {
      const snapshot = await PlayerMastery.query()
        .where('puuid', puuid)
        .where('source', 'desktop')
        .where('observed_at', '>', DateTime.now().minus(SNAPSHOT_MASTERY_FRESHNESS).toJSDate())
        .first()
        .catch(() => null)
      if (snapshot) {
        const observedAt = snapshot.observedAt.toMillis()
        return [...snapshot.entries]
          .sort(byPoints)
          .slice(0, count)
          .map((entry) => ({ ...entry, source: 'desktop' as const, observedAt }))
      }
    }
    return [...(await this.mastery(puuid))].sort(byPoints).slice(0, count)
  }

  /**
   * Keeps Riot's top ten next to the desktop snapshots, newest wins: an
   * older snapshot from the app then never stands in for a newer Riot read.
   */
  private async rememberTop(puuid: string, entries: ChampionMastery[], observedAt: number) {
    const top = [...entries]
      .sort(byPoints)
      .slice(0, SNAPSHOT_MASTERY_SIZE)
      .map(({ championId, championLevel, championPoints, lastPlayTime }) => ({
        championId,
        championLevel,
        championPoints,
        lastPlayTime,
      }))
    await db
      .knexQuery()
      .table('player_mastery')
      .insert({
        puuid,
        entries: JSON.stringify(top),
        observed_at: new Date(observedAt),
        source: 'riot',
        device_id: null,
      })
      .onConflict('puuid')
      .merge(['entries', 'observed_at', 'source', 'device_id'])
      .whereRaw('player_mastery.observed_at < excluded.observed_at')
      .catch((error) => logger.warn({ err: error, puuid }, 'mastery snapshot not stored'))
  }
}

export default new PlayerInsightsService()
