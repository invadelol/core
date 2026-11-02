import type { Filter, RoleStat, Summary } from '#services/champion_stats'

/**
 * The tier list for the desktop app (`GET /api/tier-list`): every champion in every role it is
 * played in, as the website's tier list counts it (`summarize`), each with its place in the role
 * on the patch before, and the patches that can be asked for. Pure: the summaries come in, the
 * answer goes out.
 */

/** One champion in one role, with its place in the role on the patch before. */
export interface TierListRow extends RoleStat {
  /** Null when it was not ranked in that role then, or there is no patch before. */
  previousRank: number | null
}

export interface TierListReport {
  patch: string
  bracket: Filter['bracket']
  region: string | null
  /** Games of the filter. */
  games: number
  /** Every champion in every role it was picked in, ranked within each role. */
  roles: TierListRow[]
  /** The patch `previousRank` reads: the one before in the patch menu, if any. */
  previousPatch: string | null
  /** Patches that can be asked for, newest first. */
  patches: { patch: string; games: number }[]
}

/** The answer from the filter's summary and the previous patch's (same bracket and region). */
export function tierListReport(
  summary: Summary,
  previous: Summary | null,
  patches: TierListReport['patches']
): TierListReport {
  const before = new Map<string, number>()
  for (const r of previous?.roles ?? [])
    if (r.rank) before.set(`${r.champion}:${r.position}`, r.rank)
  return {
    patch: summary.patch,
    bracket: summary.bracket,
    region: summary.region,
    games: summary.games,
    roles: summary.roles.map((r) => ({
      ...r,
      previousRank: before.get(`${r.champion}:${r.position}`) ?? null,
    })),
    previousPatch: previous?.patch ?? null,
    patches,
  }
}
