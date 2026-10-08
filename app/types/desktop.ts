/**
 * The desktop app's upload, as specified in docs/desktop-sync.md §2.5.
 *
 * `game` and `timeline` are the League client's own match-history JSON,
 * trimmed by the app but with its keys unchanged, so these types describe
 * the LCU's shape, not match-v5's. `conversion.ts` maps one onto the other.
 */

export interface LcuPlayer {
  /** The client's raw PUUID (a 36-char UUID), never comparable to an API PUUID. */
  puuid: string
  gameName: string
  tagLine: string
  profileIcon?: number | null
}

export interface LcuIdentity {
  participantId: number
  player: LcuPlayer
}

export type LcuStats = Record<string, number | boolean>

export interface LcuParticipant {
  participantId: number
  teamId: number
  championId: number
  spell1Id?: number | null
  spell2Id?: number | null
  /** Inferred by the app on Summoner's Rift; absent elsewhere. */
  position?: string | null
  stats: LcuStats
  timeline?: { lane?: string | null; role?: string | null } | null
}

export interface LcuTeam {
  teamId: number
  win: string
  bans?: Array<{ championId: number; pickTurn: number }>
  baronKills?: number
  dragonKills?: number
  hordeKills?: number
  riftHeraldKills?: number
  towerKills?: number
  inhibitorKills?: number
  firstBlood?: boolean
  firstTower?: boolean
  firstBaron?: boolean
  /** Sic: the client's own spelling. */
  firstDargon?: boolean
  firstInhibitor?: boolean
  firstRiftHerald?: boolean
}

export interface LcuGame {
  gameId: number
  platformId: string
  gameCreation: number
  gameDuration: number
  queueId: number
  mapId: number
  gameMode: string
  gameType: string
  gameVersion: string
  participantIdentities: LcuIdentity[]
  participants: LcuParticipant[]
  teams: LcuTeam[]
}

export interface LcuParticipantFrame {
  participantId?: number
  totalGold?: number
  currentGold?: number
  xp?: number
  level?: number
  minionsKilled?: number
  jungleMinionsKilled?: number
  position?: { x: number; y: number }
  [key: string]: unknown
}

export interface LcuEvent {
  type: string
  timestamp: number
  [key: string]: unknown
}

export interface LcuFrame {
  timestamp: number
  participantFrames: Record<string, LcuParticipantFrame>
  events: LcuEvent[]
}

export interface LcuTimeline {
  frameInterval: number
  frames: LcuFrame[]
}

export interface RankSnapshot {
  tier: string
  division?: string | null
  lp: number
  wins: number
  losses: number
  /** Epoch ms the app read the snapshot from the client. */
  at: number
  provisional?: boolean
}

export type RankedQueue = 'RANKED_SOLO_5x5' | 'RANKED_FLEX_SR'

export interface LpReport {
  queue: RankedQueue
  before: RankSnapshot
  after: RankSnapshot
}

export interface MatchUpload {
  schema: 1
  matchId: string
  /** Raw PUUID of the account signed in to the client; one of the participants. */
  uploader: string
  capturedAt: number
  app: string
  game: LcuGame
  timeline: LcuTimeline | null
  lp: LpReport | null | unknown
}
