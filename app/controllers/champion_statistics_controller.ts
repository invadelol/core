import type { HttpContext } from '@adonisjs/core/http'
import championStatsService from '#services/champion_stats_service'
import { ROLES } from '#services/ranked_stats'
import { runeParamsValidator } from '#validators/runes'
import { matchupQueryValidator } from '#validators/matchups'

/** An older patch no longer changes much: its answers may be kept longer. */
const CURRENT_MAX_AGE = 1800
const OLDER_MAX_AGE = 6 * 3600

/** A champion's statistics from our own ranked games, for the desktop app. */
export default class ChampionStatisticsController {
  /**
   * The champion page's Statistics tab for a champion in a role: its row of the tier list on the
   * patch and on the one before (when that has enough games), its record at each rank group, the
   * last 30 days a day at a time, its win rate by game length and the averages of its games, plus
   * the patches that can be asked for. A patch that is not stored answers with the newest one
   * (`patch` says which).
   * @paramPath champion - Numeric champion id
   * @paramPath role - top, jungle, mid, adc or support
   * @paramQuery bracket - all (default), iron, bronze, silver, gold, platinum, emerald, diamond, emerald_plus, diamond_plus or master_plus
   * @paramQuery patch - Patch such as 16.20 (default: the newest with enough games)
   * @paramQuery region - euw, eune, na, kr, br, lan, las, tr, jp, oce or vn (default: every region)
   * @responseBody 200 - {"patch":"16.21","bracket":"all","stat":"<RoleStat>","previous":"<RoleStat>","byRank":[],"trend":[],"length":[],"averages":{},"patches":[]}
   */
  async show({ request, params, response }: HttpContext) {
    const { champion, role } = await request.validateUsing(runeParamsValidator, {
      data: { champion: Number(params.champion), role: String(params.role).toLowerCase() },
    })
    const { bracket, patch, region } = await request.validateUsing(matchupQueryValidator)
    const filter = await championStatsService.filter({ rank: bracket ?? 'all', patch, region })
    if (!filter) return response.notFound({ error: 'No ranked games stored yet' })
    const position = ROLES[role]
    const [summary, previous, byRank, trend, profile, patches] = await Promise.all([
      championStatsService.summary(filter),
      championStatsService.previous(filter),
      championStatsService.byRank(filter, champion, position),
      championStatsService.trend(filter, champion, position),
      championStatsService.profile(filter, champion, position),
      championStatsService.patches(),
    ])
    const row = (s: typeof summary | null) =>
      s?.roles.find((r) => r.champion === champion && r.position === position) ?? null
    const before = patches[patches.findIndex((p) => p.patch === filter.patch) + 1]?.patch
    const last = row(previous)
    const current = filter.patch === patches[0]?.patch
    response.header('Cache-Control', `public, max-age=${current ? CURRENT_MAX_AGE : OLDER_MAX_AGE}`)
    return response.ok({
      patch: filter.patch,
      bracket: filter.bracket,
      stat: row(summary),
      previous: last && before ? { ...last, patch: before } : null,
      byRank,
      trend,
      length: profile.length,
      averages: profile.averages,
      patches,
    })
  }
}
