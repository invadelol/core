import { createHash } from 'node:crypto'
import cache from '@adonisjs/cache/services/main'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import { ByteCache } from '#utils/byte_cache'

import {
  ABILITY_KEYS,
  ASSET_PREFIX,
  DDRAGON,
  FETCH_TIMEOUT_MS,
  MANIFESTS,
  MANIFEST_TTL,
  MASTERY_CREST_MAX,
  MAX_ASSET_BYTES,
  TIERS,
  VERSIONS_TTL_MS,
} from '#constants/assets'
import type { AssetKind } from '#constants/assets'
import {
  LATEST,
  championSources,
  contentTypeOf,
  fallbackSources,
  gameData,
  parseChampion,
  parseManifest,
  placeholderSvg,
  recentReleases,
  type ChampionArt,
  type Manifest,
  type Release,
} from '#services/riot/asset_paths'

export interface AssetPayload {
  body: Uint8Array
  contentType: string
  /** True when the bytes are a generated stand-in rather than the real asset. */
  placeholder: boolean
  /** Strong validator, hashed once when the bytes enter the process. Real assets only. */
  etag?: string
  modified?: Date
}

/**
 * Serves Riot's game art from our own origin: a caching proxy, nothing more.
 *
 * Every asset is fetched from upstream once per patch, mirrored to the bucket
 * under `riot-assets/<patch>/<kind>/<id>`, and from then on answered from this
 * process's memory or the mirror. Ids resolve through Community Dragon's
 * manifests rather than hand-built paths that break between patches. A call
 * always resolves to an image: if every upstream source fails we draw a
 * labelled tile instead of letting the page render a broken-image glyph.
 */
export class RiotAssetsService {
  /** Bound hot image bytes per process; browser/mirror remain the longer-lived caches. */
  private memory = new ByteCache<AssetPayload>(64 * 1024 * 1024, 2048)

  /** Concurrent misses for the same asset, manifest or version list share one fetch. */
  private inFlight = new Map<string, Promise<unknown>>()

  /** Data Dragon's recent releases, read once an hour per process (a minute after a failure). */
  private releaseList?: { value: Release[]; until: number }

  /* ── Public API ─────────────────────────────────────────────── */

  /**
   * One asset, from the release `patch` names (`16.20`) or else the live one.
   * `pinned` says the bytes belong to the patch the URL named, so never change.
   */
  async get(
    kind: AssetKind,
    id: string,
    patch?: string
  ): Promise<AssetPayload & { pinned: boolean }> {
    const releases = await this.releases()
    const named = patch ? releases.find((release) => release.cdragon === patch) : undefined
    const release = named ?? releases[0] ?? null
    const key = `${release?.cdragon ?? 'latest'}/${kind}/${id}`

    const asset =
      this.memory.get(key) ??
      (await this.shared<AssetPayload>(key, () =>
        this.resolve(kind, id, release)
          // A throw here would surface as a broken icon, so absorb it.
          .catch((error) => {
            logger.error({ err: error, kind, id }, 'asset resolution failed')
            return this.placeholder(kind, id)
          })
          .then((resolved) => {
            const ttl = resolved.placeholder ? 30_000 : 3_600_000
            this.memory.set(key, resolved, resolved.body.byteLength, ttl)
            return resolved
          })
      ))

    return { ...asset, pinned: Boolean(named) && !asset.placeholder }
  }

  /** Numeric id to display name, for the kinds that carry one. */
  async names(kind: AssetKind): Promise<Record<string, string>> {
    const manifest = await this.manifest(kind, await this.live())
    const names: Record<string, string> = {}
    for (const [id, entry] of Object.entries(manifest)) {
      if (entry.name) names[id] = entry.name
    }
    return names
  }

  /** Every id of a kind on the live patch, used by the warming command. */
  async ids(kind: AssetKind): Promise<string[]> {
    if (kind === 'rank' || kind === 'emblem') return [...TIERS]
    if (kind === 'mastery') return Array.from({ length: MASTERY_CREST_MAX + 1 }, (_, n) => `${n}`)
    const release = await this.live()
    if (kind !== 'splash' && kind !== 'centered' && kind !== 'loading' && kind !== 'ability') {
      return Object.keys(await this.manifest(kind, release))
    }
    const champions = Object.keys(await this.manifest('champion', release))
    return kind === 'ability'
      ? champions.flatMap((champion) => ABILITY_KEYS.map((key) => `${champion}-${key}`))
      : champions
  }

  /* ── Releases ───────────────────────────────────────────────── */

  private async live(): Promise<Release> {
    const [live] = await this.releases()
    return live ?? LATEST
  }

  /**
   * The patches a URL may pin, newest (live) first. Empty while Data Dragon
   * is unreachable: bytes then come from Community Dragon's `latest`, are not
   * mirrored (no patch can be put on them) and are served under a short cache.
   */
  private releases(): Promise<Release[]> {
    const memo = this.releaseList
    if (memo && memo.until > Date.now()) return Promise.resolve(memo.value)

    return this.shared('releases', async () => {
      const value = recentReleases(await this.downloadJson(`${DDRAGON}/api/versions.json`))
      if (!value.length) logger.warn('ddragon versions unavailable, serving latest unpinned')
      // A failed read keeps what we knew and is retried a minute later.
      this.releaseList = {
        value: value.length ? value : (memo?.value ?? []),
        until: Date.now() + (value.length ? VERSIONS_TTL_MS : 60_000),
      }
      return this.releaseList.value
    })
  }

  /* ── Resolution ─────────────────────────────────────────────── */

  private async resolve(
    kind: AssetKind,
    id: string,
    release: Release | null
  ): Promise<AssetPayload> {
    const path = release && `${ASSET_PREFIX}/${release.cdragon}/${kind}/${id}`

    // 1. The mirror. Once an asset lands here we never ask upstream again this patch.
    const mirrored = path && (await this.readMirror(path))
    if (mirrored) return mirrored

    // 2. Upstream, trying every known source in order: the release's own
    //    files, then the live ones (an id newer than a pinned patch).
    const tried = new Set<string>()
    for (const from of release ? [release, LATEST] : [LATEST]) {
      for (const source of await this.sources(kind, id, from)) {
        if (tried.has(source)) continue
        tried.add(source)

        const fetched = await this.download(source)
        if (!fetched) continue

        if (path) await this.writeMirror(path, fetched)
        return fetched
      }
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
  private async sources(kind: AssetKind, id: string, release: Release): Promise<string[]> {
    if (kind === 'rank' || kind === 'emblem' || kind === 'map' || kind === 'mastery') {
      return fallbackSources(kind, id, release)
    }
    if (kind === 'splash' || kind === 'centered' || kind === 'loading' || kind === 'ability') {
      const champion = await this.champion(id.split('-')[0], release)
      return championSources(kind, id, champion, release)
    }
    const manifest = await this.manifest(kind, release)
    return manifest[id]?.sources ?? fallbackSources(kind, id, release)
  }

  /* ── Upstream JSON ──────────────────────────────────────────── */

  private async manifest(kind: AssetKind, release: Release): Promise<Manifest> {
    const file = MANIFESTS[kind]
    if (!file) return {}

    const manifest = await this.cached(`riot:manifest:${release.cdragon}:${kind}`, async () => {
      const raw = await this.downloadJson(`${gameData(release)}/${file}`)
      const parsed = raw ? parseManifest(kind, raw, release) : {}
      return Object.keys(parsed).length ? parsed : null
    })
    return manifest ?? {}
  }

  /** The art paths in one champion's own file, shared by its splashes and abilities. */
  private champion(id: string, release: Release): Promise<ChampionArt | null> {
    return this.cached(`riot:champion:${release.cdragon}:${id}`, async () =>
      parseChampion(await this.downloadJson(`${gameData(release)}/v1/champions/${id}.json`))
    )
  }

  /**
   * Read-through cache for parsed upstream JSON. A miss (null) is never
   * stored: that would serve nothing for the whole TTL over one blip upstream.
   */
  private cached<T>(key: string, load: () => Promise<T | null>): Promise<T | null> {
    return this.shared(key, async () => {
      try {
        const hit = await cache.get<T>({ key })
        if (hit) return hit
      } catch (error) {
        // A cache outage falls through to upstream.
        logger.warn({ err: error, key }, 'asset cache read failed')
      }
      const value = await load()
      if (value === null) {
        logger.warn({ key }, 'riot game data unavailable')
        return null
      }
      await cache.set({ key, value, ttl: MANIFEST_TTL }).catch(() => {})
      return value
    })
  }

  /** Runs `task` once for every concurrent caller asking for the same `key`. */
  private shared<T>(key: string, task: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key)
    if (existing) return existing as Promise<T>
    const pending = task().finally(() => this.inFlight.delete(key))
    this.inFlight.set(key, pending)
    return pending
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
      return this.payload(body, contentTypeOf(meta?.contentType, path), meta?.lastModified)
    } catch (error) {
      // A mirror outage must never take the icons down with it.
      const cause = (
        error as {
          cause?: { name?: string; code?: string; $metadata?: { httpStatusCode?: number } }
        }
      )?.cause
      const missing =
        cause?.name === 'NoSuchKey' ||
        cause?.code === 'ENOENT' ||
        cause?.$metadata?.httpStatusCode === 404
      if (!missing) {
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
      if (!response.ok || Number(response.headers.get('content-length')) > MAX_ASSET_BYTES) {
        return null
      }

      const body = new Uint8Array(await response.arrayBuffer())
      if (!body.length || body.length > MAX_ASSET_BYTES) return null

      return this.payload(body, contentTypeOf(response.headers.get('content-type'), url))
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

  /* ── Payloads ───────────────────────────────────────────────── */

  private payload(body: Uint8Array, contentType: string, modified = new Date()): AssetPayload {
    const etag = `"${createHash('sha1').update(body).digest('base64url')}"`
    return { body, contentType, placeholder: false, etag, modified }
  }

  private placeholder(kind: AssetKind, id: string): AssetPayload {
    return {
      body: new TextEncoder().encode(placeholderSvg(kind, id)),
      contentType: 'image/svg+xml; charset=utf-8',
      placeholder: true,
    }
  }
}

export default new RiotAssetsService()
