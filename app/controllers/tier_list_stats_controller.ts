import type { HttpContext } from '@adonisjs/core/http'
import championStatsService from '#services/champion_stats_service'
import { matchupQueryValidator } from '#validators/matchups'

/** An older patch no longer changes much: its answers may be kept longer. */
const CURRENT_MAX_AGE = 1800
const OLDER_MAX_AGE = 6 * 3600

/** The tier list from our own ranked games, for the desktop app. */
export default class TierListStatsController {
  /**
   * Every champion in every role it is played in, with games, win, pick and ban rate, share of
   * its games in the role, tier, place in the role and evidence level, each with its place on the
   * patch before, plus the patches that can be asked for. The same figures as the website's tier
   * list. A patch that is not offered answers with the newest one (`patch` says which).
   * @paramQuery bracket - all (default), iron, bronze, silver, gold, platinum, emerald, diamond, emerald_plus, diamond_plus or master_plus
   * @paramQuery patch - Patch such as 16.20, or a range of offered patches such as 16.20-16.22 (default: the newest with enough games)
   * @paramQuery region - euw, eune, na, kr, br, lan, las, tr, jp, oce or vn (default: every region)
   * @responseBody 200 - <TierListReport>
   */
  async show({ request, response }: HttpContext) {
    const { bracket, patch, region } = await request.validateUsing(matchupQueryValidator)
    const filter = await championStatsService.filter({ rank: bracket ?? 'all', patch, region })
    if (!filter) return response.notFound({ error: 'No ranked games stored yet' })
    const report = await championStatsService.tierList(filter)
    const current = filter.patches[0] === report.patches[0]?.patch
    response.header('Cache-Control', `public, max-age=${current ? CURRENT_MAX_AGE : OLDER_MAX_AGE}`)
    return response.ok(report)
  }
}
