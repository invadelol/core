import type { HttpContext } from '@adonisjs/core/http'
import championStatsService from '#services/champion_stats_service'
import { POSITIONS, type Position } from '#services/champion_stats'
import { BRACKETS } from '#services/ranked_stats'

/** At most one pair per role. */
const MAX_PAIRS = POSITIONS.length

/**
 * `/api/lanes?pairs=TOP.122.86,MIDDLE.103.7&bracket=emerald_plus&region=euw`: what the counted
 * ranked games say about a live game's lanes, for the live game page. Each pair is a role, the
 * blue side's champion and the red side's: both champions' tier and win rate in that role, and
 * the blue champion's win rate against the red one in that lane. Stored statistics only (the
 * tier list's and the Matchups tab's), cached like them.
 */
export default class LanesController {
  async show({ request, response }: HttpContext) {
    const pairs = String(request.input('pairs', ''))
      .split(',')
      .map((p) => p.trim().split('.'))
      .filter(
        ([position, blue, red]) =>
          (POSITIONS as readonly string[]).includes(position) &&
          /^\d{1,5}$/.test(blue ?? '') &&
          /^\d{1,5}$/.test(red ?? '')
      )
      .slice(0, MAX_PAIRS)
      .map(([position, blue, red]) => ({
        position: position as Position,
        blue: Number(blue),
        red: Number(red),
      }))
    if (!pairs.length)
      return response.badRequest({ error: 'pairs is ROLE.blue.red, comma separated' })
    const bracket = String(request.input('bracket', ''))
    const filter = await championStatsService.filter({
      rank: bracket in BRACKETS ? bracket : 'emerald_plus',
      region: request.input('region'),
    })
    if (!filter) return response.notFound({ error: 'No ranked games stored yet' })
    const summary = await championStatsService.summary(filter)
    const stat = (champion: number, position: Position) => {
      const s = summary.roles.find((r) => r.champion === champion && r.position === position)
      return s ? { champion, tier: s.tier, win: s.win, games: s.games, pick: s.pick } : null
    }
    const lanes = await Promise.all(
      pairs.map(async ({ position, blue, red }) => {
        const report = await championStatsService.report(filter, blue, position).catch(() => null)
        const versus = report?.matchups.find((m) => m.champion === red)
        return {
          position,
          blue: stat(blue, position) ?? {
            champion: blue,
            tier: null,
            win: null,
            games: 0,
            pick: 0,
          },
          red: stat(red, position) ?? { champion: red, tier: null, win: null, games: 0, pick: 0 },
          /** The blue champion's win rate against the red one in this lane. */
          matchup: versus ? { win: versus.win, games: versus.games, level: versus.level } : null,
        }
      })
    )
    response.header('Cache-Control', 'public, max-age=1800')
    return response.ok({
      patch: filter.patch,
      bracket: filter.bracket,
      region: filter.region,
      lanes,
    })
  }
}
