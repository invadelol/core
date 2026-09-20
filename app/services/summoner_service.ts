import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'
import cache from '@adonisjs/cache/services/main'
import db from '@adonisjs/lucid/services/db'
import type { ModelObject } from '@adonisjs/lucid/types/model'

import { resolvePlayer } from '#services/riot/player_resolver'
import { normalizePlatform } from '#services/riot/routing'
import type { RiotAPITypes } from '#services/riot/api'
import riotApiService from '#services/riot/api'
import statsRepository from '#services/analytics/stats_repository'
import matchRepository from '#services/analytics/match_repository'
import Summoner from '#models/summoner'
import SummonerHistory from '#models/summoner_history'
import Rank from '#models/rank'
import { QUEUE_IDS, type RiotQueueType, type RiotRole } from '#constants/riot'
import {
  SEARCH_CACHE_TTL,
  STORED_PROFILE_CACHE_TTL,
  DEFAULT_STATS_COUNT,
  DEFAULT_MATCH_COUNT,
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  DEFAULT_OFFSET,
} from '#config/constants'

/**
 * The model's own columns, named explicitly.
 *
 * `riot_player` also carries a `search_vector` tsvector that the full-text
 * index is built from. Lucid drops it on the way out, but `select *` still
 * pulls it across the wire on every profile read and every search result.
 */
const SUMMONER_COLUMNS: string[] = [
  'puuid',
  'platform',
  'game_name',
  'tag_line',
  'profile_icon_id',
  'summoner_level',
  'last_refresh_at',
  'view_count',
  'created_at',
]

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

    let decoded = summoner
    try {
      decoded = decodeURIComponent(summoner)
    } catch {
      // Keep original if decoding fails
    }

    const lastHyphenIndex = decoded.lastIndexOf('-')
    if (lastHyphenIndex === -1) return null

    const gameName = decoded.substring(0, lastHyphenIndex)
    const tagLine = decoded.substring(lastHyphenIndex + 1)

    if (!gameName || !tagLine) return null

    return { gameName, tagLine }
  }

  /**
   * The stored row for a Riot ID, without ever calling Riot.
   *
   * Used as a fallback when the upstream lookup fails: a profile we already
   * hold is better than an error page, even if it is a little stale.
   */
  async findStored(summoner: string, platform?: string): Promise<Summoner | null> {
    const normalized = this.normalize(summoner)
    if (!normalized) return null

    const { gameName, tagLine } = normalized
    const query = Summoner.query().select(SUMMONER_COLUMNS).where({ gameName, tagLine })
    if (platform) query.where('platform', normalizePlatform(platform))
    return query.orderBy('lastRefreshAt', 'desc').first()
  }

  /**
   * The identity fields the profile page renders, cached.
   *
   * This runs on every server-rendered profile view, in front of the HTML, so
   * it is the one query that delays first paint. The values it returns change
   * only when a player renames or changes icon, which makes a short cache
   * essentially free and takes Postgres off the render path for anyone
   * popular enough to be viewed more than once a minute.
   */
  async findStoredProfile(summoner: string, platform?: string) {
    const normalized = this.normalize(summoner)
    if (!normalized) return null

    const { gameName, tagLine } = normalized
    return cache.getOrSet({
      key: `summoner:profile:${platform ?? 'auto'}:${gameName.toLowerCase()}:${tagLine.toLowerCase()}`,
      ttl: STORED_PROFILE_CACHE_TTL,
      factory: async () => {
        const stored = await this.findStored(summoner, platform)

        if (!stored) return null
        return {
          puuid: stored.puuid,
          gameName: stored.gameName,
          tagLine: stored.tagLine,
          platform: stored.platform,
          profileIconId: stored.profileIconId,
          summonerLevel: stored.summonerLevel,
        }
      },
    })
  }

  /**
   * Resolve a Riot ID ("GameName-TagLine") into a persisted `Summoner` row.
   */
  private resolving = new Map<string, Promise<Summoner>>()

  async resolveAndUpsert(
    summoner: string,
    platform?: string,
    options: { refresh: boolean } = { refresh: false }
  ): Promise<Summoner> {
    const normalized = this.normalize(summoner)
    const key = JSON.stringify([
      normalized?.gameName.toLowerCase(),
      normalized?.tagLine.toLowerCase(),
      platform ? normalizePlatform(platform) : 'auto',
      options.refresh,
    ])
    const pending = this.resolving.get(key)
    if (pending) return pending
    const lookup = this.resolveAndPersist(summoner, platform, options).finally(() =>
      this.resolving.delete(key)
    )
    this.resolving.set(key, lookup)
    return lookup
  }

  private async resolveAndPersist(
    summoner: string,
    platform?: string,
    options: { refresh: boolean } = { refresh: false }
  ): Promise<Summoner> {
    const normalized = this.normalize(summoner)
    if (!normalized) {
      throw new Exception('Invalid summoner format. Expected "GameName-TagLine".', { status: 422 })
    }

    const stored = await this.findStored(summoner, platform)
    if (!options.refresh && stored) return stored

    const resolved = await resolvePlayer(
      {
        account: (region, gameName, tagLine) =>
          riotApiService.client.account.getByRiotId({
            region: region as RiotAPITypes.Cluster & ('europe' | 'americas' | 'asia'),
            gameName,
            tagLine,
          }),
        summoner: (region, puuid) =>
          riotApiService.client.summoner.getByPUUID({
            region: region.toLowerCase() as RiotAPITypes.LoLRegion,
            puuid,
          }),
      },
      normalized.gameName,
      normalized.tagLine,
      platform,
      stored?.platform
    )
    const { puuid } = resolved.account
    const gameName = resolved.account.gameName ?? normalized.gameName
    const tagLine = resolved.account.tagLine ?? normalized.tagLine
    const { profileIconId, summonerLevel } = resolved.details
    platform = resolved.platform

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
      view?: 'summary' | 'full'
      type?: RiotQueueType
      count?: number
      offset?: number
      champion?: number
      role?: RiotRole
    }
  ) {
    const queueIds = filters.type && filters.type !== 'all' ? QUEUE_IDS[filters.type] || [] : []

    return matchRepository.getByPuuid(puuid, {
      queueIds,
      view: filters.view,
      count: filters.count ?? DEFAULT_MATCH_COUNT,
      offset: filters.offset ?? DEFAULT_OFFSET,
      championId: filters.champion,
      role: filters.role,
    })
  }

  /**
   * Records a profile view and returns the new total.
   *
   * One statement rather than a read followed by a write: it halves the round
   * trips and, more importantly, it is atomic. Two people opening the same
   * profile at once used to read the same number and write back the same
   * increment, losing one of the views.
   */
  async incrementViewCount(puuid: string): Promise<bigint | null> {
    const result = await db
      .from('riot_player')
      .where('puuid', puuid)
      .increment('view_count', 1)
      .returning('view_count')

    const viewCount = (result as Array<{ view_count: string | number }>)[0]?.view_count
    return viewCount === undefined || viewCount === null ? null : BigInt(viewCount)
  }

  /**
   * Search summoners by name using tsvector full-text search
   */
  async search(query: string, limit: number = DEFAULT_SEARCH_LIMIT): Promise<ModelObject[]> {
    if (!query || query.trim().length === 0) return []

    const sanitized = query
      .trim()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .trim()
    if (!sanitized) return []

    // to_tsquery requires terms to be joined with operators, so a multi-word
    // search like "MRS Paulux" must become "MRS:* & Paulux:*"
    const tsquery = sanitized
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `${term}:*`)
      .join(' & ')

    const capped = Math.min(limit, MAX_SEARCH_LIMIT)

    // Typeahead sends a request per pause in typing, and the popular prefixes
    // are the same for everyone. A short cache turns the common case into a
    // memory read and keeps the GIN scan off Postgres entirely.
    return cache.getOrSet({
      key: `summoner:search:${capped}:${tsquery}`,
      ttl: SEARCH_CACHE_TTL,
      factory: async () => {
        const results = await Summoner.query()
          .select(SUMMONER_COLUMNS)
          .whereRaw(`search_vector @@ to_tsquery('simple', ?)`, [tsquery])
          .orderBy('viewCount', 'desc')
          .limit(capped)

        // `view_count` is a bigint, which the cache's JSON serializer cannot
        // encode. The response already sent it as a string, because that is
        // what Adonis' own serializer does with a bigint, so producing the
        // string here keeps the payload byte-for-byte what it always was.
        return results.map((summoner) => ({
          ...summoner.serialize(),
          viewCount: summoner.viewCount.toString(),
        }))
      },
    })
  }

  async updateRanks(puuid: string, region: string) {
    const entries = await riotApiService.client.league.getEntriesByPUUID({
      region: region as any,
      puuid,
    })

    if (!entries.length) return

    // One `DISTINCT ON` read for the newest row per queue, rather than a
    // query per queue followed by an insert per queue. `riot_rank_latest_idx`
    // is ordered (puuid, queue_type, fetched_at DESC), which is exactly the
    // order this asks for, so it reads one row per queue straight off the index.
    const latest = await db
      .from('riot_rank')
      .distinctOn('queue_type')
      .select('queue_type', 'tier', 'division', 'league_points', 'wins', 'losses')
      .where('puuid', puuid)
      .whereIn(
        'queue_type',
        entries.map((entry) => entry.queueType)
      )
      .orderBy('queue_type')
      .orderBy('fetched_at', 'desc')

    const byQueue = new Map(latest.map((row) => [row.queue_type, row]))
    const fetchedAt = DateTime.now()

    const changed = entries
      .filter((entry) => {
        const previous = byQueue.get(entry.queueType)
        return (
          !previous ||
          previous.tier !== entry.tier ||
          previous.division !== entry.rank ||
          previous.league_points !== entry.leaguePoints ||
          previous.wins !== entry.wins ||
          previous.losses !== entry.losses
        )
      })
      .map((entry) => ({
        puuid,
        queueType: entry.queueType,
        tier: entry.tier,
        division: entry.rank,
        leaguePoints: entry.leaguePoints,
        wins: entry.wins,
        losses: entry.losses,
        fetchedAt,
      }))

    if (changed.length) await Rank.createMany(changed)
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
    const validParticipants = participants.filter((p) => p.puuid && p.gameName && p.tagLine)
    if (!validParticipants.length) return 0

    const puuids = validParticipants.map((p) => p.puuid)
    const existingSummoners = await Summoner.query().whereIn('puuid', puuids)
    const existingMap = new Map<string, Summoner>()

    for (const summoner of existingSummoners) {
      existingMap.set(summoner.puuid, summoner)
    }

    const historyToCreate: Array<{
      puuid: string
      gameName: string
      tagLine: string
      profileIconId: number
    }> = []

    const summonersToUpsert = validParticipants.map((p) => {
      const existing = existingMap.get(p.puuid) || null

      if (this.hasChanged(existing, p.gameName, p.tagLine, p.profileIconId)) {
        historyToCreate.push({
          puuid: p.puuid,
          gameName: p.gameName,
          tagLine: p.tagLine,
          profileIconId: p.profileIconId,
        })
      }

      return {
        puuid: p.puuid,
        platform,
        gameName: p.gameName,
        tagLine: p.tagLine,
        profileIconId: p.profileIconId,
        summonerLevel: p.summonerLevel,
      }
    })

    await Summoner.updateOrCreateMany('puuid', summonersToUpsert)

    if (historyToCreate.length > 0) {
      await SummonerHistory.createMany(historyToCreate)
    }

    return summonersToUpsert.length
  }
}

export default new SummonerService()
