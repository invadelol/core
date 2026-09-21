import type { HttpContext } from '@adonisjs/core/http'
import summonerService from '#services/summoner_service'
import riotAssets from '#services/riot/assets'
import { renderSocialCard } from '#services/social_card'
import { ByteCache } from '#utils/byte_cache'
import { STATS_WINDOW } from '#config/constants'

const cards = new ByteCache<Buffer>(24 * 1024 * 1024, 128)
const pending = new Map<string, Promise<{ body: Buffer; complete: boolean }>>()

export default class SocialCardsController {
  async show({ params, response }: HttpContext) {
    const profile = await summonerService.findStoredProfile(params.summoner)
    if (!profile) return response.notFound()
    const key = `${profile.puuid}:${profile.gameName}:${profile.tagLine}`
    const cached = cards.get(key)
    let complete = true
    let body = cached
    if (!body) {
      let job = pending.get(key)
      if (!job) {
        job = (async () => {
          const [stats, champions] = await Promise.all([
            summonerService.getStats(profile.puuid, { count: STATS_WINDOW }).catch(() => null),
            summonerService.getChampionStats(profile.puuid, 100).catch(() => null),
          ])
          const champion = champions?.[0]?.championId
          const art = champion ? await riotAssets.get('splash', String(champion)) : null
          const ready = Boolean(stats && champions && (!champion || (art && !art.placeholder)))
          const rendered = await renderSocialCard(
            profile,
            stats?.global ?? null,
            art && !art.placeholder ? art.body : undefined
          )
          if (ready) cards.set(key, rendered, rendered.byteLength, 300_000)
          return { body: rendered, complete: ready }
        })().finally(() => pending.delete(key))
        pending.set(key, job)
      }
      const result = await job
      body = result.body
      complete = result.complete
    }
    response.header('Content-Type', 'image/png')
    response.header('Cache-Control', complete ? 'public, max-age=300' : 'no-store')
    return response.send(body)
  }
}
