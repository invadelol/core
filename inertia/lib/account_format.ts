import { tierName } from './board.js'

/**
 * How accounts' lists word a League account's rank, the same on the server (the app's lists)
 * and in the pages.
 */

const APEX = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER'])

/** "Diamond II", "Master", or null when unranked. */
export function rankText(tier: string | null, division: string | null) {
  if (!tier) return null
  return APEX.has(tier) || !division ? tierName(tier) : `${tierName(tier)} ${division}`
}
