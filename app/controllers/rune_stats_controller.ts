import type { HttpContext } from '@adonisjs/core/http'
import runeStatsService from '#services/rune_stats_service'
import { runeParamsValidator, runeQueryValidator } from '#validators/runes'

/** Rune pages players run, from our own ranked games. */
export default class RuneStatsController {
  /**
   * The most played rune pages of a champion in a role, with games, win rate, share and
   * evidence level, plus its keystones. Works for any role the champion is played in, the
   * uncommon ones included (Seraphine mid, Cho'Gath support).
   * @paramPath champion - Numeric champion id
   * @paramPath role - top, jungle, mid, adc or support
   * @paramQuery bracket - all (default), emerald_plus, diamond_plus or master_plus
   * @paramQuery patch - Patch such as 16.20 (default: the newest with enough games)
   * @responseBody 200 - <RuneStats>
   */
  async show({ request, params, response }: HttpContext) {
    const { champion, role } = await request.validateUsing(runeParamsValidator, {
      data: { champion: Number(params.champion), role: String(params.role).toLowerCase() },
    })
    const { bracket, patch } = await request.validateUsing(runeQueryValidator)
    const stats = await runeStatsService.forRole(champion, role, bracket ?? 'all', patch)
    if (!stats) return response.notFound({ error: 'No ranked games stored yet' })
    response.header('Cache-Control', 'public, max-age=1800')
    return response.ok(stats)
  }
}
