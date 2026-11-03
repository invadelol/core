import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import sharp from 'sharp'
import { ByteCache } from '#utils/byte_cache'
import { fetchImage, type RemoteImage } from '#utils/remote_image'
import proService from '#services/pro_service'

const HOUR = 3_600_000
const LEAGUE_SLUG = /^[a-z0-9][a-z0-9-]{0,47}$/

/**
 * The sizes a logo is served at (`?s=`, CSS pixels): drawn at twice the size for sharp screens,
 * as WebP. The original file is a few hundred pixels wide; a 20 px logo needs a few hundred bytes.
 */
export const LOGO_SIZES = [16, 20, 24, 32, 40, 56, 72, 96] as const

export type Logo = RemoteImage

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
 * (`/cdn/league/:slug`) are files of this repository (`resources/leagues`) when there is one,
 * else the league's stored logo, fetched the same way.
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
    if (!LEAGUE_SLUG.test(slug)) return Promise.resolve(null)
    if (size) {
      return this.once(`league:${slug}@${size}`, async () => {
        const original = await this.league(slug)
        return original ? resized(original, size).catch(() => original) : null
      })
    }
    return this.once(`league:${slug}`, async () => {
      const file = await this.leagueFile(slug)
      if (file) return file
      const stored = await fetchImage(await leagueImageUrl(slug), { league: slug })
      return stored ? forDarkWell(stored).catch(() => stored) : null
    })
  }

  /** Whether a league's logo is a file of this repository (it then never changes). */
  async isLeagueFile(slug: string) {
    return LEAGUE_SLUG.test(slug) && Boolean(await this.leagueFile(slug))
  }

  private async leagueFile(slug: string): Promise<Logo | null> {
    const file = await readFile(app.makePath('resources/leagues', `${slug}.webp`)).catch(() => null)
    return file ? { body: new Uint8Array(file), contentType: 'image/webp' } : null
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
    return fetchImage(await proService.logoUrl(teamId), { teamId })
  }
}

/** The ink a dark logo is drawn in on the logos' dark well (the light theme's `.lgo` text). */
const LIGHT_INK = { r: 233, g: 233, b: 239 }

/**
 * Logo wells are dark in both themes, as the repository's league logos are drawn white. A stored
 * logo drawn dark on transparency (most leagues' own files) would vanish there, so it is redrawn
 * as a light silhouette of its shape. A logo on its own opaque ground, or a light one, is kept.
 */
export async function forDarkWell(logo: Logo): Promise<Logo> {
  const { data, info } = await sharp(logo.body)
    .ensureAlpha()
    .resize(64, 64, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true })
  let seen = 0
  let ink = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    seen++
    ink += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
  }
  const pixels = info.width * info.height
  if (!seen || seen / pixels > 0.85 || ink / seen >= 0.35) return logo
  const meta = await sharp(logo.body).metadata()
  const alpha = await sharp(logo.body).ensureAlpha().extractChannel('alpha').toBuffer()
  const body = await sharp({
    create: { width: meta.width!, height: meta.height!, channels: 3, background: LIGHT_INK },
  })
    .joinChannel(alpha)
    .png()
    .toBuffer()
  return { body: new Uint8Array(body), contentType: 'image/png' }
}

/** A league's stored logo address (never sent to a browser), or null. */
async function leagueImageUrl(slug: string): Promise<string | null> {
  try {
    const { rows } = await db.rawQuery('SELECT image_url FROM pro_league WHERE slug = ?', [slug])
    return rows[0]?.image_url ?? null
  } catch {
    // Before the leagues' migration.
    return null
  }
}

export default new TeamLogoService()
