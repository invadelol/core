import SummonerUpdated from '#events/summoner_updated'
import summonerService from '#services/summoner_service'

export default class UpdateSummonerRank {
    async handle(event: SummonerUpdated) {
        await summonerService.updateRanks(event.puuid, event.region)
    }
}
