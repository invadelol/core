/**
 * A team's average LP: where its starters' best solo queue accounts stand, against Master 0 LP.
 *
 * Master and above count their LP. Below Master, each division is 100 LP down from Master 0 LP,
 * plus the division's LP: Diamond I 50 LP is -50, Diamond I 0 LP is -100, Diamond II 0 LP is
 * -200, down to Diamond IV 0 LP at -400. A starter below Diamond IV, or unranked, is left out of
 * the average, and the average says how many starters it counts.
 */

const APEX = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER'])
const DIVISIONS: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 }

/** A starter's LP on the scale of the team average, or null when they are left out of it. */
export function starterLp(
  tier: string | null | undefined,
  division: number | string | null | undefined,
  lp: number | null | undefined
): number | null {
  if (!tier) return null
  if (APEX.has(tier)) return lp ?? 0
  if (tier !== 'DIAMOND') return null
  const d = typeof division === 'string' ? DIVISIONS[division] : division
  if (!d || d < 1 || d > 4) return null
  return -100 * d + (lp ?? 0)
}

/** The average of the starters it counts (`starterLp` not null), rounded, and how many it counts. */
export function teamLp(starters: (number | null)[]): { lp: number | null; counted: number } {
  const counted = starters.filter((v): v is number => v !== null)
  return {
    lp: counted.length ? Math.round(counted.reduce((n, v) => n + v, 0) / counted.length) : null,
    counted: counted.length,
  }
}
