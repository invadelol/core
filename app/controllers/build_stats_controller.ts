import type { HttpContext } from '@adonisjs/core/http'
import buildStatsService, { ItemDataUnavailable } from '#services/build_stats_service'
import { runeParamsValidator, runeQueryValidator } from '#validators/runes'

/** Item builds players buy, from our own ranked games. */
export default class BuildStatsController {
  /**
   * The most played starting items, boots and cores (first three legendary items, in the order
   * most bought) of a champion in a role, the options of its 4th to 6th item and every legendary
   * item it finishes, each with games, win rate, share and evidence level. Works for any role
   * the champion is played in.
   * @paramPath champion - Numeric champion id
   * @paramPath role - top, jungle, mid, adc or support
   * @paramQuery bracket - all (default), iron, bronze, silver, gold, platinum, emerald, diamond, emerald_plus, diamond_plus or master_plus
   * @paramQuery patch - Patch such as 16.20 (default: the newest with enough games)
   * @responseBody 200 - <BuildStats>
   */
  async show({ request, params, response }: HttpContext) {
    const { champion, role } = await request.validateUsing(runeParamsValidator, {
      data: { champion: Number(params.champion), role: String(params.role).toLowerCase() },
    })
    const { bracket, patch } = await request.validateUsing(runeQueryValidator)
    try {
      const stats = await buildStatsService.forRole(champion, role, bracket ?? 'all', patch)
      if (!stats) return response.notFound({ error: 'No ranked games stored yet' })
      response.header('Cache-Control', 'public, max-age=1800')
      return response.ok(stats)
    } catch (error) {
      if (error instanceof ItemDataUnavailable) {
        return response.status(503).send({ error: 'Item data unavailable, try again later' })
      }
      throw error
    }
  }
}
