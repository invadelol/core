import type { HttpContext } from '@adonisjs/core/http'
import playerInsightsService from '#services/player_insights_service'
import liveService from '#services/live/live_service'
import { getMasteryValidator, puuidParamsValidator } from '#validators/summoner'

/**
 * Champion mastery and the live game, read from Riot's PUUID APIs. Their routes run under the
 * Riot quotas (`riot_quota.ts`): only a read that really reaches Riot is counted.
 */
export default class PlayerInsightsController {
  /**
   * Champion mastery, most points first when `count` is given. Each entry
   * carries `source` (`riot` or `desktop`) and `observedAt` (epoch ms).
   * @responseBody 429 - {"errors":[{"code":"E_TOO_MANY_REQUESTS"}],"retryAfter":60,"scope":"address"}
   */
  async mastery({ params, request, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: params })
    const { count } = await request.validateUsing(getMasteryValidator, { data: request.qs() })
    if (count) return response.ok(await playerInsightsService.top(params.puuid, count))
    return response.ok(await playerInsightsService.mastery(params.puuid))
  }

  /**
   * The game a stored player is in right now (`game: null` between games), asked of Riot only
   * here, when their profile's Live section is opened. `?again=1` asks anew once the kept answer
   * is old enough (`live_service.ts`).
   * @responseBody 200 - {"game":null,"checkedAt":0}
   * @responseBody 429 - {"errors":[{"code":"E_TOO_MANY_REQUESTS"}],"retryAfter":60,"scope":"address"}
   */
  async live({ params, request, response }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    await request.validateUsing(puuidParamsValidator, { data: params })
    const again = ['1', 'true'].includes(String(request.qs().again ?? ''))
    return response.ok(await liveService.check(params.puuid, again))
  }
}
