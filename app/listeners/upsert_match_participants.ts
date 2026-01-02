import SummonerUpdated from '#events/summoner_updated'
import summonerService from '#services/summoner_service'
import clickhouseService from '#services/clickhouse_service'

export default class UpsertMatchParticipants {
    async handle(event: SummonerUpdated) {
        const participants = await clickhouseService.getRecentMatchParticipants(event.puuid)

        if (participants.length) {
            await summonerService.upsertFromParticipants(participants, event.region)
        }
    }
}
