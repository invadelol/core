import type { HttpContext } from '@adonisjs/core/http'
import spellStatsService from '#services/spell_stats_service'
import { runeParamsValidator, runeQueryValidator } from '#validators/runes'

/** Summoner spells players take, from our own ranked games. */
export default class SpellStatsController {
  /**
   * The most played summoner spell pairs of a champion in a role (either order is one pair),
   * with games, win rate, share and evidence level, and how often Flash sits on D. Works for any
   * role the champion is played in.
   * @paramPath champion - Numeric champion id
   * @paramPath role - top, jungle, mid, adc or support
   * @paramQuery bracket - all (default), iron, bronze, silver, gold, platinum, emerald, diamond, emerald_plus, diamond_plus or master_plus
   * @paramQuery patch - Patch such as 16.20 (default: the newest with enough games)
   * @responseBody 200 - <SpellStats>
   */
  async show({ request, params, response }: HttpContext) {
    const { champion, role } = await request.validateUsing(runeParamsValidator, {
      data: { champion: Number(params.champion), role: String(params.role).toLowerCase() },
    })
    const { bracket, patch } = await request.validateUsing(runeQueryValidator)
    const stats = await spellStatsService.forRole(champion, role, bracket ?? 'all', patch)
    if (!stats) return response.notFound({ error: 'No ranked games stored yet' })
    response.header('Cache-Control', 'public, max-age=1800')
    return response.ok(stats)
  }
}
