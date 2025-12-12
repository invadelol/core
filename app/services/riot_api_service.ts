import env from '#start/env'
import { RiotAPI, RiotAPITypes } from '@fightmegg/riot-api'

export type { RiotAPITypes }

export default class RiotApiService {
  public client: RiotAPI

  constructor() {
    this.client = new RiotAPI(env.get('RIOT_API_KEY'))
  }
}
