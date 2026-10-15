import type { HttpContext } from '@adonisjs/core/http'
import riotAssets from '#services/riot/assets'
import { parsePresenceQuery, renderPresenceCard } from '#services/presence_card'
import { ByteCache } from '#utils/byte_cache'

const cards = new ByteCache<Buffer>(16 * 1024 * 1024, 512)

/**
 * `/presence/103.png?k=7&d=2&a=9&r=mid`: the picture of the desktop app's Discord presence
 * (`presence_card`). The same query always draws the same picture, so Discord's media proxy and
 * browsers may keep it.
 */
export default class PresenceCardsController {
  async show({ params, request, response }: HttpContext) {
    const champion = /^(\d{1,4})\.png$/.exec(String(params.file))?.[1]
    const card = champion ? parsePresenceQuery(request.qs()) : null
    if (!champion || !card) return response.notFound()
    const key = `${champion}:${card.kills}/${card.deaths}/${card.assists}:${card.role ?? ''}:${card.respawn ?? ''}`
    let body = cards.get(key)
    if (!body) {
      const art = await riotAssets.get('centered', champion)
      // An unknown champion, or the art unavailable for now: nothing worth keeping.
      if (art.placeholder) {
        response.header('Cache-Control', 'no-store')
        return response.notFound()
      }
      body = await renderPresenceCard(card, art.body)
      cards.set(key, body, body.byteLength, 3_600_000)
    }
    response.header('Content-Type', 'image/png')
    response.header('Cache-Control', 'public, max-age=86400, immutable')
    return response.send(body)
  }
}
