import env from '#start/env'
import { RiotAPI, RiotAPITypes, PlatformId } from '@fightmegg/riot-api'

export type { RiotAPITypes }

class RiotApiService {
  public client: RiotAPI

  constructor() {
    this.client = new RiotAPI(env.get('RIOT_API_KEY'))
  }

  public platformToRegion(
    platform: string
  ): PlatformId.EUROPE | PlatformId.AMERICAS | PlatformId.ASIA | PlatformId.SEA {
    const p = platform.trim().toUpperCase()

    // Americas
    if (['NA1', 'BR1', 'LA1', 'LA2'].includes(p)) return PlatformId.AMERICAS

    // Europe
    if (['EUW1', 'EUN1', 'EUNE1', 'TR1', 'RU', 'ME1'].includes(p)) return PlatformId.EUROPE

    // Asia
    if (['KR', 'JP1'].includes(p)) return PlatformId.ASIA

    // SEA
    if (['OC1', 'PH2', 'SG2', 'TH2', 'TW2', 'VN2'].includes(p)) return PlatformId.SEA

    // Default to europe (most common for this codebase)
    return PlatformId.EUROPE
  }
}

export default new RiotApiService()
