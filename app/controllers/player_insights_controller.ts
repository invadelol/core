import type { HttpContext } from '@adonisjs/core/http'
import playerInsightsService from '#services/player_insights_service'
import liveService from '#services/live/live_service'
import { FixedWindowLimiter } from '#services/desktop/rate_limiter'
import { getMasteryValidator, puuidParamsValidator } from '#validators/summoner'

/** Live checks that reach Riot, per address and window: a player looking up games, never a script. */
const LIVE_PER_WINDOW = 30
const LIVE_WINDOW_SECONDS = 600
const liveLimiter = new FixedWindowLimiter('live:rl:')

/** Champion mastery and the live game, read from Riot's PUUID APIs. */
export default class PlayerInsightsController {
  /**
   * Champion mastery, most points first when `count` is given. Each entry
   * carries `source` (`riot` or `desktop`) and `observedAt` (epoch ms).
   */
  async mastery({ params, request, response }: HttpContext) {
    await request.validateUsing(puuidParamsValidator, { data: params })
    const { count } = await request.validateUsing(getMasteryValidator, { data: request.qs() })
    if (count) return response.ok(await playerInsightsService.top(params.puuid, count))
    return response.ok(await playerInsightsService.mastery(params.puuid))
  }

  /**
   * The game a stored player is in right now (`game: null` between games), asked of Riot only
   * here, when their profile's Live section is opened. `?again=1` asks anew once the kept answer
   * is old enough (`live_service.ts`).
   * @responseBody 200 - {"game":null,"checkedAt":0}
   * @responseBody 429 - Too many checks from this address
   */
  async live({ params, request, response }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    await request.validateUsing(puuidParamsValidator, { data: params })
    const again = ['1', 'true'].includes(String(request.qs().again ?? ''))
    let retryAfter = 0
    try {
      return response.ok(
        await liveService.check(params.puuid, again, async () => {
          const hit = await liveLimiter.hit(
            'ip',
            request.ip(),
            LIVE_PER_WINDOW,
            LIVE_WINDOW_SECONDS
          )
          if (hit.allowed) return
          retryAfter = hit.retryAfter
          throw new LiveLimitReached()
        })
      )
    } catch (error) {
      if (!(error instanceof LiveLimitReached)) throw error
      response.header('Retry-After', String(retryAfter))
      return response
        .status(429)
        .send({ error: 'Too many live checks, try again later', retryAfter })
    }
  }
}

/** This address asked Riot for live games too often in the window. */
class LiveLimitReached extends Error {}
