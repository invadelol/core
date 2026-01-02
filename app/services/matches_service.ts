import riotApiService, { type RiotAPITypes } from '#services/riot/api'
import matchRepository from '#services/analytics/match_repository'
import ingestionService from '#services/analytics/ingestion_service'
import SummonerUpdated from '#events/summoner_updated'
import Summoner from '#models/summoner'
import compressionService from '#services/compression_service'
import drive from '@adonisjs/drive/services/main'
import type { PlatformId } from '@fightmegg/riot-api'
import { DEFAULT_MATCH_COUNT } from '#config/constants'

type MatchCluster = Exclude<RiotAPITypes.Cluster, PlatformId.ESPORTS>

class MatchesService {
  async update(puuid: string, cluster: MatchCluster) {
    const matchIds = await riotApiService.client.matchV5.getIdsByPuuid({
      puuid,
      cluster,
      params: {
        count: DEFAULT_MATCH_COUNT,
      },
    })

    if (!matchIds.length) {
      return []
    }

    const existingIds = await matchRepository.getExistingMatchIds(matchIds)
    const newIds = matchIds.filter((id) => !existingIds.has(id))

    if (!newIds.length) {
      return []
    }

    const results = await Promise.all(
      newIds.map((matchId) => this.fetchAndStoreMatch(matchId, cluster))
    )

    const summoner = await Summoner.find(puuid)
    if (summoner) {
      SummonerUpdated.dispatch(puuid, summoner.platform)
    }

    return results
  }

  async fetchAndStoreMatch(matchId: string, cluster: MatchCluster) {
    const matchData = await riotApiService.client.matchV5.getMatchById({
      matchId,
      cluster,
    })

    const filePath = `matches/${matchId}.json`
    const r2 = drive.use('r2')

    const fileExists = await r2.exists(filePath)
    if (!fileExists) {
      const compressed = await compressionService.compress(matchData)
      await r2.put(filePath, compressed)
    }

    const meta = await ingestionService.ingestMatch(matchId, matchData)

    return {
      matchId,
      ...meta,
    }
  }
}

export default new MatchesService()
