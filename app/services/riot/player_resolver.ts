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
  /** The server the account plays League on, as Riot names it (`euw1`). */
  region?(region: AccountRegion, puuid: string): Promise<string>
}

/** Sequential probes stop on success, and never turn an outage/key error into a miss. */
export async function resolvePlayer(
  lookup: PlayerLookup,
  gameName: string,
  tagLine: string,
  platform?: string,
  preferred?: string
) {
  let candidates = platform ? [normalizePlatform(platform)] : platformCandidates(tagLine, preferred)
  const region = platformRegion(candidates[0])
  // Account-v1 does not support SEA; accounts can be looked up via the global clusters.
  const first: AccountRegion = region === 'sea' ? 'asia' : region
  const regions = [...new Set<AccountRegion>([first, 'europe', 'americas', 'asia'])]
  let account: Account | undefined
  let found: AccountRegion = first
  for (const route of regions) {
    try {
      account = await lookup.account(route, gameName, tagLine)
      found = route
      break
    } catch (error) {
      if (riotErrorStatus(error) !== 404) throw error
    }
  }
  if (!account?.puuid) throw new Exception('Summoner not found', { status: 404 })

  // One account can hold a summoner on several servers: an old one left behind by a transfer
  // answers summoner-v4 as well as the one they play on. The first server to answer is not
  // where they play, so ask Riot which one it is and try it first. A stored server or a tag is
  // only a guess. Without an answer, the probes below still find a server.
  if (!platform) {
    const active = await activePlatform(lookup, found, account.puuid)
    if (active) candidates = [...new Set([active, ...candidates])]
  }

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

/** The account's League server, or nothing when Riot does not say (the probes decide then). */
async function activePlatform(
  lookup: PlayerLookup,
  route: AccountRegion,
  puuid: string
): Promise<RiotPlatform | undefined> {
  if (!lookup.region) return undefined
  try {
    return normalizePlatform(await lookup.region(route, puuid))
  } catch {
    // An error here is no worse than not asking: a spent key or an outage still stops the
    // probes, which report it.
    return undefined
  }
}
