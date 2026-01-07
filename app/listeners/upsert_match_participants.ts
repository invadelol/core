import SummonerUpdated from '#events/summoner_updated'
import summonerService from '#services/summoner_service'
import matchRepository from '#services/analytics/match_repository'

export default class UpsertMatchParticipants {
  async handle(event: SummonerUpdated) {
    const participants = await matchRepository.getRecentParticipants(event.puuid)

    if (participants.length) {
      await summonerService.upsertFromParticipants(participants, event.region)
    }
  }
}
