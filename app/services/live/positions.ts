import type { Position } from '@invadelol/ui/logic'
import { CHAMPION_POSITIONS } from '#services/live/champion_positions'

/**
 * Lanes of a live game. Riot's spectator API says who plays which champion but not where, so each
 * team's five players are matched to Top, Jungle, Mid, Bot and Support: every one of the 120 ways
 * to seat them is scored, and the likeliest wins. A player's score for a lane adds up evidence in
 * log space:
 *
 * - the champion: where it is played (`CHAMPION_POSITIONS`), never quite ruling a lane out;
 * - Smite: the jungler's spell, close to certain either way;
 * - the other summoner spells, lightly (Heal leans Bot, Teleport Top…);
 * - the player's own stored games: their lanes overall, and their lanes on this champion.
 *
 * Seating a whole team at once is what makes weak evidence work: a Teleport that would pull a mid
 * laner to Top costs nothing when the top laner carries one too. The scores of all 120 seatings,
 * read as odds, also say how sure each seat is.
 */

export const POSITION_ORDER: readonly Position[] = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT']

const JUNGLE = 1
const SMITE = 11

/** Where a summoner spell is taken, as shares per position; Flash says nothing. */
const SPELL_POSITIONS: Readonly<Record<number, readonly number[]>> = {
  1: [0.1, 0.02, 0.2, 0.65, 0.03], // Cleanse
  3: [0.08, 0.02, 0.1, 0.1, 0.7], // Exhaust
  6: [0.55, 0.05, 0.1, 0.2, 0.1], // Ghost
  7: [0.03, 0.02, 0.05, 0.85, 0.05], // Heal
  12: [0.62, 0.02, 0.28, 0.05, 0.03], // Teleport
  14: [0.22, 0.03, 0.37, 0.03, 0.35], // Ignite
  21: [0.12, 0.02, 0.4, 0.43, 0.03], // Barrier
}

/** How much each kind of evidence counts. */
const WEIGHT = { spell: 0.5, history: 0.8, championHistory: 1 }
/** The least share a champion keeps in any lane: off-role picks happen. */
const CHAMPION_FLOOR = 0.03

/** Games per position, in `POSITION_ORDER`. */
export type PositionCounts = readonly number[]

export interface PositionEvidence {
  championId: number
  spell1Id: number
  spell2Id: number
  /** The player's stored Summoner's Rift games per position. */
  history?: PositionCounts | null
  /** The same, on this champion only. */
  championHistory?: PositionCounts | null
}

export interface Seat {
  position: Position
  /** How sure the seat is, 0 to 1: its share of the odds over every way to seat the team. */
  confidence: number
}

/** A player's log-evidence for each position, in `POSITION_ORDER`. */
export function positionScores(player: PositionEvidence): number[] {
  const champion = CHAMPION_POSITIONS[player.championId]
  const spells = [player.spell1Id, player.spell2Id]
  const smite = spells.includes(SMITE)
  return POSITION_ORDER.map((_, lane) => {
    const share = champion ? champion[lane] / 100 : 0.2
    let score = Math.log(CHAMPION_FLOOR + (1 - CHAMPION_FLOOR) * share)
    if (lane === JUNGLE) score += smite ? 0 : Math.log(0.03)
    else if (smite) score += Math.log(0.01)
    for (const spell of spells) {
      const shares = SPELL_POSITIONS[spell]
      if (shares) score += WEIGHT.spell * Math.log(Math.max(0.02, shares[lane]) / 0.2)
    }
    score += WEIGHT.history * laplace(player.history, lane, 1)
    score += WEIGHT.championHistory * laplace(player.championHistory, lane, 0.5)
    return score
  })
}

/** Log share of a lane in a player's games, smoothed; equal everywhere without games. */
function laplace(counts: PositionCounts | null | undefined, lane: number, prior: number) {
  if (!counts) return 0
  const total = counts.reduce((sum, n) => sum + n, 0)
  return Math.log((counts[lane] + prior) / (total + prior * POSITION_ORDER.length))
}

/** Every ordering of 0…n-1. */
function permutations(n: number): number[][] {
  if (n <= 1) return [[0]]
  return permutations(n - 1).flatMap((rest) =>
    Array.from({ length: n }, (_, at) => [...rest.slice(0, at), n - 1, ...rest.slice(at)])
  )
}
const SEATINGS = permutations(POSITION_ORDER.length)

/**
 * Seats a team of five, in the order given: each player's position and how sure it is. Null for a
 * team that is not five players (a mode without lanes).
 */
export function assignPositions(team: readonly PositionEvidence[]): Seat[] | null {
  if (team.length !== POSITION_ORDER.length) return null
  const scores = team.map(positionScores)
  // seating[i] = the lane of player i.
  const totals = SEATINGS.map((seating) =>
    seating.reduce((sum, lane, player) => sum + scores[player][lane], 0)
  )
  const best = totals.indexOf(Math.max(...totals))
  const odds = totals.map((total) => Math.exp(total - totals[best]))
  const sum = odds.reduce((a, b) => a + b, 0)
  return SEATINGS[best].map((lane, player) => {
    let agree = 0
    SEATINGS.forEach((seating, i) => {
      if (seating[player] === lane) agree += odds[i]
    })
    return {
      position: POSITION_ORDER[lane],
      confidence: Math.round((agree / sum) * 100) / 100,
    }
  })
}
