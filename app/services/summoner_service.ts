import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'

import riotApiService from '#services/riot_api_service'
import Summoner from '#models/summoner'
import SummonerHistory from '#models/summoner_history'

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
   *
   * - Checks database first (unless `refresh`)
   * - Uses Account-V1 to resolve `puuid` from Riot ID
   * - Uses Summoner-V4 to get profile icon + level
   * - Upserts `riot_player` and appends `riot_player_history` if data changed
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
}

export default new SummonerService()
