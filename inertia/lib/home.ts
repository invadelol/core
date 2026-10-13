import type { MatchSummary } from '@invadelol/ui/logic'

/**
 * What the home page shows, as the server sends it (app/services/home_service.ts). Every
 * section is read from what invade.lol already stores, cached for a few minutes, and is null
 * when it could not be read: the page draws the rest without it.
 */

export interface HomeRank {
  tier: string
  division: string
  lp: number
}

/** A player as a home list shows them: enough to draw the line and link the profile. */
export interface HomePlayer {
  gameName: string
  tagLine: string
  platform: string
  profileIconId: number | null
  /** Solo/Duo, when stored. */
  rank: HomeRank | null
}

export interface TrendingPlayer extends HomePlayer {
  views: number
}

export interface HomeTrending {
  /** `week`: profile views over the last 7 days; `all`: lifetime views, until a week is counted. */
  window: 'week' | 'all'
  players: TrendingPlayer[]
}

export interface BestGame {
  matchId: string
  player: HomePlayer
  /** The game from that player's side, as a match row reads it (score included). */
  game: MatchSummary
}

export interface Climb {
  player: HomePlayer
  /** LP gained over the window (divisions and tiers counted). */
  gain: number
  wins: number
  /** Unknown when a snapshot came without losses (the client hides other players' losses). */
  losses: number | null
  /** The climb as ladder values, oldest first, for its line. */
  points: number[]
}

export interface ChampionRow {
  championId: number
  /** Riot's most played position for the champion on the patch (`teamPosition`). */
  position: string
  games: number
  wins: number
  /** 0‥1 */
  winRate: number
  pickRate: number
  banRate: number
  /** The win rate on the patch before, when it passed the same gate there. */
  previousWinRate: number | null
}

export interface HomeChampions {
  patch: string
  previousPatch: string | null
  /** Ranked Solo/Duo games stored on the patch. */
  games: number
  /** The gate: a champion with fewer games on the patch is not listed. */
  minGames: number
  rows: ChampionRow[]
}

export interface HomeData {
  trending: HomeTrending | null
  best: BestGame[] | null
  climbs: Climb[] | null
  champions: HomeChampions | null
}
