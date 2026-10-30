import { evidenceLevel, round } from '#services/ranked_stats'
import type { Filter, Position, RoleStat } from '#services/champion_stats'

/**
 * One champion's lane matchups for the desktop app (`GET /api/matchups/:champion/:role`), from
 * every lane pair of the patch (`lanePairsSql`): the games and pairs the website's Matchups tab
 * counts (`laneSql`), so both show the same figures. Pure: the rows come in, the answer goes out.
 */

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
 * rate the tier list and the champion page show.
 */
export function matchupReport(
  filter: Filter,
  champion: number,
  position: Position,
  opponents: [number, number, number][],
  stat: RoleStat | null,
  patches: MatchupReport['patches']
): MatchupReport {
  const laneGames = opponents.reduce((n, r) => n + r[1], 0)
  const laneWins = opponents.reduce((n, r) => n + r[2], 0)
  const games = stat?.games ?? laneGames
  const win = stat?.win ?? (laneGames ? round(laneWins / laneGames) : 0)
  const matchups = opponents
    .filter(([, g]) => g > 0)
    .map(([id, g, w]) => ({
      champion: id,
      games: g,
      win: round(w / g),
      share: round(g / laneGames),
      delta: round(w / g - win),
      level: evidenceLevel(g, w),
    }))
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
