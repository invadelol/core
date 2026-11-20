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

/**
 * The ground a logo is drawn on: dark (the site's home theme, the default) or light. Each has its
 * own copy, where a logo drawn in ink that would vanish there is redrawn (`forGround`).
 */
export type Ground = 'dark' | 'light'

/** `?on=light` asks for the light ground's copy; anything else is the dark one. */
export const groundOf = (asked: unknown): Ground => (asked === 'light' ? 'light' : 'dark')

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

/** A team's id as stored (a uuid): the name of its logo file. */
const TEAM_ID = /^[0-9a-f-]{36}$/i

/**
 * Team logos from our own origin (`/cdn/team/:id`): a file of this repository
 * (`resources/teams/<id>.webp`) when there is one, else the stored address, read server-side,
 * fetched once and kept in memory, so pages only ever name invade.lol. League logos
 * (`/cdn/league/:slug`) are files of this repository (`resources/leagues`) when there is one,
 * else the league's stored logo, fetched the same way. Each is served for a ground (`forGround`):
 * the dark one by default, the light one with `?on=light`.
 */
class TeamLogoService {
  #memory = new ByteCache<Logo | null>(32 * 1024 * 1024, 4096)
  #inFlight = new Map<string, Promise<Logo | null>>()

  /**
   * A team's logo for a ground (dark by default), at a served size (`logoSize`) or full size.
   * A logo that would vanish on that ground is redrawn (`forGround`).
   */
  get(teamId: string, size: number | null = null, ground: Ground = 'dark'): Promise<Logo | null> {
    if (!size) {
      return this.once(`${teamId}:${ground}`, async () => {
        const original = await this.once(teamId, () => this.load(teamId))
        return original ? forGround(original, ground).catch(() => original) : null
      })
    }
    return this.once(`${teamId}@${size}:${ground}`, async () => {
      const full = await this.get(teamId, null, ground)
      return full ? resized(full, size).catch(() => full) : null
    })
  }

  /** A league's logo for a ground (dark by default), at a served size or full size. */
  league(slug: string, size: number | null = null, ground: Ground = 'dark'): Promise<Logo | null> {
    if (!LEAGUE_SLUG.test(slug)) return Promise.resolve(null)
    if (size) {
      return this.once(`league:${slug}@${size}:${ground}`, async () => {
        const full = await this.league(slug, null, ground)
        return full ? resized(full, size).catch(() => full) : null
      })
    }
    return this.once(`league:${slug}:${ground}`, async () => {
      const original = await this.once(
        `league:${slug}`,
        async () =>
          (await this.leagueFile(slug)) ?? fetchImage(await leagueImageUrl(slug), { league: slug })
      )
      return original ? forGround(original, ground).catch(() => original) : null
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
    if (!TEAM_ID.test(teamId)) return null
    const file = await readFile(app.makePath('resources/teams', `${teamId.toLowerCase()}.webp`))
      .then((body) => ({ body: new Uint8Array(body), contentType: 'image/webp' }))
      .catch(() => null)
    return file ?? fetchImage(await proService.logoUrl(teamId), { teamId })
  }
}

/** OKLab of an sRGB colour (0–255): lightness 0–1 and the two colour axes. */
function oklab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [lr, lg, lb] = [lin(r / 255), lin(g / 255), lin(b / 255)]
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** sRGB (0–255, clamped into the gamut) of an OKLab colour. */
function srgb(L: number, A: number, B: number): [number, number, number] {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  const out = (c: number) => {
    const v = Math.min(1, Math.max(0, c))
    return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))
  }
  return [
    out(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    out(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    out(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

/** OKLab chroma under which a pixel reads as ink (black, grey, white) rather than a colour. */
const INK_CHROMA = 0.06
/** OKLab lightness under which a pixel is lost on the dark ground, over which on the light one. */
const DARK = 0.42
const LIGHT = 0.75

/**
 * What a logo is drawn with, on a small copy: its outline (opaque pixels within 2 px of
 * transparency) by lightness, and its own ink and colour.
 */
async function measure(body: Uint8Array) {
  const { data, info } = await sharp(body)
    .toColourspace('srgb')
    .ensureAlpha()
    .resize(128, 128, { fit: 'inside' })
    .raw({ depth: 'uchar' })
    .toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const alpha = (x: number, y: number) =>
    x < 0 || y < 0 || x >= w || y >= h ? 0 : data[(y * w + x) * 4 + 3]
  const m = { pixels: w * h, seen: 0, edge: 0, edgeDark: 0, edgeLight: 0 }
  const own = { dark: 0, lightInk: 0, colour: 0 }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (data[i + 3] < 128) continue
      m.seen++
      const [L, A, B] = oklab(data[i], data[i + 1], data[i + 2])
      const C = Math.hypot(A, B)
      if (L < DARK) own.dark++
      if (L > 0.6 && C < INK_CHROMA) own.lightInk++
      if (L >= DARK && C >= 0.05) own.colour++
      let edge = false
      for (let d = 1; d <= 2 && !edge; d++) {
        edge =
          alpha(x - d, y) < 64 ||
          alpha(x + d, y) < 64 ||
          alpha(x, y - d) < 64 ||
          alpha(x, y + d) < 64
      }
      if (!edge) continue
      m.edge++
      if (L < DARK) m.edgeDark++
      if (L > LIGHT) m.edgeLight++
    }
  }
  return { ...m, ...own }
}

/** The longest side a redrawn logo keeps: twice the largest served size, with room to spare. */
const REDRAWN_MAX = 512

/**
 * A logo for a ground. Logos are drawn for any background, and many are plain black (or white)
 * ink on transparency: on the site's dark ground a black logo vanishes, on the light one a white
 * one does. When a logo's outline is mostly in that ink and it has no part of the opposite ink of
 * its own (a white letter inside a black disc already reads), its dark ink is redrawn light for
 * the dark ground, keeping hue: black turns white, greys keep their steps, a navy turns a lighter
 * blue, a red stays red. For the light ground only neutral white ink is darkened, and only on a
 * logo without colour or dark parts of its own. A logo on its own opaque ground is kept as it is.
 */
export async function forGround(logo: Logo, ground: Ground): Promise<Logo> {
  const m = await measure(logo.body)
  if (!m.seen || !m.edge || m.seen / m.pixels > 0.85) return logo
  const lost =
    ground === 'dark'
      ? m.edgeDark / m.edge >= 0.45 && m.lightInk / m.seen < 0.1
      : m.edgeLight / m.edge >= 0.6 && m.dark / m.seen < 0.1 && m.colour / m.seen < 0.3
  if (!lost) return logo
  const { data, info } = await sharp(logo.body)
    .toColourspace('srgb')
    .ensureAlpha()
    .resize(REDRAWN_MAX, REDRAWN_MAX, { fit: 'inside', withoutEnlargement: true })
    .raw({ depth: 'uchar' })
    .toBuffer({ resolveWithObject: true })
  const out = Buffer.from(data)
  for (let i = 0; i < out.length; i += 4) {
    if (!out[i + 3]) continue
    const [L, A, B] = oklab(out[i], out[i + 1], out[i + 2])
    let to = L
    let chroma = 1
    if (ground === 'dark') {
      // Dark turns light in reverse order (black lightest), mid and light tones stay.
      to = Math.max(L, 0.94 - 0.85 * L)
    } else {
      // Light ink turns dark in reverse order; a coloured pixel keeps its lightness.
      const ink = Math.max(0, Math.min(1, (0.07 - Math.hypot(A, B)) / 0.03))
      to = L + (Math.min(L, 0.98 - 0.95 * L) - L) * ink
      if (to < 0.5) chroma = 0.8
    }
    if (to === L) continue
    const [r, g, b] = srgb(to, A * chroma, B * chroma)
    out[i] = r
    out[i + 1] = g
    out[i + 2] = b
  }
  const body = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ lossless: true })
    .toBuffer()
  return { body: new Uint8Array(body), contentType: 'image/webp' }
}

/** A logo for the dark ground (the share cards draw logos on dark ink). */
export const forDarkWell = (logo: Logo) => forGround(logo, 'dark')

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
