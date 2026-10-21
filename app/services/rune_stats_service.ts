import { AnswerCache, ROLES, type Bracket, type Role } from '#services/ranked_stats'
import { latestPatch, rows } from '#services/ranked_games_service'
import { pageRowsSql, summarize, type PageRow, type RuneStats } from '#services/rune_stats'

/**
 * Rune pages players really run, per champion and role, from the ranked games in our own
 * ClickHouse (the crawler fills the same tables as the site). The app's source of rune pages
 * for every champion in every role, the uncommon ones included (Seraphine mid, Cho'Gath
 * support, a mage top). The counting is in `rune_stats.ts`.
 */
export class RuneStatsService {
  #cache = new AnswerCache()

  async forRole(
    champion: number,
    role: Role,
    bracket: Bracket = 'all',
    patch?: string
  ): Promise<RuneStats | null> {
    const resolvedPatch = patch ?? (await latestPatch())
    if (!resolvedPatch) return null
    const position = ROLES[role]
    const key = `${champion}:${position}:${bracket}:${resolvedPatch}`
    return this.#cache.get(key, async () => {
      const found = await rows(pageRowsSql(bracket, { champion, position }), {
        champion,
        position,
        patch: resolvedPatch,
      })
      const result = summarize(found.map((row) => row.map(Number)) as PageRow[])
      return { champion, role: position, patch: resolvedPatch, bracket, ...result }
    })
  }
}

export default new RuneStatsService()
