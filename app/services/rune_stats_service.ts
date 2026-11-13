import { ROLES, type Bracket, type Role } from '#services/ranked_stats'
import { rangeStart, readPatches, rows, statsCache } from '#services/ranked_games_service'
import { pageRowsSql, summarize, type PageRow, type RuneStats } from '#services/rune_stats'

/**
 * Rune pages players really run, per champion and role, from the ranked games in our own
 * ClickHouse (the crawler fills the same tables as the site). The app's source of rune pages
 * for every champion in every role, the uncommon ones included (Seraphine mid, Cho'Gath
 * support, a mage top). The counting is in `rune_stats.ts`.
 */
export class RuneStatsService {
  #cache = statsCache('runes')

  async forRole(
    champion: number,
    role: Role,
    bracket: Bracket = 'all',
    patch?: string,
    region: string | null = null
  ): Promise<RuneStats | null> {
    const read = await readPatches(patch)
    if (!read) return null
    const resolvedPatch = read.patch
    const position = ROLES[role]
    // Every region keeps the key it always had.
    const key = `${champion}:${position}:${bracket}:${resolvedPatch}${region ? `:${region}` : ''}`
    return this.#cache.get(key, async () => {
      const found = await rows(pageRowsSql(bracket, { champion, position }, region), {
        champion,
        position,
        patches: read.patches,
        patchStart: await rangeStart(read.patches),
      })
      const result = summarize(found.map((row) => row.map(Number)) as PageRow[])
      return { champion, role: position, patch: resolvedPatch, bracket, ...result }
    })
  }
}

export default new RuneStatsService()
