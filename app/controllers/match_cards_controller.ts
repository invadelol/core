import type { HttpContext } from '@adonisjs/core/http'
import riotAssets from '#services/riot/assets'
import { renderMatchCard } from '#services/match_card'
import matchShareService from '#services/match_share_service'
import { ByteCache } from '#utils/byte_cache'

/** About 75 KB a card: some 300 of the latest shares stay in memory. */
const cards = new ByteCache<Buffer>(24 * 1024 * 1024, 512)
const pending = new Map<string, Promise<{ body: Buffer; complete: boolean }>>()

/** Renders at once: a link pasted in a busy channel brings many crawlers, each a fresh card. */
const RENDERS = 2
let running = 0
const waiting: Array<() => void> = []
async function limited<T>(work: () => Promise<T>): Promise<T> {
  if (running >= RENDERS) await new Promise<void>((resolve) => waiting.push(resolve))
  running++
  try {
    return await work()
  } finally {
    running--
    waiting.shift()?.()
  }
}

/**
 * `/og/match/EUW1_7998180573/Name-Tag.jpg?v=…`: the share card of one player's game, the
 * match page's og:image (`match_card`). The page links it with `v`, a hash of everything drawn:
 * that URL never changes its picture and is kept for good; any other `v`, or none, gets the
 * current picture for five minutes.
 */
export default class MatchCardsController {
  async show({ params, request, response }: HttpContext) {
    const summoner = /^(.+)\.jpg$/.exec(String(params.file))?.[1]
    const share = summoner
      ? await matchShareService.find(String(params.matchId), summoner).catch(() => null)
      : null
    if (!share) {
      response.header('Cache-Control', 'public, max-age=60')
      return response.notFound()
    }
    const key = `${params.matchId}:${share.version}`
    let body = cards.get(key)
    let complete = true
    if (!body) {
      let job = pending.get(key)
      if (!job) {
        job = limited(async () => {
          const art = await riotAssets.get('centered', String(share.card.championId))
          const rendered = await renderMatchCard(share.card, art.placeholder ? undefined : art.body)
          // Without its art the card is still readable, but not worth keeping.
          if (!art.placeholder) cards.set(key, rendered, rendered.byteLength, 3_600_000)
          return { body: rendered, complete: !art.placeholder }
        }).finally(() => pending.delete(key))
        pending.set(key, job)
      }
      const result = await job
      body = result.body
      complete = result.complete
    }
    const current = request.qs().v === share.version
    response.header('Content-Type', 'image/jpeg')
    response.header(
      'Cache-Control',
      !complete
        ? 'no-store'
        : current
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=300'
    )
    return response.send(body)
  }
}
