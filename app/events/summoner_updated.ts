import { BaseEvent } from '@adonisjs/core/events'

export default class SummonerUpdated extends BaseEvent {
  constructor(
    public puuid: string,
    public region: string
  ) {
    super()
  }
}
