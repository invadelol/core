import type { HttpContext } from '@adonisjs/core/http'
import playerInsightsService from '#services/player_insights_service'
import { puuidParamsValidator } from '#validators/summoner'

/** Current PUUID APIs; the installed Riot SDK still targets the retired spectator API. */
export default class PlayerInsightsController {
  async mastery({ params, request, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: params })
    return response.ok(await playerInsightsService.get(params.puuid, 'mastery'))
  }

  async live({ params, request, response }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    await request.validateUsing(puuidParamsValidator, { data: params })
    return response.ok(await playerInsightsService.get(params.puuid, 'live'))
  }
}
