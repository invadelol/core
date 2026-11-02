import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import buildStatsService from '#services/build_stats_service'
import championStatsService from '#services/champion_stats_service'
import runeStatsService from '#services/rune_stats_service'
import spellStatsService from '#services/spell_stats_service'
import { ROLES } from '#services/ranked_stats'
import { runeParamsValidator } from '#validators/runes'
import { matchupQueryValidator } from '#validators/matchups'

/** An older patch no longer changes much: its answers may be kept longer. */
const CURRENT_MAX_AGE = 1800
const OLDER_MAX_AGE = 6 * 3600

/**
 * A block that can be left out: its failure is logged and the rest of the answer still goes.
 * Failures are not cached, so the next ask counts it again.
 */
function optional<T>(block: string, load: Promise<T>): Promise<T | null> {
  return load.catch((error) => {
    logger.warn({ err: error, block }, 'champion statistics block failed')
    return null
  })
}

/** A champion's statistics from our own ranked games, for the desktop app. */
export default class ChampionStatisticsController {
  /**
   * Everything counted for a champion in a role, for the desktop app's statistics page: its row
   * of the tier list on the patch and on the one before (when that has enough games) and in every
   * role it is played in; the last 30 days a day at a time; its win rate by game length, the
   * averages of its games, the objectives of both teams and what its participant rows hold beyond
   * them; CS, gold and experience at 10 and 15 minutes against its lane opponent, and first blood;
   * every lane opponent and teammate; its skill orders, summoner spells, rune pages and items;
   * and the patches that can be asked for. A patch that is not stored answers with the newest one
   * (`patch` says which). Blocks that need a timeline or event rows are null without them.
   * @paramPath champion - Numeric champion id
   * @paramPath role - top, jungle, mid, adc or support
   * @paramQuery bracket - all (default), iron, bronze, silver, gold, platinum, emerald, diamond, emerald_plus, diamond_plus or master_plus
   * @paramQuery patch - Patch such as 16.20 (default: the newest with enough games)
   * @paramQuery region - euw, eune, na, kr, br, lan, las, tr, jp, oce or vn (default: every region)
   * @responseBody 200 - {"patch":"16.21","bracket":"all","region":null,"stat":"<RoleStat>","previous":"<RoleStat>","roles":[],"trend":[],"length":[],"averages":{},"objectives":{},"details":{},"early":[],"firstBlood":{},"matchups":[],"teammates":{},"skills":{},"spells":{},"runes":{},"items":{},"patches":[]}
   */
  async show({ request, params, response }: HttpContext) {
    const { champion, role } = await request.validateUsing(runeParamsValidator, {
      data: { champion: Number(params.champion), role: String(params.role).toLowerCase() },
    })
    const { bracket, patch, region } = await request.validateUsing(matchupQueryValidator)
    const filter = await championStatsService.filter({ rank: bracket ?? 'all', patch, region })
    if (!filter) return response.notFound({ error: 'No ranked games stored yet' })
    const position = ROLES[role]
    const picks = [champion, role, filter.bracket, filter.patch, filter.region] as const
    const [summary, previous, trend, profile, patches] = await Promise.all([
      championStatsService.summary(filter),
      championStatsService.previous(filter),
      championStatsService.trend(filter, champion, position),
      championStatsService.profile(filter, champion, position),
      championStatsService.patches(),
    ])
    const [report, teammates, skills, spells, runes, items, details, early, firstBlood] =
      await Promise.all([
        optional('matchups', championStatsService.report(filter, champion, position)),
        optional('teammates', championStatsService.teammates(filter, champion, position)),
        optional('skills', championStatsService.skills(filter, champion, position)),
        optional('spells', spellStatsService.forRole(...picks)),
        optional('runes', runeStatsService.forRole(...picks)),
        optional('items', buildStatsService.forRole(...picks)),
        optional('details', championStatsService.details(filter, champion, position)),
        optional('early', championStatsService.early(filter, champion, position)),
        optional('first blood', championStatsService.firstBlood(filter, champion, position)),
      ])
    const mine = (s: typeof summary | null) => s?.roles.filter((r) => r.champion === champion) ?? []
    const row = (s: typeof summary | null) => mine(s).find((r) => r.position === position) ?? null
    const before = patches[patches.findIndex((p) => p.patch === filter.patch) + 1]?.patch
    const last = row(previous)
    const current = filter.patch === patches[0]?.patch
    response.header('Cache-Control', `public, max-age=${current ? CURRENT_MAX_AGE : OLDER_MAX_AGE}`)
    return response.ok({
      patch: filter.patch,
      bracket: filter.bracket,
      region: filter.region,
      stat: row(summary),
      previous: last && before ? { ...last, patch: before } : null,
      roles: [...mine(summary)].sort((a, b) => b.games - a.games),
      trend,
      length: profile.length,
      averages: profile.averages,
      // An answer counted before the objectives were has none.
      objectives: profile.objectives ?? null,
      details,
      early,
      firstBlood,
      matchups: report?.matchups ?? [],
      teammates: teammates ?? {},
      skills: skills?.games ? skills : null,
      spells: spells?.games ? spells : null,
      runes: runes?.games ? runes : null,
      items: items?.games ? items : null,
      patches,
    })
  }
}
