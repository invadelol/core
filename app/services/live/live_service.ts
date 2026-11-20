import cache from '@adonisjs/cache/services/main'
import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import Summoner from '#models/summoner'
import Rank from '#models/rank'
import riotApiService from '#services/riot/api'
import { inBackground } from '#services/riot/client'
import { normalizePlatform } from '#services/riot/routing'
import statsRepository from '#services/analytics/stats_repository'
import { LiveRanks } from '#services/live/ranks'
import { demoLiveEnabled, demoLiveGame } from '#services/live/demo_live_game'
import {
  buildLiveGame,
  isPuuid,
  LOBBY_HISTORY_GAMES,
  type LiveGame,
  type LobbyRank,
  type SpectatorGame,
} from '#services/live/live_game'
import { riotErrorStatus, translateRiotError } from '#utils/riot_errors'
import { SyncGuard } from '#utils/sync_guard'

/**
 * A player's live game, for the Live section of their profile. Riot is asked only when someone
 * opens that section (never by a page render, never on a timer), and every answer is kept:
 *
 * - spectator-v5: one request per check, through the application's rate-limited Riot client, the
 *   answer kept `KEEP_MS` for every visitor; a check asked again sooner gets the kept answer, and
 *   concurrent checks of one player share one request;
 * - each other player's Solo/Duo rank: the stored one when it is recent, else league-v4 behind
 *   every visitor's own request (`inBackground`, a few at a time), kept `RANK_MS`; a rank Riot
 *   cannot give right now is left out, never guessed;
 * - their games on their champion: the games already stored, no request.
 *
 * An address may ask Riot a few times per window (the controller's `beforeRiot`), so a page left
 * open or a script cannot spend the key; a kept answer costs nothing and is never counted.
 */

/** A check's answer stands this long for everyone. */
export const KEEP_MS = 60_000
/** "Check again" asks Riot anew only once the answer is this old. */
export const MIN_RECHECK_MS = 20_000
/** A rank read for a live game stands this long: it moves only between games. */
const RANK_MS = 15 * 60_000
/** A stored rank this recent is used as is. */
const STORED_RANK_MS = 24 * 3_600_000
/** Rank reads in flight at once, behind visitors' requests. */
const RANK_READS = 3

export interface LiveCheck {
  game: LiveGame | null
  /** When Riot was asked, in ms. */
  checkedAt: number
}

const guard = new SyncGuard()
const ranks = new LiveRanks(
  (puuid, platform) =>
    inBackground(() =>
      riotApiService.client.league.getEntriesByPUUID({ puuid, region: platform as any })
    ),
  Date.now,
  RANK_MS
)

/** Runs `task` over `list`, `width` at a time. */
async function pooled<T, R>(list: T[], width: number, task: (item: T) => Promise<R>) {
  const out: R[] = new Array(list.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(width, list.length) }, async () => {
      while (next < list.length) {
        const i = next++
        out[i] = await task(list[i])
      }
    })
  )
  return out
}

class LiveService {
  /**
   * The game `puuid` is in now, or `game: null` between games. `beforeRiot` runs only when Riot is
   * about to be asked (not for a kept answer), and may refuse by throwing.
   */
  async check(
    puuid: string,
    again = false,
    beforeRiot: () => Promise<void> = async () => {}
  ): Promise<LiveCheck> {
    const player = await Summoner.findBy('puuid', puuid)
    if (!player) throw new Exception('Player not found', { status: 404 })
    if (demoLiveEnabled(puuid)) {
      const demo = await demoLiveGame(player)
      if (demo) return { game: await this.liveGame(demo, null), checkedAt: Date.now() }
    }
    const platform = normalizePlatform(player.platform).toLowerCase()
    const key = `live:${platform}:${puuid}`
    const kept = await cache.get<LiveCheck>({ key }).catch(() => undefined)
    if (kept && (!again || Date.now() - kept.checkedAt < MIN_RECHECK_MS)) return kept
    await beforeRiot()
    return guard.run(key, async () => {
      const found = await this.spectate(puuid, platform)
      const answer: LiveCheck = {
        game: found ? await this.liveGame(found, platform) : null,
        checkedAt: Date.now(),
      }
      await cache.set({ key, value: answer, ttl: KEEP_MS }).catch(() => {})
      return answer
    })
  }

  /** spectator-v5: the game, or null when Riot says the player is in none (its 404). */
  private async spectate(puuid: string, platform: string): Promise<SpectatorGame | null> {
    try {
      return (await riotApiService.client.spectator.getBySummonerId({
        region: platform as any,
        summonerId: puuid,
      })) as unknown as SpectatorGame
    } catch (error) {
      if (riotErrorStatus(error) === 404) return null
      const translated = translateRiotError(error)
      if (translated instanceof Exception && translated.status === 404) return null
      throw translated
    }
  }

  /**
   * Every human player's rank and stored-game context. A bot or a hidden player is never looked
   * up; no observer credentials or other Riot fields pass (`buildLiveGame`).
   */
  private async liveGame(data: SpectatorGame, platform: string | null): Promise<LiveGame> {
    const ids = [
      ...new Set(
        data.participants
          .filter((p) => !p.bot)
          .map((p) => p.puuid)
          .filter(isPuuid)
      ),
    ]
    const [stored, games] = await Promise.all([
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
    const known = new Map<string, LobbyRank>()
    const recent = new Set<string>()
    for (const r of stored) {
      known.set(r.puuid, {
        puuid: r.puuid,
        tier: r.tier,
        division: r.division,
        leaguePoints: r.leaguePoints,
        wins: r.wins,
        losses: r.losses,
      })
      if (r.fetchedAt && Date.now() - r.fetchedAt.toMillis() < STORED_RANK_MS) recent.add(r.puuid)
    }
    const statuses = new Map<string, 'ranked' | 'unranked' | 'unavailable'>()
    if (platform) {
      const missing = ids.filter((id) => !recent.has(id))
      await pooled(missing, RANK_READS, async (id) => {
        const read = await ranks.get(id, platform)
        statuses.set(id, read.status)
        if (read.rank) known.set(id, read.rank)
        // Riot says Unranked: a stored Solo/Duo rank from before no longer stands.
        else if (read.rank === null) known.delete(id)
      }).catch((error) => logger.warn({ err: error }, 'live ranks unreadable'))
    }
    return buildLiveGame(data, [...known.values()], games, statuses)
  }
}

const liveService = new LiveService()
export default liveService
