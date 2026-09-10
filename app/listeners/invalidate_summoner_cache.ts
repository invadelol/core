import SummonerUpdated from '#events/summoner_updated'
import { invalidateResponseCache } from '#services/http_response_cache'

export default class InvalidateSummonerCache {
  async handle(event: SummonerUpdated) {
    await invalidateResponseCache([`summoner:${event.puuid}`])
  }
}
