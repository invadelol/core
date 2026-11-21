import logger from '@adonisjs/core/services/logger'
import { FETCH_TIMEOUT_MS } from '#constants/assets'

/** Raster images only: an SVG from elsewhere is never served from our origin. */
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
/** Types a storage bucket gives any file: the bytes then say what the image is. */
const GENERIC = new Set(['', 'binary/octet-stream', 'application/octet-stream'])
const MAX_BYTES = 2 * 1024 * 1024

export interface RemoteImage {
  body: Uint8Array
  contentType: string
}

/** A raster image's type from its first bytes (PNG, JPEG, WebP, GIF, AVIF), or null. */
export function sniffImageType(body: Uint8Array): string | null {
  const at = (offset: number, bytes: number[]) => bytes.every((b, i) => body[offset + i] === b)
  const text = (offset: number, s: string) =>
    at(
      offset,
      [...s].map((c) => c.charCodeAt(0))
    )
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (at(0, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (text(0, 'RIFF') && text(8, 'WEBP')) return 'image/webp'
  if (text(0, 'GIF87a') || text(0, 'GIF89a')) return 'image/gif'
  if (text(4, 'ftypavif') || text(4, 'ftypavis')) return 'image/avif'
  return null
}

/**
 * An image from a stored source address, read server-side so pages only ever name our origin:
 * http(s) only, raster types only, 2 MB at most. A file served with a generic binary type counts
 * when its bytes are one of those images. Null when it cannot be read.
 */
export async function fetchImage(
  url: string | null,
  what: object,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<RemoteImage | null> {
  if (!url || !/^https?:\/\//.test(url)) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (!res.ok || !(TYPES.has(type) || GENERIC.has(type))) return null
    const body = new Uint8Array(await res.arrayBuffer())
    if (body.byteLength > MAX_BYTES) return null
    const contentType = TYPES.has(type) ? type : sniffImageType(body)
    return contentType ? { body, contentType } : null
  } catch (error) {
    logger.warn({ ...what, reason: (error as Error)?.message }, 'remote image unavailable')
    return null
  }
}
