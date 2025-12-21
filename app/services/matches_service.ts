import riotApiService from '#services/riot_api_service'
import type { RiotAPITypes } from '#services/riot_api_service'
import clickhouseService from '#services/clickhouse_service'
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

    return await Promise.all(newIds.map((matchId) => this.fetchAndStoreMatch(matchId, cluster)))
  }

  async fetchAndStoreMatch(matchId: string, cluster: MatchCluster) {
    const matchData = await riotApiService.client.matchV5.getMatchById({
      matchId,
      cluster,
    })

    await drive.use('r2').put(`matches/${matchId}.json`, JSON.stringify(matchData))

    const meta = await clickhouseService.ingestMatch(matchId, matchData)

    // add something to process more the matches, like extract the summoner to store them in pg
    // or process other things like ranks etc..

    return {
      matchId,
      ...meta,
    }
  }
}

export default new MatchesService()
