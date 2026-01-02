import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'

import riotApiService from '#services/riot/api'
import statsRepository from '#services/analytics/stats_repository'
import matchRepository from '#services/analytics/match_repository'
import Summoner from '#models/summoner'
import SummonerHistory from '#models/summoner_history'
import Rank from '#models/rank'
import { QUEUE_IDS, type RiotQueueType, type RiotRole } from '#services/riot/constants'
import {
  DEFAULT_STATS_COUNT,
  DEFAULT_MATCH_COUNT,
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  DEFAULT_OFFSET,
} from '#config/constants'

class SummonerService {
  /**
   * Checks if summoner data (gameName, tagLine, profileIconId) has changed.
   * Returns true if summoner is new or if any tracked field changed.
   */
  private hasChanged(
    existing: Summoner | null,
    gameName: string,
    tagLine: string,
    profileIconId: number
  ): boolean {
    if (!existing) return true

    return (
      existing.gameName !== gameName ||
      existing.tagLine !== tagLine ||
      existing.profileIconId !== profileIconId
    )
  }

  /**
   * Normalizes summoner name from "GameName-TagLine" format.
   * Decodes any existing URL encoding to prevent double-encoding issues.
   * @param summoner - Summoner name
   * @returns Normalized object with gameName and tagLine, or null if invalid
   */
  normalize(summoner: string): { gameName: string; tagLine: string } | null {
    if (!summoner) return null

    const [gameName, tagLine] = summoner.split('-', 2)
    if (!gameName || !tagLine) return null

    const decode = (s: string) => {
      try {
        return decodeURIComponent(s)
      } catch {
        return s
      }
    }

    return { gameName: decode(gameName), tagLine: decode(tagLine) }
  }

  /**
   * Resolve a Riot ID ("GameName-TagLine") into a persisted `Summoner` row.
   */
  async resolveAndUpsert(
    summoner: string,
    platform: string,
    options: { refresh: boolean } = { refresh: false }
  ): Promise<Summoner> {
    const normalized = this.normalize(summoner)
    if (!normalized) {
      throw new Exception('Invalid summoner format. Expected "GameName-TagLine".', { status: 422 })
    }

    const { gameName, tagLine } = normalized

    if (!options.refresh) {
      const existing = await Summoner.query().where({ platform, gameName, tagLine }).first()
      if (existing) return existing
    }

    const region = riotApiService.platformToRegion(platform)

    const account = await riotApiService.client.account.getByRiotId({
      region: region as any,
      gameName,
      tagLine,
    })

    const puuid = account.puuid
    if (!puuid) {
      throw new Exception('Summoner not found', { status: 404 })
    }

    const summonerDto = await riotApiService.client.summoner.getByPUUID({
      region: platform as any,
      puuid,
    })

    if (!summonerDto) {
      throw new Exception('Summoner details not found', { status: 404 })
    }

    const profileIconId = summonerDto.profileIconId
    const summonerLevel = summonerDto.summonerLevel

    const existing = await Summoner.find(puuid)
    const player = await Summoner.updateOrCreate(
      { puuid },
      {
        puuid,
        platform,
        gameName,
        tagLine,
        profileIconId,
        summonerLevel,
        lastRefreshAt: DateTime.now(),
      }
    )

    if (this.hasChanged(existing, gameName, tagLine, profileIconId)) {
      await SummonerHistory.create({
        puuid: player.puuid,
        gameName: player.gameName,
        tagLine: player.tagLine,
        profileIconId: player.profileIconId,
      })
    }

    return player
  }

  async getActivity(puuid: string) {
    return statsRepository.getSummonerActivity(puuid)
  }

  async getFriends(puuid: string) {
    return statsRepository.getSummonerFriends(puuid)
  }

  async getRanks(puuid: string) {
    const history = await Rank.query().where('puuid', puuid).orderBy('fetchedAt', 'desc')

    const currentMap = new Map<string, Rank>()
    for (const rank of history) {
      if (!currentMap.has(rank.queueType)) {
        currentMap.set(rank.queueType, rank)
      }
    }

    return {
      current: Array.from(currentMap.values()),
      history,
    }
  }

  async getStats(
    puuid: string,
    filters: {
      type?: RiotQueueType
      count?: number
      champion?: number
      role?: RiotRole
    }
  ) {
    const queueIds = filters.type && filters.type !== 'all' ? QUEUE_IDS[filters.type] || [] : []

    return statsRepository.getSummonerStats(puuid, {
      queueIds,
      count: filters.count ?? DEFAULT_STATS_COUNT,
      championId: filters.champion,
      role: filters.role,
    })
  }

  async getChampionStats(puuid: string, count?: number) {
    return statsRepository.getSummonerChampionStats(puuid, count ?? DEFAULT_STATS_COUNT)
  }

  async getMatches(
    puuid: string,
    filters: {
      type?: RiotQueueType
      count?: number
      offset?: number
      champion?: number
      role?: RiotRole
    }
  ) {
    const queueIds = filters.type && filters.type !== 'all' ? QUEUE_IDS[filters.type] || [] : []

    return matchRepository.getSummonerMatches(puuid, {
      queueIds,
      count: filters.count ?? DEFAULT_MATCH_COUNT,
      offset: filters.offset ?? DEFAULT_OFFSET,
      championId: filters.champion,
      role: filters.role,
    })
  }

  async incrementViewCount(puuid: string): Promise<Summoner | null> {
    const summoner = await Summoner.find(puuid)
    if (!summoner) return null

    summoner.viewCount = summoner.viewCount + 1n
    await summoner.save()

    return summoner
  }

  /**
   * Search summoners by name using tsvector full-text search
   */
  async search(query: string, limit: number = DEFAULT_SEARCH_LIMIT): Promise<Summoner[]> {
    if (!query || query.trim().length === 0) return []

    const sanitized = query.trim().replace(/[^a-zA-Z0-9\s]/g, '')
    if (!sanitized) return []

    return Summoner.query()
      .whereRaw(`search_vector @@ to_tsquery('simple', ?)`, [`${sanitized}:*`])
      .orderBy('viewCount', 'desc')
      .limit(Math.min(limit, MAX_SEARCH_LIMIT))
  }

  async updateRanks(puuid: string, region: string) {
    const entries = await riotApiService.client.league.getEntriesByPUUID({
      region: region as any,
      puuid,
    })

    for (const entry of entries) {
      const latestRank = await Rank.query()
        .where('puuid', puuid)
        .where('queueType', entry.queueType)
        .orderBy('fetchedAt', 'desc')
        .first()

      const hasChanged =
        !latestRank ||
        latestRank.tier !== entry.tier ||
        latestRank.division !== entry.rank ||
        latestRank.leaguePoints !== entry.leaguePoints ||
        latestRank.wins !== entry.wins ||
        latestRank.losses !== entry.losses

      if (hasChanged) {
        await Rank.create({
          puuid,
          queueType: entry.queueType,
          tier: entry.tier,
          division: entry.rank,
          leaguePoints: entry.leaguePoints,
          wins: entry.wins,
          losses: entry.losses,
          fetchedAt: DateTime.now(),
        })
      }
    }
  }

  /**
   * Upsert summoners from match participant data (no API calls).
   */
  async upsertFromParticipants(
    participants: Array<{
      puuid: string
      gameName: string
      tagLine: string
      profileIconId: number
      summonerLevel: number
    }>,
    platform: string
  ): Promise<number> {
    let upserted = 0

    for (const p of participants) {
      if (!p.puuid || !p.gameName || !p.tagLine) continue

      const existing = await Summoner.find(p.puuid)

      await Summoner.updateOrCreate(
        { puuid: p.puuid },
        {
          puuid: p.puuid,
          platform,
          gameName: p.gameName,
          tagLine: p.tagLine,
          profileIconId: p.profileIconId,
          summonerLevel: p.summonerLevel,
        }
      )

      if (this.hasChanged(existing, p.gameName, p.tagLine, p.profileIconId)) {
        await SummonerHistory.create({
          puuid: p.puuid,
          gameName: p.gameName,
          tagLine: p.tagLine,
          profileIconId: p.profileIconId,
        })
      }

      upserted++
    }

    return upserted
  }
}

export default new SummonerService()
