import type { Match } from '../../../lib/types.js'

/** A pro, as a game or a roster names them. */
export interface ProTag {
  slug: string
  name: string
  photo?: string
  team: { id: string; slug: string; name: string; shortName: string | null } | null
}
/** One of their solo queue games, as the pro page lists it. */
export interface ProGame {
  matchId: string
  account: string
  platform: string
  startMs: number
  champion: number
  position: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  items: number[]
  durationSec: number
  opponent: number | null
  opponentName?: string
  opponentPro?: ProTag | null
  pros?: { pro: ProTag; champion: number; ally: boolean }[]
}
/** A stored match the page can open in place, with the pro's own side. */
export interface StoredGame {
  match: Match
  puuid: string
  gameName: string
  tagLine: string
}
export interface ProAccount {
  id: string
  platform: string
  gameName: string
  tagLine: string
  tier: string | null
  division: number | null
  lp: number | null
  wins: number | null
  losses: number | null
  peakTier: string | null
  peakDivision: number | null
  peakLp: number | null
  icon: number | null
}
export interface ProBuild {
  champion: number
  games: number
  wins: number
  kda: number
  boots: number | null
  core: number[]
  coreGames: number
  keystone: number | null
  secondaryStyle: number | null
  spells: [number, number] | null
  max: string[]
  form: boolean[]
}
export interface RosterMember {
  name: string
  slug: string | null
  photo?: string
  role: string | null
  title: string
  best: { tier: string; division: number | null; lp: number } | null
}
export type ChampionNames = Record<number, [string, string]>

export const PLATFORM: Record<string, string> = {
  EUW1: 'EUW',
  EUN1: 'EUNE',
  NA1: 'NA',
  BR1: 'BR',
  LA1: 'LAN',
  LA2: 'LAS',
  KR: 'KR',
  JP1: 'JP',
  OC1: 'OCE',
  TR1: 'TR',
  VN2: 'VN',
  TW2: 'TW',
  SG2: 'SEA',
  ME1: 'ME',
  RU: 'RU',
}
export const APEX = ['MASTER', 'GRANDMASTER', 'CHALLENGER']
