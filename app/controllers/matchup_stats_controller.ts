import type { HttpContext } from '@adonisjs/core/http'
import championStatsService from '#services/champion_stats_service'
import { ROLES } from '#services/ranked_stats'
import { runeParamsValidator } from '#validators/runes'
import { matchupQueryValidator } from '#validators/matchups'

/** An older patch no longer changes much: its answers may be kept longer. */
const CURRENT_MAX_AGE = 1800
const OLDER_MAX_AGE = 6 * 3600

/** Lane matchups from our own ranked games, for the desktop app. */
export default class MatchupStatsController {
  /**
   * Every lane opponent of a champion in a role, with games, win rate, share of the champion's
   * lane games, difference to its own win rate in the role and evidence level, plus its record
   * in the role (the tier list's), its teammates by role and the patches that can be asked for.
   * The same games as the champion page's Matchups tab. A patch that is not stored answers with
   * the newest one (`patch` says which).
   * @paramPath champion - Numeric champion id
   * @paramPath role - top, jungle, mid, adc or support
   * @paramQuery bracket - all (default), iron, bronze, silver, gold, platinum, emerald, diamond, emerald_plus, diamond_plus or master_plus
   * @paramQuery patch - Patch such as 16.20 (default: the newest with enough games)
   * @paramQuery region - euw, eune, na, kr, br, lan, las, tr, jp, oce or vn (default: every region)
   * @responseBody 200 - <MatchupReport>
   */
  async show({ request, params, response }: HttpContext) {
    const { champion, role } = await request.validateUsing(runeParamsValidator, {
      data: { champion: Number(params.champion), role: String(params.role).toLowerCase() },
    })
    const { bracket, patch, region } = await request.validateUsing(matchupQueryValidator)
    const filter = await championStatsService.filter({ rank: bracket ?? 'all', patch, region })
    if (!filter) return response.notFound({ error: 'No ranked games stored yet' })
    const report = await championStatsService.report(filter, champion, ROLES[role])
    const current = report.patch === report.patches[0]?.patch
    response.header('Cache-Control', `public, max-age=${current ? CURRENT_MAX_AGE : OLDER_MAX_AGE}`)
    return response.ok(report)
  }
}
