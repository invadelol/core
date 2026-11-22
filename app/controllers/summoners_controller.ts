import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'

import betaService from '#services/desktop/beta_service'
import riotApiService from '#services/riot/api'
import summonerService from '#services/summoner_service'
import matchService from '#services/matches_service'
import { playerBuild } from '#services/player_build_service'
import {
  syncSummonerValidator,
  getStatsValidator,
  puuidParamsValidator,
  getChampionStatsValidator,
  getMatchesValidator,
} from '#validators/summoner'
import { invalidateResponseCache } from '#services/http_response_cache'
import { SyncGuard } from '#utils/sync_guard'
import {
  riotErrorStatus,
  riotRetryAfter,
  RiotUpstreamException,
  translateRiotError,
} from '#utils/riot_errors'
import matchPager from '#services/match_pager'
import riotQuota from '#services/quota/riot_quota'
import homeService from '#services/home_service'
import { firstViewInWindow } from '#services/profile_views'
import deviceService from '#services/desktop/device_service'
import playerSnapshotService from '#services/desktop/player_snapshot_service'
import Summoner from '#models/summoner'
import Rank from '#models/rank'
import ladderService from '#services/ladder_service'
import { isApex, placeOf } from '#services/ladder'
import { serverLabel } from '#constants/riot'
import { DEFAULT_MATCH_COUNT } from '#config/constants'

/** The website's Update skips league-v4 when the ranks were known current this recently (§6.5). */
const SYNC_RANK_FRESHNESS = { minutes: 3 }

/**
 * How current a profile is: the last Riot refresh, the newest game the
 * desktop app delivered, and the newest snapshot of the player it reported
 * (§6.5). A failed lookup only costs its own figure.
 */
async function freshness(summoner: Summoner) {
  const [lastDesktopSyncAt, lastObservedAt] = await Promise.all([
    deviceService.lastSyncAt(summoner.puuid).catch(() => null),
    playerSnapshotService.lastObservedAt(summoner.puuid).catch(() => null),
  ])
  return { lastRefreshAt: summoner.lastRefreshAt ?? null, lastDesktopSyncAt, lastObservedAt }
}

const syncGuard = new SyncGuard()

export default class SummonersController {
  /**
   * Search summoners
   * @paramQuery q - Search query
   * @paramQuery limit - Max results (default 10, max 50)
   * @responseBody 200 - <Summoner[]>
   */
  async search({ request, response }: HttpContext) {
    const q = request.input('q', '')
    const limit = Math.min(Number(request.input('limit', 10)) || 10, 50)

    const summoners = await summonerService.search(q, limit)
    return response.ok(summoners)
  }

  /**
   * Sync summoner data
   * @requestBody <syncSummonerValidator>
   * @responseBody 200 - { summoner: <Summoner>, matches: <Match[]> }
   * @responseBody 404 - Summoner not found
   * @responseBody 429 - {"errors":[{"code":"E_TOO_MANY_REQUESTS"}],"retryAfter":60,"scope":"address"}
   */
  async sync({ request, response }: HttpContext) {
    const { summoner, platform } = await request.validateUsing(syncSummonerValidator)

    const identity = summonerService.normalize(summoner)
    const player = identity ? `${identity.gameName}#${identity.tagLine}` : null
    const key = JSON.stringify([
      identity?.gameName.toLowerCase(),
      identity?.tagLine.toLowerCase(),
      platform?.toUpperCase(),
    ])
    const result = await syncGuard.run(key, async () => {
      if (player) {
        // Updated by someone a moment ago: what is stored is that update, and Riot has nothing
        // newer yet. Five teammates scouting the same lobby make one set of requests, not five.
        if (await riotQuota.recentlySynced(player)) {
          const stored = await summonerService.findStored(summoner, platform).catch(() => null)
          if (stored) return { summoner: stored, matches: [], rankRefreshFailed: false }
        }
        riotQuota.target(player)
      }
      let resolvedSummoner
      try {
        resolvedSummoner = await summonerService.resolveAndUpsert(summoner, platform, {
          refresh: true,
        })
      } catch (error) {
        throw translateRiotError(error)
      }
      const { puuid } = resolvedSummoner

      // Ranks change even when all recent matches were ingested by another player's
      // update; league-v4 is skipped only when Riot or the app said so minutes ago.
      // It does not depend on the games, so it runs alongside match-v5 rather than
      // after it.
      const rankRefresh = (async () => {
        const fresh = await summonerService
          .ranksFresh(puuid, SYNC_RANK_FRESHNESS)
          .catch(() => false)
        if (!fresh) await summonerService.updateRanks(puuid, resolvedSummoner.platform)
      })()
      rankRefresh.catch(() => {})

      let newMatches
      try {
        newMatches = await matchService.update(
          puuid,
          riotApiService.platformToRegion(resolvedSummoner.platform)
        )
      } catch (error) {
        // Ranks may have been stored meanwhile; they must not hide behind the cache.
        await rankRefresh.then(() => invalidateResponseCache([`summoner:${puuid}`])).catch(() => {})
        throw translateRiotError(error)
      }

      let rankRefreshFailed = false
      try {
        await rankRefresh
      } catch (error) {
        rankRefreshFailed = true
        logger.warn({ err: error }, 'Match update succeeded but rank refresh failed')
      }
      // Whatever the ranks did: the profile read right after the sync must not be a cached one.
      await invalidateResponseCache([`summoner:${puuid}`]).catch((error) =>
        logger.warn({ err: error }, 'Sync cache invalidation failed')
      )
      if (player) await riotQuota.synced(player)
      return { summoner: resolvedSummoner, matches: newMatches, rankRefreshFailed }
    })
    return response.ok(result)
  }

  /**
   * Get summoner details
   * @paramPath summoner - GameName-TagLine
   * @paramPath platform - Region (e.g., EUW1)
   * @responseBody 200 - { summoner: <Summoner>, freshness: { lastRefreshAt, lastDesktopSyncAt, lastObservedAt } }
   * @responseBody 429 - {"errors":[{"code":"E_TOO_MANY_REQUESTS"}],"retryAfter":60,"scope":"address"}
   */
  async show({ params, response }: HttpContext) {
    const { summoner, platform } = params
    // Only a Riot ID not stored yet reaches Riot, and takes from the quotas.
    const identity = summonerService.normalize(summoner)
    if (identity) riotQuota.target(`${identity.gameName}#${identity.tagLine}`)

    try {
      const resolvedSummoner = await summonerService.resolveAndUpsert(summoner, platform)
      return response.ok({
        summoner: resolvedSummoner,
        freshness: await freshness(resolvedSummoner),
        betaTester: await betaService.isTester(resolvedSummoner.puuid),
      })
    } catch (error) {
      // A profile we already hold is worth serving even when Riot is down;
      // stale beats an error page.
      const stored = await summonerService.findStored(summoner, platform).catch(() => null)
      if (stored) {
        logger.warn({ err: error, summoner, platform }, 'Riot lookup failed, serving stored row')
        return response.ok({
          summoner: stored,
          stale: true,
          freshness: await freshness(stored),
          betaTester: await betaService.isTester(stored.puuid),
        })
      }

      throw translateRiotError(error)
    }
  }

  /**
   * Get summoner activity
   * @paramPath puuid - Summoner PUUID
   * @responseBody 200 - <Activity[]>
   */
  async activity({ request, params, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: params })
    const { puuid } = params
    const activity = await summonerService.getActivity(puuid)
    return response.ok(activity)
  }

  /**
   * Get summoner friends
   * @paramPath puuid - Summoner PUUID
   * @responseBody 200 - <Friend[]>
   */
  async friends({ request, params, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: params })
    const { puuid } = params
    const friends = await summonerService.getFriends(puuid)
    return response.ok(friends)
  }

  /**
   * How the player builds one champion, from their stored games on it
   * @paramPath puuid - Summoner PUUID
   * @paramPath champion - Champion id
   * @responseBody 200 - <ProBuild> or null
   */
  async build({ request, params, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: { puuid: params.puuid } })
    const champion = Number(params.champion)
    if (!Number.isInteger(champion) || champion <= 0 || champion > 65535)
      return response.badRequest({ error: 'Invalid champion' })
    return response.ok(await playerBuild(params.puuid, champion))
  }

  /**
   * Get summoner ranks
   * @paramPath puuid - Summoner PUUID
   * @responseBody 200 - { current: <Rank[]>, history: <Rank[]> }
   */
  async ranks({ request, params, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: params })
    const { puuid } = params
    const ranks = await summonerService.getRanks(puuid)
    return response.ok(ranks)
  }

  /**
   * The player's place on their server's Solo/Duo apex ladder (Master and up), as the Leaderboards
   * page ranks it, from the stored league reads: no request to Riot. Only asked for a player whose
   * stored Solo/Duo rank is Master or higher; `position` is null off the ladder.
   * @paramPath puuid - Summoner PUUID
   * @responseBody 200 - { position: number | null, server: string, players: number }
   */
  async ladder({ request, params, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: params })
    const { puuid } = params
    const [summoner, solo] = await Promise.all([
      Summoner.find(puuid),
      Rank.query()
        .where('puuid', puuid)
        .where('queueType', 'RANKED_SOLO_5x5')
        .orderBy('fetchedAt', 'desc')
        .first(),
    ])
    if (!summoner) return response.notFound({ error: 'Summoner not found' })
    const server = serverLabel(summoner.platform)
    if (!solo?.tier || !isApex(solo.tier))
      return response.ok({ position: null, server, players: 0 })
    const snapshot = await ladderService.snapshot(summoner.platform).catch((error) => {
      logger.warn({ err: error, platform: summoner.platform }, 'ladder unreadable for a profile')
      return null
    })
    if (!snapshot) return response.ok({ position: null, server, players: 0 })
    const position = placeOf(
      snapshot.entries,
      snapshot.identities,
      summoner.gameName,
      summoner.tagLine
    )
    return response.ok({ position, server, players: snapshot.entries.length })
  }

  /**
   * Get summoner stats
   * @paramPath puuid - Summoner PUUID
   * @requestBody <getStatsValidator>
   * @responseBody 200 - <Stats>
   */
  async stats({ request, params, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: params })
    const { puuid } = params
    const payload = await request.validateUsing(getStatsValidator)

    const stats = await summonerService.getStats(puuid, payload)
    return response.ok(stats)
  }

  /**
   * The player's season for a multi search: games, wins, kills, deaths and assists per champion,
   * and games and wins per position (`queue`: `solo` for Solo/Duo, `rift` when there were too few).
   * @paramPath puuid - Summoner PUUID
   * @responseBody 200 - { queue, champions: [], roles: [] }
   */
  async season({ request, params, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: params })
    return response.ok(await summonerService.getSeasonPool(params.puuid))
  }

  /**
   * Get champion stats
   * @paramPath puuid - Summoner PUUID
   * @requestBody <getChampionStatsValidator>
   * @responseBody 200 - <ChampionStats[]>
   */
  async champions({ request, params, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: params })
    const { puuid } = params
    const filters = await request.validateUsing(getChampionStatsValidator)

    const stats = await summonerService.getChampionStats(puuid, filters.count, filters)
    return response.ok(stats)
  }

  /**
   * Get matches. Paged by `before` (an infinite list), the plain list fills a short page from
   * Riot (older games not stored yet), at the pace of `MatchPager`. Stored games are never
   * counted. Over that pace (or when Riot itself is rate limited), the page holds what is stored,
   * possibly nothing, and `Retry-After` says when older games may be asked for again: the list
   * quietly ends there for now.
   * @paramPath puuid - Summoner PUUID
   * @requestBody <getMatchesValidator>
   * @responseBody 200 - <Match[]>
   * @responseHeader 200 - Retry-After - Seconds before older games may be asked from Riot again (only on a held page)
   */
  async matches({ request, params, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: params })
    const { puuid } = params
    const payload = await request.validateUsing(getMatchesValidator)

    const matches = await summonerService.getMatches(puuid, payload)
    const count = payload.count ?? DEFAULT_MATCH_COUNT
    const plain =
      (payload.type ?? 'all') === 'all' && (payload.role ?? 'all') === 'all' && !payload.champion
    if (payload.before === undefined || !plain || matches.length >= count) {
      return response.ok(matches)
    }
    const held = (seconds: number) => {
      response.header('Retry-After', String(seconds))
      return response.ok(matches)
    }
    const wait = await matchPager.take(puuid, request.ip())
    if (wait) return held(wait)
    let stored: number
    try {
      stored = await matchService.older(puuid, payload.before, count)
    } catch (error) {
      // Riot's own limit on the key: the same quiet end as ours.
      if (error instanceof RiotUpstreamException && error.code === 'E_RIOT_RATE_LIMITED')
        return held(error.retryAfter ?? 60)
      if (!(error instanceof RiotUpstreamException) && riotErrorStatus(error) === 429)
        return held(riotRetryAfter(error))
      throw error
    }
    return response.ok(stored ? await summonerService.getMatches(puuid, payload) : matches)
  }

  /**
   * Count a profile view: once per visitor and profile a day (a keyed hash of address and
   * browser, never stored in clear), so reloading a profile does not add to it. Returns the
   * total either way.
   * @paramPath puuid - Summoner PUUID
   * @responseBody 200 - { viewCount: number }
   * @responseBody 404 - Summoner not found
   */
  async incrementViews({ request, params, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: params })
    const { puuid } = params
    const visitor = { ip: request.ip(), userAgent: request.header('user-agent') ?? '' }
    const counted = await firstViewInWindow(visitor, puuid)
    const viewCount = counted
      ? await summonerService.incrementViewCount(puuid)
      : await summonerService.getViewCount(puuid)

    if (viewCount === null) {
      return response.notFound({ message: 'Summoner not found' })
    }
    // The home page's Trending reads views by day; counting one must never hold the answer.
    if (counted) void homeService.recordView(puuid)

    return response.ok({ viewCount: viewCount.toString() })
  }
}
