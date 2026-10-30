import buildStatsService from '#services/build_stats_service'
import runeStatsService from '#services/rune_stats_service'
import spellStatsService from '#services/spell_stats_service'
import type { Bracket, Role } from '#services/ranked_stats'
import type { BuildStats } from '#services/build_stats'
import type { RuneStats } from '#services/rune_stats'
import type { SpellStats } from '#services/spell_stats'

/** What `/api/runes`, `/api/builds` and `/api/summoners` answer for one bracket. */
export interface PickBracket {
  runes: RuneStats | null
  builds: BuildStats | null
  summoners: SpellStats | null
}

/** One kind of answer per champion, role and bracket (the three services). */
interface Source<T> {
  forRole(champion: number, role: Role, bracket: Bracket, patch?: string): Promise<T | null>
}

export interface PickSources {
  runes: Source<RuneStats>
  builds: Source<BuildStats>
  summoners: Source<SpellStats>
}

/**
 * The rune pages, builds and summoner spells of a pick for several brackets in one call: a
 * client that reads a chain of brackets (its rank, then broader ones) asks once, and every
 * bracket is counted at the same time instead of one after the other. Each answer comes from
 * its own service and cache, exactly as its route gives it.
 */
export class PickStatsService {
  constructor(
    private sources: PickSources = {
      runes: runeStatsService,
      builds: buildStatsService,
      summoners: spellStatsService,
    }
  ) {}

  async forRole(
    champion: number,
    role: Role,
    brackets: Bracket[],
    patch?: string
  ): Promise<Record<string, PickBracket>> {
    const { runes, builds, summoners } = this.sources
    const answers = await Promise.all(
      brackets.map(async (bracket) => {
        const [r, b, s] = await Promise.all([
          runes.forRole(champion, role, bracket, patch),
          builds.forRole(champion, role, bracket, patch),
          summoners.forRole(champion, role, bracket, patch),
        ])
        return [bracket, { runes: r, builds: b, summoners: s }] as const
      })
    )
    return Object.fromEntries(answers)
  }
}

/** `emerald_plus,emerald,all` as brackets, each once, in order. */
export function bracketList(value: string | undefined): Bracket[] {
  const list = (value ?? 'all').split(',').map((b) => b.trim()) as Bracket[]
  return [...new Set(list)]
}

export default new PickStatsService()
