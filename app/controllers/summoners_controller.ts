import type { HttpContext } from '@adonisjs/core/http'

import riotApiService from '#services/riot_api_service'
import summonerService from '#services/summoner_service'
import matchService from '#services/match_service'
import { syncSummonerValidator } from '#validators/summoner'

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
  
    return response.ok({ summoner: resolvedSummoner, matches: newMatches.length })
  }

  async show({ params, response }: HttpContext) {
    const { summoner, platform } = params

    const resolvedSummoner = await summonerService.resolveAndUpsert(summoner, platform)
    return response.ok({ summoner: resolvedSummoner })
  }
}
