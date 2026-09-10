import type { HttpContext } from '@adonisjs/core/http'

import riotAssetsService from '#services/riot/assets'
import {
  ASSET_KINDS,
  BROWSER_CACHE_SECONDS,
  PLACEHOLDER_CACHE_SECONDS,
  type AssetKind,
} from '#constants/assets'

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
  async names({ params, response }: HttpContext) {
    const kind = this.kind(params.kind)
    const names = await riotAssetsService.names(kind)

    response.header('Cache-Control', `public, max-age=${60 * 60}`)
    return response.ok(names)
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
