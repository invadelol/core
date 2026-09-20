import { platformRegion } from './routing.js'
import env from '#start/env'
import { RiotAPI, RiotAPITypes, PlatformId } from '@fightmegg/riot-api'

export type { RiotAPITypes }

/**
 * Riot API client wrapper
 */
export class RiotApiService {
  public client: RiotAPI

  constructor() {
    this.client = new RiotAPI(env.get('RIOT_API_KEY'))
  }

  /**
   * Maps a platform ID (e.g., EUW1) to its regional routing cluster
   */
  public platformToRegion(
    platform: string
  ): PlatformId.EUROPE | PlatformId.AMERICAS | PlatformId.ASIA | PlatformId.SEA {
    return (
      {
        europe: PlatformId.EUROPE,
        americas: PlatformId.AMERICAS,
        asia: PlatformId.ASIA,
        sea: PlatformId.SEA,
      } as const
    )[platformRegion(platform)]
  }
}

export default new RiotApiService()
