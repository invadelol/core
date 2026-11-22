import { DateTime } from 'luxon'
import { normalizePlatform } from '#services/riot/routing'
import { Exception } from '@adonisjs/core/exceptions'
import cache from '@adonisjs/cache/services/main'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import Summoner from '#models/summoner'
import PlayerMastery from '#models/player_mastery'
import riotApiService from '#services/riot/api'
import { translateRiotError } from '#utils/riot_errors'
import { SyncGuard } from '#utils/sync_guard'

const insightsGuard = new SyncGuard()

export interface ChampionMastery {
  championId: number
  championLevel: number
  championPoints: number
  lastPlayTime: number
  /** Riot only; the League client's mastery list does not carry them. */
  championPointsUntilNextLevel?: number
  /** Riot only: points earned since the current level began (the progress bar's filled part). */
  championPointsSinceLastLevel?: number
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
 * A failed Riot read as the API reports it: Riot's status when it answered (404, 429, a rejected
 * key), a refusal of ours as it is, and 503 when Riot could not be reached at all.
 */
function riotFailure(error: unknown) {
  const translated = translateRiotError(error)
  if (translated instanceof Exception) return translated
  return new Exception('Riot is temporarily unavailable', { status: 503 })
}

/**
 * Mastery, read from Riot's current PUUID API through the shared Riot client (its rate limits,
 * queue caps and the caller's quota). Shared by the website's profile and the desktop app's
 * onboarding, so both hit the same cache.
 */
class PlayerInsightsService {
  async get(puuid: string, kind: 'mastery', refresh = false) {
    const player = await Summoner.findBy('puuid', puuid)
    if (!player) throw new Exception('Player not found', { status: 404 })
    const platform = normalizePlatform(player.platform).toLowerCase()
    const key = `player-insights:${platform}:${puuid}:${kind}`
    return cache.getOrSet({
      key,
      ttl: '1h',
      forceFresh: refresh,
      factory: () =>
        insightsGuard.run(key, async () => {
          let data: Awaited<ReturnType<typeof riotApiService.championMasteries>>
          try {
            data = await riotApiService.championMasteries(platform, puuid)
          } catch (error) {
            throw riotFailure(error)
          }
          const observedAt = Date.now()
          const entries: ChampionMastery[] = data.map((entry) => ({
            championId: entry.championId,
            championLevel: entry.championLevel,
            championPoints: entry.championPoints,
            lastPlayTime: entry.lastPlayTime,
            championPointsUntilNextLevel: entry.championPointsUntilNextLevel,
            championPointsSinceLastLevel: entry.championPointsSinceLastLevel,
            tokensEarned: entry.tokensEarned,
            source: 'riot',
            observedAt,
          }))
          await this.rememberTop(puuid, entries, observedAt)
          return entries
        }),
    })
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
