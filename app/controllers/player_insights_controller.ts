import { normalizePlatform } from '#services/riot/routing'
import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import cache from '@adonisjs/cache/services/main'
import env from '#start/env'
import Summoner from '#models/summoner'
import Rank from '#models/rank'
import statsRepository from '#services/analytics/stats_repository'
import { puuidParamsValidator } from '#validators/summoner'
import { translateRiotError } from '#utils/riot_errors'

/** Current PUUID APIs; the installed Riot SDK still targets the retired spectator API. */
export default class PlayerInsightsController {
  private async get(puuid: string, kind: 'mastery' | 'live') {
    const player = await Summoner.findBy('puuid', puuid)
    if (!player) throw new Exception('Player not found', { status: 404 })
    const platform = normalizePlatform(player.platform).toLowerCase()
    return cache.getOrSet({
      key: `player-insights:${platform}:${puuid}:${kind}`,
      ttl: kind === 'live' ? '30s' : '1h',
      factory: async () => {
        const path =
          kind === 'live'
            ? `spectator/v5/active-games/by-summoner/${encodeURIComponent(puuid)}`
            : `champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(puuid)}`
        let res: Response
        try {
          res = await fetch(`https://${platform}.api.riotgames.com/lol/${path}`, {
            headers: { 'X-Riot-Token': env.get('RIOT_API_KEY') },
            signal: AbortSignal.timeout(12_000),
          })
        } catch {
          throw new Exception('Riot is temporarily unavailable', { status: 503 })
        }
        if (kind === 'live' && res.status === 404) return { game: null }
        if (!res.ok) throw translateRiotError({ status: res.status })
        const data: any = await res.json()
        if (kind === 'mastery')
          return data.map((entry: any) => ({
            championId: entry.championId,
            championLevel: entry.championLevel,
            championPoints: entry.championPoints,
            lastPlayTime: entry.lastPlayTime,
            championPointsUntilNextLevel: entry.championPointsUntilNextLevel,
            tokensEarned: entry.tokensEarned,
          }))
        // Enrich from already tracked games; avoid 20 additional Riot calls per lobby.
        const ids = data.participants
          .map((p: any) => p.puuid)
          .filter((id: unknown) => typeof id === 'string' && /^[a-zA-Z0-9_-]{78}$/.test(id))
        const ranks = ids.length
          ? await Rank.query()
              .whereIn('puuid', ids)
              .where('queueType', 'RANKED_SOLO_5x5')
              .distinctOn('puuid')
              .orderBy('puuid')
              .orderBy('fetchedAt', 'desc')
              .catch(() => [])
          : []
        const participants = await Promise.all(
          data.participants.map(async (p: any) => {
            const champions = ids.includes(p.puuid)
              ? await statsRepository.getSummonerChampionStats(p.puuid, 100).catch(() => [])
              : []
            const champion = champions.find((c) => c.championId === p.championId)
            const rank = ranks.find((r) => r.puuid === p.puuid)
            return {
              puuid: p.puuid,
              riotId: p.riotId,
              championId: p.championId,
              teamId: p.teamId,
              spell1Id: p.spell1Id,
              spell2Id: p.spell2Id,
              perks: p.perks,
              championStats: champion ? { games: champion.games, winrate: champion.winrate } : null,
              rank: rank
                ? { tier: rank.tier, division: rank.division, leaguePoints: rank.leaguePoints }
                : null,
            }
          })
        )
        // Do not send spectator observer credentials to the browser.
        return {
          game: {
            gameId: data.gameId,
            gameStartTime: data.gameStartTime,
            gameLength: data.gameLength,
            gameQueueConfigId: data.gameQueueConfigId,
            bannedChampions: data.bannedChampions,
            participants,
          },
        }
      },
    })
  }

  async mastery({ params, request, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: params })
    return response.ok(await this.get(params.puuid, 'mastery'))
  }

  async live({ params, request, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: params })
    return response.ok(await this.get(params.puuid, 'live'))
  }
}
