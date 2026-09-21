import type { HttpContext } from '@adonisjs/core/http'

import riotAssetsService from '#services/riot/assets'
import { EncodedPayloadCache, negotiatePayload } from '#services/encoded_payload'
import {
  ASSET_KINDS,
  BROWSER_CACHE_SECONDS,
  NAMES_CACHE_SECONDS,
  PLACEHOLDER_CACHE_SECONDS,
  type AssetKind,
} from '#constants/assets'

/**
 * Every profile page asks for the champion and item name maps, and the item
 * map alone is tens of kilobytes of JSON built from a manifest that changes
 * once a patch. Serialising and compressing it per request was repeating the
 * same work for the same answer, so it is done once per hour instead.
 */
const namePayloads = new EncodedPayloadCache(NAMES_CACHE_SECONDS * 1000)

/**
 * Proxies Riot's game art through our own origin.
 *
 * `show` never fails: an unknown kind, a missing id or a Riot outage all
 * still return an image, so a page can't end up with a broken icon slot.
 */
export default class AssetsController {
  async show({ params, response }: HttpContext) {
    const kind = this.kind(params.kind)
    // Ids arrive with a file extension so browsers and CDNs treat them as images.
    const id = String(params.id ?? '').replace(/\.[a-z0-9]+$/i, '')

    const asset = await riotAssetsService.get(kind, id)

    response.header('Content-Type', asset.contentType)
    response.header(
      'Cache-Control',
      asset.placeholder
        ? `public, max-age=${PLACEHOLDER_CACHE_SECONDS}`
        : `public, max-age=${BROWSER_CACHE_SECONDS}, immutable`
    )
    // Lets the CDN and the browser skip re-downloading identical bytes.
    response.header('X-Asset-Source', asset.placeholder ? 'placeholder' : 'riot')

    return response.send(Buffer.from(asset.body))
  }

  /** Numeric id to display name, so the client stops fetching Riot's JSON. */
  async names({ params, request, response }: HttpContext) {
    const kind = this.kind(params.kind)
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

  /**
   * Falls back to `champion` for an unrecognised kind rather than 404ing:
   * the resolver will fail through to a placeholder, which is still an image.
   */
  private kind(value: unknown): AssetKind {
    const kind = String(value ?? '')
    return (ASSET_KINDS as readonly string[]).includes(kind) ? (kind as AssetKind) : 'champion'
  }
}
