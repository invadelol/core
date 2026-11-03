import { createHash } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import sharp from 'sharp'
import { ByteCache } from '#utils/byte_cache'
import { fetchImage, type RemoteImage as Logo } from '#utils/remote_image'

/**
 * The pros' photos from our own origin (`/cdn/pro/:slug?s=48&v=…`): the stored source address
 * (`pro_player.image_url`) is read server-side, fetched once, cropped square from the top (the
 * face) at a served size, as WebP, and kept in memory. A page only ever names invade.lol.
 *
 * Pages need to know which pros have a photo, without a query per pro: the index (slug to a short
 * version of the source address) is read every few minutes and kept in this process. The version
 * goes in the image address, so a new photo gets a new address and the old one can be cached for
 * a year.
 */

/** The sizes a photo is served at (`?s=`, CSS pixels), drawn at twice the size. */
export const PHOTO_SIZES = [24, 32, 40, 48, 64, 96, 144, 240] as const
const SLUG = /^[a-z0-9][a-z0-9._-]{0,63}$/i
const HOUR = 3_600_000
const INDEX_FRESH_MS = 10 * 60_000
const INDEX_RETRY_MS = 60_000
/**
 * Source fetches at once: a page of fifty pros asks for fifty photos together, and the source
 * answers them better a few at a time. A fetch waits its turn before its timeout starts.
 */
const PARALLEL_FETCHES = 6
const FETCH_TIMEOUT_MS = 10_000
/** A photo that failed to load (a timeout, an error) is tried again after this. */
const RETRY_MS = 60_000

/** The nearest served size at or above `asked` (the largest when none is asked). */
export function photoSize(asked: unknown): number {
  const n = Number(asked)
  const largest = PHOTO_SIZES[PHOTO_SIZES.length - 1]
  if (!Number.isFinite(n) || n <= 0) return largest
  return PHOTO_SIZES.find((s) => s >= n) ?? largest
}

/** A short version of a source address: a new photo gets a new image address. */
export const photoVersion = (url: string) =>
  createHash('sha1').update(url).digest('base64url').slice(0, 8)

class ProPhotoService {
  /** The served sizes (a few KB each), and briefly the source files they are cut from. */
  #memory = new ByteCache<Logo | null>(48 * 1024 * 1024, 16_384)
  #originals = new ByteCache<Logo | null>(24 * 1024 * 1024, 512)
  #inFlight = new Map<string, Promise<Logo | null>>()
  #fetching = 0
  #waiting: (() => void)[] = []
  #index = new Map<string, string>()
  #indexAt = 0
  #indexing: Promise<Map<string, string>> | null = null

  /**
   * Which pros have a photo (slug to its version), read again when it is a few minutes old.
   * Never throws: before the photos' migration, or when the read fails, no pro has one.
   */
  index(): Promise<Map<string, string>> {
    if (Date.now() - this.#indexAt < INDEX_FRESH_MS) return Promise.resolve(this.#index)
    this.#indexing ??= db
      .rawQuery(
        `SELECT slug, image_url FROM pro_player
         WHERE image_url LIKE 'http%'`
      )
      .then(({ rows }) => {
        this.#index = new Map(
          rows.map((r: { slug: string; image_url: string }) => [r.slug, photoVersion(r.image_url)])
        )
        this.#indexAt = Date.now()
        return this.#index
      })
      .catch((error) => {
        logger.warn({ err: error }, 'pro photos unreadable')
        this.#indexAt = Date.now() - INDEX_FRESH_MS + INDEX_RETRY_MS
        return this.#index
      })
      .finally(() => (this.#indexing = null))
    return this.#indexing
  }

  /** A pro's photo version (for its address), or null when they have none: as last read. */
  of(slug: string | null | undefined): string | null {
    return (slug && this.#index.get(slug)) || null
  }

  /** A pro's photo at a served size (`photoSize`), or null. */
  get(slug: string, size: number): Promise<Logo | null> {
    if (!SLUG.test(slug)) return Promise.resolve(null)
    return this.once(`${slug}@${size}`, 24 * HOUR, async () => {
      const original = await this.once(slug, 10 * 60_000, () => this.load(slug), this.#originals)
      if (!original) return null
      const px = size * 2
      const body = await sharp(original.body)
        .resize(px, px, { fit: 'cover', position: 'top' })
        .webp({ quality: 80, alphaQuality: 90 })
        .toBuffer()
        .catch(() => null)
      return body ? { body: new Uint8Array(body), contentType: 'image/webp' } : null
    })
  }

  private once(
    key: string,
    ttlMs: number,
    load: () => Promise<Logo | null>,
    memory = this.#memory
  ) {
    const hit = memory.get(key)
    if (hit !== undefined) return Promise.resolve(hit)
    const pending = this.#inFlight.get(key)
    if (pending) return pending
    const loading = load()
      .then((photo) => {
        // A photo that could not be read is tried again soon.
        memory.set(key, photo, photo?.body.byteLength ?? 64, photo ? ttlMs : RETRY_MS)
        return photo
      })
      .finally(() => this.#inFlight.delete(key))
    this.#inFlight.set(key, loading)
    return loading
  }

  private async load(slug: string): Promise<Logo | null> {
    const url = await db
      .rawQuery(
        `SELECT image_url FROM pro_player WHERE slug = ? AND image_url IS NOT NULL
         ORDER BY updated_at DESC LIMIT 1`,
        [slug]
      )
      .then(({ rows }) => (rows[0]?.image_url as string | undefined) ?? null)
      .catch(() => null)
    if (!url) return null
    await this.turn()
    try {
      return await fetchImage(url, { pro: slug }, FETCH_TIMEOUT_MS)
    } finally {
      // The slot goes to the next waiting fetch, else it is freed.
      const next = this.#waiting.shift()
      if (next) next()
      else this.#fetching--
    }
  }

  /** Waits for a free fetch slot (or one handed over by a fetch that ended). */
  private async turn() {
    if (this.#fetching < PARALLEL_FETCHES) {
      this.#fetching++
      return
    }
    await new Promise<void>((resolve) => this.#waiting.push(resolve))
  }
}

const proPhotoService = new ProPhotoService()
export default proPhotoService
