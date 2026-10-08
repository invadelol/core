import type { HttpContext } from '@adonisjs/core/http'
import playerInsightsService from '#services/player_insights_service'
import { getMasteryValidator, puuidParamsValidator } from '#validators/summoner'

/** Current PUUID APIs; the installed Riot SDK still targets the retired spectator API. */
export default class PlayerInsightsController {
  /**
   * Champion mastery, most points first when `count` is given. Each entry
   * carries `source` (`riot` or `desktop`) and `observedAt` (epoch ms).
   */
  async mastery({ params, request, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: params })
    const { count } = await request.validateUsing(getMasteryValidator, { data: request.qs() })
    if (count) return response.ok(await playerInsightsService.top(params.puuid, count))
    return response.ok(await playerInsightsService.mastery(params.puuid))
  }

  async live({ params, request, response }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    await request.validateUsing(puuidParamsValidator, { data: params })
    return response.ok(await playerInsightsService.get(params.puuid, 'live'))
  }
}
