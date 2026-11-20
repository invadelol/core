import { platformRegion } from './routing.js'
import env from '#start/env'
import { RiotAPI, RiotAPITypes, PlatformId } from '@fightmegg/riot-api'
import { ACCOUNT_REGION_METHOD, CoalescingRiotAPI } from './client.js'

export type { RiotAPITypes }

/**
 * Riot API client wrapper
 */
export class RiotApiService {
  public client: RiotAPI

  constructor() {
    this.client = new CoalescingRiotAPI(env.get('RIOT_API_KEY'))
  }

  /**
   * The server a Riot account plays League on (`euw1`). One account can also hold summoners on
   * other servers, left behind by a transfer or made for a trip; they answer summoner-v4 too.
   */
  public accountRegion(cluster: 'europe' | 'americas' | 'asia', puuid: string) {
    return this.client
      .request<{
        puuid: string
        game: string
        region: string
      }>(
        cluster as PlatformId,
        ACCOUNT_REGION_METHOD as Parameters<RiotAPI['request']>[1],
        { game: 'lol', puuid },
        { id: `${cluster}.account.getRegionByGame.lol.${puuid}`, priority: 4 }
      )
      .then((answer) => answer.region)
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
