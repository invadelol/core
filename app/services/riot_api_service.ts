import env from '#start/env'
import { RiotAPI, RiotAPITypes } from '@fightmegg/riot-api'

export type { RiotAPITypes }

export default class RiotApiService {
  public client: RiotAPI

  constructor() {
    this.client = new RiotAPI(env.get('RIOT_API_KEY'))
  }

  public platformToRegion(platform: string): string {
    const p = platform.trim().toUpperCase()

    // Americas
    if (['NA1', 'BR1', 'LA1', 'LA2', 'OC1'].includes(p)) return 'americas'

    // Europe
    if (['EUW1', 'EUN1', 'TR1', 'RU'].includes(p)) return 'europe'

    // Asia
    if (['KR', 'JP1'].includes(p)) return 'asia'

    // SEA
    if (['PH2', 'SG2', 'TH2', 'TW2', 'VN2'].includes(p)) return 'sea'

    // Default to europe (most common for this codebase); callers should pass the right platform.
    return 'europe'
  }
}
