import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import sharp from 'sharp'

import riotAssetsService, { type AssetPayload } from '#services/riot/assets'
import { artWidth, cacheControl, parseAssetRequest, resizedEtag } from '#services/riot/asset_paths'
import { ByteCache } from '#utils/byte_cache'
import { EncodedPayloadCache, negotiatePayload } from '#services/encoded_payload'
import { MANIFESTS, NAMES_CACHE_SECONDS, type AssetKind } from '#constants/assets'
/**
 * Every profile page asks for the champion and item name maps, and the item
 * map alone is tens of kilobytes of JSON built from a manifest that changes
 * once a patch. Serialising and compressing it per request was repeating the
 * same work for the same answer, so it is done once per hour instead.
 */
const namePayloads = new EncodedPayloadCache(NAMES_CACHE_SECONDS * 1000)

/**
 * Champion art asked at a width (`?w=480`), resized once per original (keyed by its validator)
 * and kept a while: a page of art tiles weighs a fraction of the full 1280 px pictures.
 */
const resized = new ByteCache<Uint8Array>(48 * 1024 * 1024, 2000)
const resizing = new Map<string, Promise<Uint8Array>>()
const RESIZED_MS = 6 * 3600_000

function resize(served: AssetPayload, width: number): Promise<Uint8Array> {
  const key = `${served.etag}:${width}`
  const kept = resized.get(key)
  if (kept) return Promise.resolve(kept)
  let pending = resizing.get(key)
  if (!pending) {
    pending = sharp(served.body)
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer()
      .then((buffer) => {
        const bytes = new Uint8Array(buffer)
        resized.set(key, bytes, bytes.byteLength, RESIZED_MS)
        return bytes
      })
      .finally(() => resizing.delete(key))
    resizing.set(key, pending)
  }
  return pending
}

/**
 * Proxies Riot's game art through our own origin (docs/cdn.md).
 *
 * `GET /cdn/:patch/:kind/:id` pins the patch and is cached forever;
 * `GET /cdn/:kind/:id` follows the live patch. Only the kinds and id shapes
 * in `#constants/assets` are answered, anything else is a 404, so this is
 * never an open proxy. A valid request never fails: a missing id or a Riot
 * outage still returns an image, so a page can't end up with a broken icon.
 */
export default class AssetsController {
  async show({ params, request, response }: HttpContext) {
    const asset = parseAssetRequest(params.kind, params.id, params.patch)
    if (!asset) return response.notFound()

    const served = await riotAssetsService.get(asset.kind, asset.id, asset.patch)
    // A width is only honoured on real art (a placeholder is a small drawing already).
    const width =
      served.placeholder || !served.etag ? null : artWidth(asset.kind, request.input('w'))
    let body = served.body
    let contentType = served.contentType
    let etag = served.etag
    if (width && etag) {
      try {
        body = await resize(served, width)
        contentType = 'image/jpeg'
        etag = resizedEtag(etag, width)
      } catch (error) {
        logger.warn({ err: error, kind: asset.kind, id: asset.id, width }, 'art resize failed')
      }
    }

    response.header('Cache-Control', cacheControl(served))
    response.header('X-Asset-Source', served.placeholder ? 'placeholder' : 'riot')
    // Upstream SVGs are served from our origin: opened directly, they can't run anything.
    response.header('X-Content-Type-Options', 'nosniff')
    response.header(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    )
    // Lets <img crossorigin>, canvases and other origins' pages (the app's WebView) use the bytes.
    response.header('Access-Control-Allow-Origin', '*')
    response.header('Cross-Origin-Resource-Policy', 'cross-origin')

    if (etag) {
      response.header('ETag', etag)
      response.header('Last-Modified', served.modified!.toUTCString())
      if (request.header('if-none-match') === etag) return response.status(304).send(null)
    }

    response.header('Content-Type', contentType)
    return response.send(Buffer.from(body))
  }

  /**
   * A champion's skins (number and name, base first), so a page can offer them: the art itself
   * is `/cdn/centered/<champion>-<number>`.
   */
  async skins({ params, response }: HttpContext) {
    const id = String(params.champion ?? '').replace(/\.json$/i, '')
    if (!/^\d{1,7}$/.test(id)) return response.notFound()
    const skins = await riotAssetsService.skins(id)
    response.header(
      'Cache-Control',
      skins.length ? `public, max-age=${NAMES_CACHE_SECONDS}` : 'no-store'
    )
    return response.ok(skins)
  }

  /** Numeric id to display name, so the client stops fetching Riot's JSON. */
  async names({ params, request, response }: HttpContext) {
    // Only the kinds with a manifest have names; anything else is not ours to answer.
    if (!Object.hasOwn(MANIFESTS, params.kind)) return response.notFound()
    const kind = params.kind as AssetKind
    const payload = await namePayloads.get(
      kind,
      () => riotAssetsService.names(kind),
      (value) => Object.keys(value as Record<string, string>).length > 0
    )

    // An empty map means upstream did not answer. Telling the browser to hold
    // it for an hour turns a blip into an hour of unnamed champions.
    const empty = payload.identity.length <= 2

    response.header('Content-Type', 'application/json; charset=utf-8')
    response.header('Cache-Control', empty ? 'no-store' : `public, max-age=${NAMES_CACHE_SECONDS}`)
    response.header('ETag', payload.etag)
    response.header('Vary', 'Accept-Encoding')

    if (!empty && request.header('if-none-match') === payload.etag) {
      response.removeHeader('Content-Type')
      return response.status(304).send(null)
    }

    const encoding = negotiatePayload(payload, request.header('accept-encoding'))
    if (encoding) response.header('Content-Encoding', encoding)

    return response.send(encoding ? payload.encoded[encoding]! : payload.identity, false)
  }
}
