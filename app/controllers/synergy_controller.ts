import type { HttpContext } from '@adonisjs/core/http'
import synergyService from '#services/synergy_service'
import { puuidParamsValidator } from '#validators/summoner'
import { duoParamsValidator, togetherValidator } from '#validators/synergy'

/** The friends page: who a player queues with, and the games of one duo. */
export default class SynergyController {
  /**
   * Teammates, synergy, lanes, picks and groups over the player's latest stored games.
   * @paramPath puuid - Summoner PUUID
   * @responseBody 200 - <SynergyReport>
   */
  async report({ request, params, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: params })
    return response.ok(await synergyService.report(params.puuid))
  }

  /**
   * The games a player and a teammate played on the same side, newest first.
   * @paramPath puuid - Summoner PUUID
   * @paramPath mate - The teammate's PUUID
   * @paramQuery count - Games per page (default 10, at most 50)
   * @paramQuery offset - Games to skip
   * @responseBody 200 - <Match[]>
   */
  async together({ request, params, response }: HttpContext) {
    await request.validateUsing(duoParamsValidator, { data: params })
    const page = await request.validateUsing(togetherValidator)
    return response.ok(
      await synergyService.together(params.puuid, params.mate, {
        count: page.count ?? 10,
        offset: page.offset ?? 0,
      })
    )
  }
}
