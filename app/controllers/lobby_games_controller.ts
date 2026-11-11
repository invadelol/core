import type { HttpContext } from '@adonisjs/core/http'
import lobbyGamesService, { LOBBY_GAMES_MAX } from '#services/lobby_games_service'
import rateLimiter from '#services/desktop/rate_limiter'
import { lobbyGamesValidator } from '#validators/lobby'

/** Lobbies an address may ask about per hour: far above what playing allows. */
const PER_HOUR = 240

/** The stored games of a lobby's players, for the desktop app's scouting. */
export default class LobbyGamesController {
  /**
   * Each player's latest stored games (their own line of each), newest first. Read from what is
   * already stored only: no Riot request is ever made for it, and a player never stored here is
   * answered `known: false`. The players are sent in the body, so no Riot ID is in an address.
   * @requestBody {"platform":"EUW1","count":40,"players":[{"gameName":"Northwind","tagLine":"EUW"}]}
   * @responseBody 200 - {"players":[{"gameName":"Northwind","tagLine":"EUW","known":true,"games":[{"matchId":"EUW1_1","startMs":0,"duration":1800,"queueId":420,"championId":266,"teamId":100,"win":true,"kills":5,"deaths":2,"assists":7,"position":"TOP","items":[0,0,0,0,0,0,0],"spells":[4,12],"keystone":8010,"primary":8000,"sub":8400}]}]}
   * @responseBody 429 - Too many lobbies from this address
   */
  async show({ request, response }: HttpContext) {
    const hit = await rateLimiter.hit('lobby-games', request.ip(), PER_HOUR)
    if (!hit.allowed) {
      response.header('Retry-After', String(hit.retryAfter))
      return response.status(429).send({ error: 'Too many requests, try again later' })
    }
    const { players, platform, count } = await request.validateUsing(lobbyGamesValidator)
    response.header('Cache-Control', 'no-store')
    return response.ok({
      players: await lobbyGamesService.games(players, platform, count ?? LOBBY_GAMES_MAX),
    })
  }
}
