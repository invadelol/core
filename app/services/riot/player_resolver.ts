import { Exception } from '@adonisjs/core/exceptions'
import { riotErrorStatus } from '#utils/riot_errors'
import { normalizePlatform, platformCandidates, platformRegion } from './routing.js'
import type { RiotPlatform } from './routing.js'

export interface Account {
  puuid: string
  gameName?: string
  tagLine?: string
}
export interface PlayerDetails {
  profileIconId: number
  summonerLevel: number
}
type AccountRegion = 'europe' | 'americas' | 'asia'
export interface PlayerLookup {
  account(region: AccountRegion, gameName: string, tagLine: string): Promise<Account>
  summoner(platform: RiotPlatform, puuid: string): Promise<PlayerDetails>
}

/** Sequential probes stop on success, and never turn an outage/key error into a miss. */
export async function resolvePlayer(
  lookup: PlayerLookup,
  gameName: string,
  tagLine: string,
  platform?: string,
  preferred?: string
) {
  const candidates = platform
    ? [normalizePlatform(platform)]
    : platformCandidates(tagLine, preferred)
  const region = platformRegion(candidates[0])
  // Account-v1 does not support SEA; accounts can be looked up via the global clusters.
  const first: AccountRegion = region === 'sea' ? 'asia' : region
  const regions = [...new Set<AccountRegion>([first, 'europe', 'americas', 'asia'])]
  let account: Account | undefined
  for (const route of regions) {
    try {
      account = await lookup.account(route, gameName, tagLine)
      break
    } catch (error) {
      if (riotErrorStatus(error) !== 404) throw error
    }
  }
  if (!account?.puuid) throw new Exception('Summoner not found', { status: 404 })

  for (const candidate of candidates) {
    try {
      const details = await lookup.summoner(candidate, account.puuid)
      return { account, details, platform: candidate }
    } catch (error) {
      if (riotErrorStatus(error) !== 404) throw error
    }
  }
  throw new Exception('No League of Legends profile found', { status: 404 })
}
