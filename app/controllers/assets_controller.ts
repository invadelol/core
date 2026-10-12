import type { HttpContext } from '@adonisjs/core/http'

import riotAssetsService from '#services/riot/assets'
import { cacheControl, parseAssetRequest } from '#services/riot/asset_paths'
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

    if (served.etag) {
      response.header('ETag', served.etag)
      response.header('Last-Modified', served.modified!.toUTCString())
      if (request.header('if-none-match') === served.etag) return response.status(304).send(null)
    }

    response.header('Content-Type', served.contentType)
    return response.send(Buffer.from(served.body))
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
