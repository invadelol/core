import logger from '@adonisjs/core/services/logger'
import { FETCH_TIMEOUT_MS } from '#constants/assets'

/** Raster images only: an SVG from elsewhere is never served from our origin. */
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
const MAX_BYTES = 2 * 1024 * 1024

export interface RemoteImage {
  body: Uint8Array
  contentType: string
}

/**
 * An image from a stored source address, read server-side so pages only ever name our origin:
 * http(s) only, raster types only, 2 MB at most. Null when it cannot be read.
 */
export async function fetchImage(
  url: string | null,
  what: object,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<RemoteImage | null> {
  if (!url || !/^https?:\/\//.test(url)) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim()
    const body = res.ok && TYPES.has(type) ? new Uint8Array(await res.arrayBuffer()) : null
    return body && body.byteLength <= MAX_BYTES ? { body, contentType: type } : null
  } catch (error) {
    logger.warn({ ...what, reason: (error as Error)?.message }, 'remote image unavailable')
    return null
  }
}
