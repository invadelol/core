import cache from '@adonisjs/cache/services/main'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import { ByteCache } from '#utils/byte_cache'

import { ASSET_PREFIX, FETCH_TIMEOUT_MS, MANIFESTS, MANIFEST_TTL } from '#constants/assets'
import type { AssetKind } from '#constants/assets'
import {
  gameDataUrl,
  fallbackSources,
  guessContentType,
  parseManifest,
  placeholderSvg,
  rankSources,
  type Manifest,
} from '#services/riot/asset_paths'

export interface AssetPayload {
  body: Uint8Array
  contentType: string
  /** True when the bytes are a generated stand-in rather than the real asset. */
  placeholder: boolean
}

/**
 * Serves Riot's game art from our own origin.
 *
 * Three things this buys over pointing <img> straight at Riot. Every asset is
 * mirrored to R2 on first use, so we stop depending on their uptime. Ids
 * resolve through Community Dragon's manifests rather than hand-built paths
 * that break between patches. And, most importantly, a call to this service
 * always resolves to an image: if every upstream source fails we draw a
 * labelled tile instead of letting the page render a broken-image glyph.
 */
class RiotAssetsService {
  /** Bound hot image bytes per process; browser/R2 remain the longer-lived caches. */
  private memory = new ByteCache<AssetPayload>(32 * 1024 * 1024, 512)

  /** Dedupes concurrent misses for the same asset within one process. */
  private inFlight = new Map<string, Promise<AssetPayload>>()

  /* ── Public API ─────────────────────────────────────────────── */

  async get(kind: AssetKind, id: string): Promise<AssetPayload> {
    const key = `${kind}/${id}`
    const cached = this.memory.get(key)
    if (cached) return cached

    const existing = this.inFlight.get(key)
    if (existing) return existing

    const pending = this.resolve(kind, id)
      // A throw here would surface as a broken icon, so absorb it.
      .catch((error) => {
        logger.error({ err: error, kind, id }, 'asset resolution failed')
        return this.placeholder(kind, id)
      })
      .then((asset) => {
        this.memory.set(key, asset, asset.body.byteLength, asset.placeholder ? 30_000 : 3_600_000)
        return asset
      })
      .finally(() => this.inFlight.delete(key))

    this.inFlight.set(key, pending)
    return pending
  }

  /** Numeric id to display name, for the kinds that carry one. */
  async names(kind: AssetKind): Promise<Record<string, string>> {
    const manifest = await this.manifest(kind)
    const names: Record<string, string> = {}
    for (const [id, entry] of Object.entries(manifest)) {
      if (entry.name) names[id] = entry.name
    }
    return names
  }

  /** Every id the manifest knows about, used by the warming command. */
  async ids(kind: AssetKind): Promise<string[]> {
    return Object.keys(await this.manifest(kind))
  }

  /* ── Resolution ─────────────────────────────────────────────── */

  private async resolve(kind: AssetKind, id: string): Promise<AssetPayload> {
    const path = `${ASSET_PREFIX}/${kind}/${id}`

    // 1. The mirror. Once an asset lands here we never ask Riot again.
    const mirrored = await this.readMirror(path)
    if (mirrored) return mirrored

    // 2. Upstream, trying every known source for this id in order.
    for (const source of await this.sources(kind, id)) {
      const fetched = await this.download(source)
      if (!fetched) continue

      await this.writeMirror(path, fetched)
      return fetched
    }

    // 3. Nothing upstream answered. Draw something rather than show nothing.
    logger.warn({ kind, id }, 'riot asset unavailable, serving placeholder')
    return this.placeholder(kind, id)
  }

  /**
   * Candidate URLs for one asset, best first. Community Dragon's manifest is
   * authoritative; the conventional paths behind it cover the window where a
   * brand new asset exists on one CDN but not yet the other.
   */
  private async sources(kind: AssetKind, id: string): Promise<string[]> {
    if (kind === 'rank') return rankSources(id)
    if (kind === 'splash') {
      if (!/^\d+$/.test(id)) return []
      const champion = await this.downloadJson(
        `${MANIFESTS.champion!.replace('champion-summary.json', `champions/${id}.json`)}`
      )
      const skin =
        champion?.skins?.find((entry: { isBase?: boolean }) => entry.isBase) ?? champion?.skins?.[0]
      return [
        ...(skin?.splashPath ? [gameDataUrl(skin.splashPath)] : []),
        ...fallbackSources(kind, id),
      ]
    }

    const manifest = await this.manifest(kind)
    return manifest[id]?.sources ?? fallbackSources(kind, id)
  }

  /* ── Manifests ──────────────────────────────────────────────── */

  private async manifest(kind: AssetKind): Promise<Manifest> {
    const url = MANIFESTS[kind]
    if (!url) return {}

    try {
      return await cache.getOrSet<Manifest>({
        key: `riot:manifest:${kind}`,
        ttl: MANIFEST_TTL,
        factory: async () => {
          const raw = await this.downloadJson(url)
          if (!raw) {
            logger.warn({ kind, url }, 'riot manifest unavailable')
            return {}
          }
          return parseManifest(kind, raw)
        },
      })
    } catch (error) {
      // A cache outage falls through to the conventional paths.
      logger.warn({ err: error, kind }, 'manifest cache read failed')
      return {}
    }
  }

  /* ── Mirror ─────────────────────────────────────────────────── */

  private async readMirror(path: string): Promise<AssetPayload | null> {
    try {
      const disk = drive.use()
      // GET tells us whether the object exists. Read metadata concurrently to
      // preserve SVG/JPEG/WebP types even though mirror keys have no extension.
      const [body, meta] = await Promise.all([
        disk.getBytes(path),
        disk.getMetaData(path).catch(() => null),
      ])
      if (!body?.length) return null
      return {
        body,
        contentType: meta?.contentType || guessContentType(path),
        placeholder: false,
      }
    } catch (error) {
      // A mirror outage must never take the icons down with it.
      const cause = (
        error as { cause?: { name?: string; $metadata?: { httpStatusCode?: number } } }
      )?.cause
      if (cause?.name !== 'NoSuchKey' && cause?.$metadata?.httpStatusCode !== 404) {
        logger.warn({ err: error, path }, 'asset mirror read failed')
      }
      return null
    }
  }

  private async writeMirror(path: string, asset: AssetPayload) {
    try {
      await drive.use().put(path, asset.body, {
        contentType: asset.contentType,
        visibility: 'public',
      })
    } catch (error) {
      logger.warn({ err: error, path }, 'asset mirror write failed')
    }
  }

  /* ── Network ────────────────────────────────────────────────── */

  private async download(url: string): Promise<AssetPayload | null> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { accept: 'image/*' },
      })
      if (!response.ok) return null

      const body = new Uint8Array(await response.arrayBuffer())
      if (!body.length) return null

      return {
        body,
        contentType: response.headers.get('content-type') || guessContentType(url),
        placeholder: false,
      }
    } catch {
      return null
    }
  }

  private async downloadJson(url: string): Promise<any | null> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      return response.ok ? await response.json() : null
    } catch {
      return null
    }
  }

  /* ── Placeholder ────────────────────────────────────────────── */

  private placeholder(kind: AssetKind, id: string): AssetPayload {
    return {
      body: new TextEncoder().encode(placeholderSvg(kind, id)),
      contentType: 'image/svg+xml; charset=utf-8',
      placeholder: true,
    }
  }
}

export default new RiotAssetsService()
