import type { HttpContext } from '@adonisjs/core/http'

import riotApiService from '#services/riot_api_service'
import summonerService from '#services/summoner_service'
import matchService from '#services/matches_service'
import { syncSummonerValidator, getStatsValidator } from '#validators/summoner'

export default class SummonersController {
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

  async show({ params, response }: HttpContext) {
    const { summoner, platform } = params

    const resolvedSummoner = await summonerService.resolveAndUpsert(summoner, platform)
    return response.ok({ summoner: resolvedSummoner })
  }

  async activity({ params, response }: HttpContext) {
    const { puuid } = params
    const activity = await summonerService.getActivity(puuid)
    return response.ok(activity)
  }

  async friends({ params, response }: HttpContext) {
    const { puuid } = params
    const friends = await summonerService.getFriends(puuid)
    return response.ok(friends)
  }

  async ranks({ params, response }: HttpContext) {
    const { puuid } = params
    const ranks = await summonerService.getRanks(puuid)
    return response.ok(ranks)
  }

  async stats({ request, params, response }: HttpContext) {
    const { puuid } = params
    const payload = await request.validateUsing(getStatsValidator)

    const stats = await summonerService.getStats(puuid, payload)
    return response.ok(stats)
  }

  async champions({ request, params, response }: HttpContext) {
    const { puuid } = params
    const { getChampionStatsValidator } = await import('#validators/summoner')
    const { count } = await request.validateUsing(getChampionStatsValidator)

    const stats = await summonerService.getChampionStats(puuid, count)
    return response.ok(stats)
  }
}
