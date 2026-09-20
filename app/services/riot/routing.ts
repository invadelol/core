import { Exception } from '@adonisjs/core/exceptions'
import { PLATFORMS } from '#constants/riot'

export type RiotRegion = keyof typeof PLATFORMS
export type RiotPlatform = (typeof PLATFORMS)[RiotRegion][number]

const aliases: Record<string, RiotPlatform> = {
  EUW: 'EUW1',
  EUNE: 'EUN1',
  EUNE1: 'EUN1',
  NA: 'NA1',
  BR: 'BR1',
  LAN: 'LA1',
  LAS: 'LA2',
  OCE: 'OC1',
  JP: 'JP1',
  KR1: 'KR',
  TR: 'TR1',
  ME: 'ME1',
  SG: 'SG2',
  PH: 'SG2',
  PH2: 'SG2',
  TH: 'SG2',
  TH2: 'SG2',
  TW: 'TW2',
  VN: 'VN2',
}

export function normalizePlatform(value: string): RiotPlatform {
  const input = value.trim().toUpperCase()
  const platform = aliases[input] ?? input
  if (
    !Object.values(PLATFORMS)
      .flat()
      .includes(platform as RiotPlatform)
  ) {
    throw new Exception('Unsupported Riot platform', { status: 422 })
  }
  return platform as RiotPlatform
}

export function platformRegion(value: string): RiotRegion {
  const platform = normalizePlatform(value)
  return (Object.keys(PLATFORMS) as RiotRegion[]).find((region) =>
    (PLATFORMS[region] as readonly string[]).includes(platform)
  )!
}

/** A tag is only a priority hint: custom tags and transfers must still work. */
export function platformCandidates(tagLine: string, preferred?: string): RiotPlatform[] {
  const candidates: RiotPlatform[] = []
  for (const hint of [preferred, tagLine]) {
    if (!hint) continue
    try {
      candidates.push(normalizePlatform(hint))
    } catch {
      /* Custom tag. */
    }
  }
  return [...new Set([...candidates, ...Object.values(PLATFORMS).flat()])]
}
