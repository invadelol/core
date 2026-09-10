import SummonerUpdated from '#events/summoner_updated'
import { invalidateResponseCache } from '#services/http_response_cache'
import summonerService from '#services/summoner_service'

export default class UpdateSummonerRank {
  async handle(event: SummonerUpdated) {
    await summonerService.updateRanks(event.puuid, event.region)
    await invalidateResponseCache([`summoner:${event.puuid}`])
  }
}
