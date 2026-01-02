import type { HttpContext } from '@adonisjs/core/http'

import riotApiService from '#services/riot_api_service'
import summonerService from '#services/summoner_service'
import matchService from '#services/matches_service'
import { syncSummonerValidator, getStatsValidator } from '#validators/summoner'

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
   * @responseBody 404 - No new matches found
   */
  async sync({ request, response }: HttpContext) {
    const { summoner, platform } = await request.validateUsing(syncSummonerValidator)

    const resolvedSummoner = await summonerService.resolveAndUpsert(summoner, platform)

    const newMatches = await matchService.update(
      resolvedSummoner.puuid,
      riotApiService.platformToRegion(platform)
    )

    if (!newMatches.length) {
      return response.notFound({ message: 'No new matches found' })
    }

    return response.ok({ summoner: resolvedSummoner, matches: newMatches })
  }

  /**
   * Get summoner details
   * @paramPath summoner - GameName-TagLine
   * @paramPath platform - Region (e.g., EUW1)
   * @responseBody 200 - { summoner: <Summoner> }
   */
  async show({ params, response }: HttpContext) {
    const { summoner, platform } = params

    const resolvedSummoner = await summonerService.resolveAndUpsert(summoner, platform)
    return response.ok({ summoner: resolvedSummoner })
  }

  /**
   * Get summoner activity
   * @paramPath puuid - Summoner PUUID
   * @responseBody 200 - <Activity[]>
   */
  async activity({ params, response }: HttpContext) {
    const { puuid } = params
    const activity = await summonerService.getActivity(puuid)
    return response.ok(activity)
  }

  /**
   * Get summoner friends
   * @paramPath puuid - Summoner PUUID
   * @responseBody 200 - <Friend[]>
   */
  async friends({ params, response }: HttpContext) {
    const { puuid } = params
    const friends = await summonerService.getFriends(puuid)
    return response.ok(friends)
  }

  /**
   * Get summoner ranks
   * @paramPath puuid - Summoner PUUID
   * @responseBody 200 - { current: <Rank[]>, history: <Rank[]> }
   */
  async ranks({ params, response }: HttpContext) {
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
    const { puuid } = params
    const { getChampionStatsValidator } = await import('#validators/summoner')
    const { count } = await request.validateUsing(getChampionStatsValidator)

    const stats = await summonerService.getChampionStats(puuid, count)
    return response.ok(stats)
  }

  /**
   * Get matches
   * @paramPath puuid - Summoner PUUID
   * @requestBody <getMatchesValidator>
   * @responseBody 200 - <Match[]>
   */
  async matches({ request, params, response }: HttpContext) {
    const { puuid } = params
    const { getMatchesValidator } = await import('#validators/summoner')
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
  async incrementViews({ params, response }: HttpContext) {
    const { puuid } = params
    const summoner = await summonerService.incrementViewCount(puuid)

    if (!summoner) {
      return response.notFound({ message: 'Summoner not found' })
    }

    return response.ok({ viewCount: summoner.viewCount.toString() })
  }
}
