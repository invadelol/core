import { randomInt } from 'node:crypto'

/**
 * Trust is checked continuously (docs/desktop-sync.md §1.2): a sample of
 * what trusted devices publish for free is verified against Riot afterwards,
 * one call each, so a device that turns dishonest is caught without core
 * paying for every report.
 */

/** One trusted match upload in this many is checked against match-v5 (§4.2). */
export const MATCH_AUDIT_ONE_IN = 10
/** One applied player snapshot from a trusted device in this many is checked against league-v4. */
export const PLAYER_AUDIT_ONE_IN = 20

/** True once in `n` draws on average. `random` is injectable so tests can count exactly. */
export function oneIn(n: number, random: (max: number) => number = randomInt): boolean {
  return random(n) === 0
}
