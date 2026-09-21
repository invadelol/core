import type { HttpContext } from '@adonisjs/core/http'

import logger from '@adonisjs/core/services/logger'

import riotApiService from '#services/riot/api'
import summonerService from '#services/summoner_service'
import matchService from '#services/matches_service'
import {
  syncSummonerValidator,
  getStatsValidator,
  puuidParamsValidator,
  getChampionStatsValidator,
  getMatchesValidator,
} from '#validators/summoner'
import { invalidateResponseCache } from '#services/http_response_cache'
import { SyncGuard } from '#utils/sync_guard'
import { translateRiotError } from '#utils/riot_errors'

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
   */
  async sync({ request, response }: HttpContext) {
    const { summoner, platform } = await request.validateUsing(syncSummonerValidator)

    const identity = summonerService.normalize(summoner)
    const key = JSON.stringify([
      identity?.gameName.toLowerCase(),
      identity?.tagLine.toLowerCase(),
      platform?.toUpperCase(),
    ])
    const result = await syncGuard.run(key, async () => {
      let resolvedSummoner
      let newMatches
      try {
        resolvedSummoner = await summonerService.resolveAndUpsert(summoner, platform, {
          refresh: true,
        })
        newMatches = await matchService.update(
          resolvedSummoner.puuid,
          riotApiService.platformToRegion(resolvedSummoner.platform)
        )
      } catch (error) {
        throw translateRiotError(error)
      }

      // Ranks change even when all recent matches were ingested by another player's update.
      let rankRefreshFailed = false
      try {
        await summonerService.updateRanks(resolvedSummoner.puuid, resolvedSummoner.platform)
        await invalidateResponseCache([`summoner:${resolvedSummoner.puuid}`])
      } catch (error) {
        rankRefreshFailed = true
        logger.warn({ err: error }, 'Match update succeeded but rank refresh failed')
      }
      return { summoner: resolvedSummoner, matches: newMatches, rankRefreshFailed }
    })
    return response.ok(result)
  }

  /**
   * Get summoner details
   * @paramPath summoner - GameName-TagLine
   * @paramPath platform - Region (e.g., EUW1)
   * @responseBody 200 - { summoner: <Summoner> }
   */
  async show({ params, response }: HttpContext) {
    const { summoner, platform } = params

    try {
      const resolvedSummoner = await summonerService.resolveAndUpsert(summoner, platform)
      return response.ok({ summoner: resolvedSummoner })
    } catch (error) {
      // A profile we already hold is worth serving even when Riot is down;
      // stale beats an error page.
      const stored = await summonerService.findStored(summoner, platform).catch(() => null)
      if (stored) {
        logger.warn({ err: error, summoner, platform }, 'Riot lookup failed, serving stored row')
        return response.ok({ summoner: stored, stale: true })
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
   * Get matches
   * @paramPath puuid - Summoner PUUID
   * @requestBody <getMatchesValidator>
   * @responseBody 200 - <Match[]>
   */
  async matches({ request, params, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: params })
    const { puuid } = params
    const payload = await request.validateUsing(getMatchesValidator)

    const matches = await summonerService.getMatches(puuid, payload)
    return response.ok(matches)
  }

  /**
   * Increment summoner view count
   * @paramPath puuid - Summoner PUUID
   * @responseBody 200 - { viewCount: number }
   * @responseBody 404 - Summoner not found
   */
  async incrementViews({ request, params, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: params })
    const { puuid } = params
    const viewCount = await summonerService.incrementViewCount(puuid)

    if (viewCount === null) {
      return response.notFound({ message: 'Summoner not found' })
    }

    return response.ok({ viewCount: viewCount.toString() })
  }
}
