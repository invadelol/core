import { evidenceLevel, round } from '#services/ranked_stats'
import type { Filter, Position, RoleStat } from '#services/champion_stats'

/**
 * One champion's lane matchups for the desktop app (`GET /api/matchups/:champion/:role`), from
 * every lane pair of the patch (`lanePairsSql`): the games and pairs the website's Matchups tab
 * counts (`laneSql`), so both show the same figures. Pure: the rows come in, the answer goes out.
 */

/**
 * The win rate two champions' own win rates predict when they meet (log5): `a` against `b`.
 * Two equal champions give 50 %.
 */
export function log5(a: number, b: number) {
  const top = a * (1 - b)
  const bottom = top + b * (1 - a)
  return bottom ? round(top / bottom) : 0.5
}

/**
 * The lane phase of a matchup at 15 minutes, averaged over the games with both players' frames:
 * the gaps are the champion's minus the opponent's (positive: the champion is ahead).
 */
export interface LanePhase {
  /** Games with both frames at 15 minutes. */
  games: number
  goldDiff: number
  xpDiff: number
  csDiff: number
  /** Share of its team's kills before 15 minutes it took part in (kill or assist); null without a kill. */
  kp: number | null
  /** Share of the games it led in gold at 15 minutes. */
  ahead: number
}

/**
 * One opponent's lane phase sums from the counted cells (`laneEarlyFromCellsSql`): opponent,
 * games, CS, gold and experience gaps, games ahead in gold, kills and assists, team kills.
 */
export type LanePhaseRow = [number, number, number, number, number, number, number, number]

/** The lane phase sums as averages per game; null without a game. */
export function lanePhase(row: LanePhaseRow): LanePhase | null {
  const [, games, cs, gold, xp, ahead, involved, teamKills] = row
  if (!games) return null
  return {
    games,
    goldDiff: Math.round(gold / games),
    xpDiff: Math.round(xp / games),
    csDiff: round(cs / games, 1),
    kp: teamKills ? round(involved / teamKills) : null,
    ahead: round(ahead / games),
  }
}

/** One lane opponent. */
export interface LaneMatchup {
  champion: number
  games: number
  /** Win rate of the champion asked for, in the games against this opponent. */
  win: number
  /** Share of the champion's lane games played against this opponent: how often the matchup comes up. */
  share: number
  /** `win` minus the champion's own win rate in the role. */
  delta: number
  level: number
  /** The lane phase at 15 minutes, once the patch's lane cells are counted. */
  lane?: LanePhase
}

export interface MatchupReport {
  champion: number
  role: Position
  patch: string
  bracket: Filter['bracket']
  region: string | null
  /** The champion in the role, as the tier list counts it (or, off its listed roles, from the lane games). */
  games: number
  win: number
  /** Share of the filter's games it was picked in, in this role; null off its listed roles. */
  pick: number | null
  ban: number | null
  tier: number | null
  rank: number | null
  /** Every lane opponent met, most played first. */
  matchups: LaneMatchup[]
  /** Patches that can be asked for, newest first. */
  patches: { patch: string; games: number }[]
}

/**
 * The answer from the lane opponents (champion, games, wins) and the champion's row of the
 * summary when it has one: its record there is the baseline, so a delta reads against the win
 * rate the tier list and the champion page show. `lanes`: each opponent's lane phase sums, when
 * counted (an opponent without them has no `lane`).
 */
export function matchupReport(
  filter: Filter,
  champion: number,
  position: Position,
  opponents: [number, number, number][],
  stat: RoleStat | null,
  patches: MatchupReport['patches'],
  lanes: LanePhaseRow[] = []
): MatchupReport {
  const phases = new Map(lanes.map((r) => [r[0], lanePhase(r)]))
  const laneGames = opponents.reduce((n, r) => n + r[1], 0)
  const laneWins = opponents.reduce((n, r) => n + r[2], 0)
  const games = stat?.games ?? laneGames
  const win = stat?.win ?? (laneGames ? round(laneWins / laneGames) : 0)
  const matchups = opponents
    .filter(([, g]) => g > 0)
    .map(([id, g, w]) => {
      const lane = phases.get(id)
      return {
        champion: id,
        games: g,
        win: round(w / g),
        share: round(g / laneGames),
        delta: round(w / g - win),
        level: evidenceLevel(g, w),
        ...(lane ? { lane } : {}),
      }
    })
    .sort((a, b) => b.games - a.games || a.champion - b.champion)
  return {
    champion,
    role: position,
    patch: filter.patch,
    bracket: filter.bracket,
    region: filter.region,
    games,
    win,
    pick: stat?.pick ?? null,
    ban: stat?.ban ?? null,
    tier: stat?.tier ?? null,
    rank: stat?.rank ?? null,
    matchups,
    patches,
  }
}
