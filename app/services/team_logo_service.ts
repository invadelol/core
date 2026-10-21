import logger from '@adonisjs/core/services/logger'
import { FETCH_TIMEOUT_MS } from '#constants/assets'
import { ByteCache } from '#utils/byte_cache'
import proService from '#services/pro_service'

/** Raster images only: an SVG from elsewhere is never served from our origin. */
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
const MAX_BYTES = 2 * 1024 * 1024
const HOUR = 3_600_000

export interface Logo {
  body: Uint8Array
  contentType: string
}

/**
 * Team logos from our own origin (`/cdn/team/:id`): the stored address is read server-side,
 * fetched once and kept in memory, so pages only ever name invade.lol.
 */
class TeamLogoService {
  #memory = new ByteCache<Logo | null>(32 * 1024 * 1024, 2048)
  #inFlight = new Map<string, Promise<Logo | null>>()

  get(teamId: string): Promise<Logo | null> {
    const hit = this.#memory.get(teamId)
    if (hit !== undefined) return Promise.resolve(hit)
    const pending = this.#inFlight.get(teamId)
    if (pending) return pending
    const load = this.load(teamId).finally(() => this.#inFlight.delete(teamId))
    this.#inFlight.set(teamId, load)
    return load
  }

  private async load(teamId: string): Promise<Logo | null> {
    const url = await proService.logoUrl(teamId)
    let logo: Logo | null = null
    if (url && /^https?:\/\//.test(url)) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
        const type = (res.headers.get('content-type') ?? '').split(';')[0].trim()
        const body = res.ok && TYPES.has(type) ? new Uint8Array(await res.arrayBuffer()) : null
        if (body && body.byteLength <= MAX_BYTES) logo = { body, contentType: type }
      } catch (error) {
        logger.warn({ err: error, teamId }, 'team logo unavailable')
      }
    }
    // A missing logo is remembered briefly, a found one for a day.
    this.#memory.set(teamId, logo, logo?.body.byteLength ?? 64, logo ? 24 * HOUR : HOUR / 4)
    return logo
  }
}

export default new TeamLogoService()
