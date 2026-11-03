import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import sharp from 'sharp'
import { FETCH_TIMEOUT_MS } from '#constants/assets'
import { ByteCache } from '#utils/byte_cache'
import proService from '#services/pro_service'
import { leagueBySlug } from '#services/pro_leagues'

/** Raster images only: an SVG from elsewhere is never served from our origin. */
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
const MAX_BYTES = 2 * 1024 * 1024
const HOUR = 3_600_000

/**
 * The sizes a logo is served at (`?s=`, CSS pixels): drawn at twice the size for sharp screens,
 * as WebP. The original file is a few hundred pixels wide; a 20 px logo needs a few hundred bytes.
 */
export const LOGO_SIZES = [16, 20, 24, 32, 40, 56, 72, 96] as const

export interface Logo {
  body: Uint8Array
  contentType: string
}

/** The nearest served size at or above `asked`, or null for the original. */
export function logoSize(asked: unknown): number | null {
  const n = Number(asked)
  if (!Number.isFinite(n) || n <= 0) return null
  return LOGO_SIZES.find((s) => s >= n) ?? LOGO_SIZES[LOGO_SIZES.length - 1]
}

async function resized(logo: Logo, size: number): Promise<Logo> {
  const px = size * 2
  const body = await sharp(logo.body)
    .resize(px, px, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 82, alphaQuality: 90 })
    .toBuffer()
  return { body: new Uint8Array(body), contentType: 'image/webp' }
}

/**
 * Team logos from our own origin (`/cdn/team/:id`): the stored address is read server-side,
 * fetched once and kept in memory, so pages only ever name invade.lol. League logos
 * (`/cdn/league/:slug`) are files of this repository (`resources/leagues`).
 */
class TeamLogoService {
  #memory = new ByteCache<Logo | null>(32 * 1024 * 1024, 4096)
  #inFlight = new Map<string, Promise<Logo | null>>()

  /** A team's logo, at a served size (`logoSize`) or as stored. */
  get(teamId: string, size: number | null = null): Promise<Logo | null> {
    if (!size) return this.once(teamId, () => this.load(teamId))
    return this.once(`${teamId}@${size}`, async () => {
      const original = await this.get(teamId)
      return original ? resized(original, size).catch(() => original) : null
    })
  }

  /** A league's logo, at a served size or as stored. */
  league(slug: string, size: number | null = null): Promise<Logo | null> {
    const league = leagueBySlug(slug)
    if (!league) return Promise.resolve(null)
    return this.once(`league:${league.slug}@${size ?? ''}`, async () => {
      const file = await readFile(app.makePath('resources/leagues', `${league.slug}.webp`)).catch(
        () => null
      )
      if (!file) return null
      const logo = { body: new Uint8Array(file), contentType: 'image/webp' }
      return size ? resized(logo, size).catch(() => logo) : logo
    })
  }

  private once(key: string, load: () => Promise<Logo | null>): Promise<Logo | null> {
    const hit = this.#memory.get(key)
    if (hit !== undefined) return Promise.resolve(hit)
    const pending = this.#inFlight.get(key)
    if (pending) return pending
    const loading = load()
      .then((logo) => {
        // A missing logo is remembered briefly, a found one for a day.
        this.#memory.set(key, logo, logo?.body.byteLength ?? 64, logo ? 24 * HOUR : HOUR / 4)
        return logo
      })
      .finally(() => this.#inFlight.delete(key))
    this.#inFlight.set(key, loading)
    return loading
  }

  private async load(teamId: string): Promise<Logo | null> {
    const url = await proService.logoUrl(teamId)
    if (!url || !/^https?:\/\//.test(url)) return null
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      const type = (res.headers.get('content-type') ?? '').split(';')[0].trim()
      const body = res.ok && TYPES.has(type) ? new Uint8Array(await res.arrayBuffer()) : null
      return body && body.byteLength <= MAX_BYTES ? { body, contentType: type } : null
    } catch (error) {
      logger.warn({ err: error, teamId }, 'team logo unavailable')
      return null
    }
  }
}

export default new TeamLogoService()
