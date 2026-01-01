import riotApiService from '#services/riot_api_service'
import type { RiotAPITypes } from '#services/riot_api_service'
import SummonerUpdated from '#events/summoner_updated'
import Summoner from '#models/summoner'
import clickhouseService from '#services/clickhouse_service'
import compressionService from '#services/compression_service'
import drive from '@adonisjs/drive/services/main'
import type { PlatformId } from '@fightmegg/riot-api'

type MatchCluster = Exclude<RiotAPITypes.Cluster, PlatformId.ESPORTS>

class MatchesService {
  async update(puuid: string, cluster: MatchCluster) {
    const matchIds = await riotApiService.client.matchV5.getIdsByPuuid({
      puuid,
      cluster,
      params: {
        count: 15,
      },
    })

    if (!matchIds.length) {
      return []
    }

    const existingIds = await clickhouseService.getExistingMatchIds(matchIds)
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

    // Check if file already exists in R2 to avoid write conflicts
    const fileExists = await r2.exists(filePath)
    if (!fileExists) {
      const compressed = await compressionService.compress(matchData)
      await r2.put(filePath, compressed)
    }

    const meta = await clickhouseService.ingestMatch(matchId, matchData)

    return {
      matchId,
      ...meta,
    }
  }
}

export default new MatchesService()
