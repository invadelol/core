import { ROLES, type Bracket, type Role } from '#services/ranked_stats'
import { latestPatch, rows, statsCache } from '#services/ranked_games_service'
import {
  spellRowsSql,
  summarizeSpells,
  type SpellRow,
  type SpellStats,
} from '#services/spell_stats'

/**
 * Summoner spells players really take, per champion and role, from the ranked games in our own
 * ClickHouse: the app's source of summoner spells for every champion in every role. The
 * counting is in `spell_stats.ts`.
 */
export class SpellStatsService {
  #cache = statsCache('spells')

  async forRole(
    champion: number,
    role: Role,
    bracket: Bracket = 'all',
    patch?: string
  ): Promise<SpellStats | null> {
    const resolvedPatch = patch ?? (await latestPatch())
    if (!resolvedPatch) return null
    const position = ROLES[role]
    const key = `${champion}:${position}:${bracket}:${resolvedPatch}`
    return this.#cache.get(key, async () => {
      const found = await rows(spellRowsSql(bracket, { champion, position }), {
        champion,
        position,
        patch: resolvedPatch,
      })
      const result = summarizeSpells(found.map((row) => row.map(Number)) as SpellRow[])
      return { champion, role: position, patch: resolvedPatch, bracket, ...result }
    })
  }
}

export default new SpellStatsService()
