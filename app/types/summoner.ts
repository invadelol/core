export type SummonerActivity = {
  day: string
  games: number
  wins: number
}

export type SummonerFriend = {
  puuid: string
  gameName: string
  tagLine: string
  profileIconId: number
  level: number
  games: number
  wins: number
}

export type SummonerStats = {
  global: {
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
  champions: {
    championId: number
    games: number
    winrate: number
    kda: number
  }[]
}

export type SummonerChampionStats = {
  championId: number
  games: number
  wins: number
  winrate: number
  kda: number
  kills: number
  deaths: number
  assists: number
  csMin: number
  goldMin: number
  damageMin: number
}
