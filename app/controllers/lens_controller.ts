import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import lensService from '#services/lens_service'
import { puuidParamsValidator } from '#validators/summoner'

const lensValidator = vine.compile(
  vine.object({
    role: vine.enum(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT', 'UTILITY']).optional(),
    type: vine.enum(['ranked', 'flex', 'normal', 'all']).optional(),
    count: vine.number().withoutDecimals().min(5).max(50).optional(),
  })
)

export default class LensController {
  /**
   * A player's performance in one role, grouped by domain (laning, farming, teamfighting,
   * vision, objectives, survival, consistency), each rated 0–100 on the Invade score's scale.
   * Without `role`, the role played most lately in the queue.
   * @paramPath puuid - Summoner PUUID
   * @paramQuery role - TOP, JUNGLE, MIDDLE, BOTTOM or SUPPORT
   * @paramQuery type - ranked, flex, normal or all (default)
   * @paramQuery count - The newest games of the role to read, 5 to 50 (default 20)
   * @responseBody 200 - <LensPayload>
   */
  async show({ params, request, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: params })
    const filters = await request.validateUsing(lensValidator, { data: request.qs() })
    return response.ok(await lensService.get(params.puuid, filters))
  }
}
