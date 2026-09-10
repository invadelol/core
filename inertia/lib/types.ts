export interface Summoner {
  puuid: string
  gameName: string
  tagLine: string
  profileIconId: number | null
  summonerLevel: number | null
  platform: string
}

export interface Participant {
  puuid: string
  gameName: string
  tagLine: string
  championId: number
  teamId: number
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  level: number
  champLevel: number
  items: number[]
  spells: number[]
  perks: { primary: number; sub: number }
  visionScore: number
  damageTaken: number
  damageDealt: number
  physicalDamageDealt: number
  magicDamageDealt: number
  trueDamageDealt: number
  totalDamageDealtToChampions: number
  physicalDamageDealtToChampions: number
  magicDamageDealtToChampions: number
  trueDamageDealtToChampions: number
  damageDealtToObjectives: number
  damageDealtToTurrets: number
  totalMinionsKilled: number
  neutralMinionsKilled: number
  visionWardsBoughtInGame: number
  position: string
  goldEarned: number
  wardsPlaced: number
  wardsKilled: number
  allInPings: number
  assistPings: number
  commandPings: number
  dangerPings: number
  enemyMissingPings: number
  enemyVisionPings: number
  getBackPings: number
  needVisionPings: number
  onMyWayPings: number
  pushPings: number
  visionClearedPings: number
  baitPings: number
  holdPings: number
}

export interface TimelineEntry {
  participantId: number
  puuid: string
  teamId: number
  frameMs: number
  level: number
  xp: number
  goldCurrent: number
  goldTotal: number
  goldPerSec: number
  cs: number
  jungleCs: number
  kills: number
  deaths: number
  assists: number
  posX: number
  posY: number
  timeCc: number
  spells: number[]
  perks: {
    primaryStyle: number
    secondaryStyle: number
    keystone: number
    runes: number[]
    statPerks: { offense: number; flex: number; defense: number }
  }
  skillOrder: number[]
}

export interface Match {
  matchId: string
  gameStartMs: number
  duration: number
  queueId: number
  patch: string
  t1Win: number
  t2Win: number
  t1Towers: number
  t2Towers: number
  t1Inhibs: number
  t2Inhibs: number
  t1Dragons: number
  t2Dragons: number
  t1Barons: number
  t2Barons: number
  t1Heralds: number
  t2Heralds: number
  participants: Participant[]
  /** Loaded on demand — large, and only needed once a match is opened. */
  timeline?: TimelineEntry[]
}

export interface Rank {
  queueType: string
  tier: string
  division: string
  leaguePoints: number
  wins: number
  losses: number
  fetchedAt?: string
}

export interface RanksPayload {
  current: Rank[]
  history: Rank[]
}

export interface GlobalStats {
  csMin: number
  visionMin: number
  goldPerMinute: number
  damagePerMinute: number
  kda: number
  killParticipation: number
  damageShare: number
  goldShare: number
  winrate: number
  total: number
}

export interface StatsPayload {
  global: GlobalStats
  champions: Array<{ championId: number; games: number; winrate: number; kda: number }>
}

export interface ChampionStats {
  championId: number
  games: number
  wins: number
  winrate: number
  kda: number
  avgKills: number
  avgDeaths: number
  avgAssists: number
  csMin: number
  goldMin: number
  damageMin: number
}

export interface ActivityDay {
  day: string
  games: number
  wins: number
}

export interface Teammate {
  puuid: string
  gameName: string
  tagLine: string
  profileIconId: number
  level: number
  games: number
  wins: number
}

/** Rune selection, normalised from the timeline with a match-row fallback. */
export interface RuneSet {
  keystone: number
  primaryStyle: number
  secondaryStyle: number
  runes: number[]
  statPerks: { offense: number; flex: number; defense: number }
}
