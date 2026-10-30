import type { HttpContext } from '@adonisjs/core/http'
import { ItemDataUnavailable } from '#services/build_stats_service'
import pickStatsService, { bracketList } from '#services/pick_stats_service'
import { pickQueryValidator, runeParamsValidator } from '#validators/runes'

/** Rune pages, item builds and summoner spells of a pick, for several brackets at once. */
export default class PickStatsController {
  /**
   * What `/api/runes`, `/api/builds` and `/api/summoners` answer for a champion in a role, for
   * each bracket asked, in one request: the brackets are counted at the same time. A component
   * without any ranked game stored is `null`.
   * @paramPath champion - Numeric champion id
   * @paramPath role - top, jungle, mid, adc or support
   * @paramQuery brackets - Up to 5 brackets, comma-separated, such as emerald_plus,emerald,all (default: all)
   * @paramQuery patch - Patch such as 16.20 (default: the newest with enough games)
   * @responseBody 200 - {"champion":103,"role":"MIDDLE","brackets":{"emerald_plus":{"runes":"<RuneStats>","builds":"<BuildStats>","summoners":"<SpellStats>"}}}
   */
  async show({ request, params, response }: HttpContext) {
    const { champion, role } = await request.validateUsing(runeParamsValidator, {
      data: { champion: Number(params.champion), role: String(params.role).toLowerCase() },
    })
    // The query string parser reads `a,b` as a list: one string again, as the validator expects.
    const query = request.qs()
    const { brackets, patch } = await request.validateUsing(pickQueryValidator, {
      data: {
        ...query,
        brackets: Array.isArray(query.brackets) ? query.brackets.join(',') : query.brackets,
      },
    })
    try {
      const answers = await pickStatsService.forRole(champion, role, bracketList(brackets), patch)
      response.header('Cache-Control', 'public, max-age=1800')
      return response.ok({ champion, role, brackets: answers })
    } catch (error) {
      if (error instanceof ItemDataUnavailable) {
        return response.status(503).send({ error: 'Item data unavailable, try again later' })
      }
      throw error
    }
  }
}
