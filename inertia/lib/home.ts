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

/* ── The home and the header's menus (app/services/home_service.ts) ──────────── */

/** A champion in one role, as the home's lists and the header's menus link it. */
export interface HomeChampion {
  championId: number
  name: string
  /** The champion page's address (`/champions/<slug>`). */
  slug: string
  /** Riot's position: TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY. */
  position: string
}

/** The best ranked champion of a role on the default tier list. */
export interface HomePick extends HomeChampion {
  /** 0 S+ … 5 D. */
  tier: number | null
  /** 0‥1 */
  winRate: number
}

export interface HomeBan extends HomeChampion {
  /** Share of the patch's games it was banned in, 0‥1. */
  banRate: number
}

/** A champion that moved up its role's tier list since the patch before. */
export interface HomeClimber extends HomeChampion {
  from: number
  to: number
}

/** A pro's place on the solo queue ladder. */
export interface HomePro {
  slug: string
  name: string
  team: { id: string; name: string; shortName: string | null } | null
  tier: string | null
  lp: number | null
  /** Places and LP gained over the last 24 hours, when the ladder's history is known. */
  movement?: { places: number; lp: number } | null
}

/** A champion in one role with one figure: gold ahead at 10 minutes, or a share of first bloods. */
export interface HomeLaneRow extends HomeChampion {
  value: number
}

/** The home page's sections, each null when it could not be read. */
export interface HomePage {
  /** The default tier list (newest patch, Emerald and above, every region). */
  picks: { patch: string; best: HomePick[]; bans: HomeBan[] } | null
  pros: HomePro[] | null
  lanes: {
    /** Average gold ahead of the lane opponent at 10 minutes, laners only. */
    bullies: HomeLaneRow[]
    /** Share of games the champion took part in first blood (killer or assist), 0‥1. */
    firstBlood: HomeLaneRow[]
  } | null
  discord: { members: number; online: number } | null
}

/** A league of the pros directory, with its logo at `/cdn/league/<slug>`. */
export interface NavLeague {
  slug: string
  name: string
  /** The acronym shown when the logo is missing. */
  short: string
  teams: number
}

/** What the header's menus show beside their links (`/api/site/nav`), loaded on first open. */
export interface SiteNav {
  tierList: {
    patch: string
    previousPatch: string | null
    /** Ranked games behind the tier list. */
    games: number
    /** Champions in the game. */
    champions: number
    best: HomePick[]
    climbers: HomeClimber[]
  } | null
  pros: {
    top: HomePro[]
    counts: { players: number; accounts: number; teams: number } | null
  } | null
  leagues: NavLeague[]
}
