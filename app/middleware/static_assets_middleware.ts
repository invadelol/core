import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import env from '#start/env'
import { StaticAssetService } from '#services/static_assets'
import { ASSET_IMMUTABLE_SECONDS, ASSET_REVALIDATE_SECONDS } from '#constants/assets'

/**
 * Serves the built front-end and self-hosted fonts ahead of the generic static
 * middleware, from memory and already compressed.
 *
 * Only the two directories whose contents we build ourselves are handled here.
 * Anything else in `public/` falls through untouched.
 */
const SERVED_PREFIXES = ['/assets/', '/fonts/']

const service = new StaticAssetService(app.publicPath())

export default class StaticAssetsMiddleware {
  async handle({ request, response }: HttpContext, next: () => Promise<void>) {
    // In development Vite serves the front-end from its own dev server, and
    // nothing under these prefixes is built yet.
    if (env.get('NODE_ENV') === 'development') return next()

    const method = request.method()
    if (method !== 'GET' && method !== 'HEAD') return next()

    const path = request.url()
    if (!SERVED_PREFIXES.some((prefix) => path.startsWith(prefix))) return next()

    const entry = await service.find(path)
    if (!entry) return next()

    response.header('Content-Type', entry.contentType)
    response.header('ETag', entry.etag)
    response.header('Vary', 'Accept-Encoding')
    response.header(
      'Cache-Control',
      entry.immutable
        ? `public, max-age=${ASSET_IMMUTABLE_SECONDS}, immutable`
        : `public, max-age=${ASSET_REVALIDATE_SECONDS}`
    )

    // The ETag is over the identity bytes, so it is the same answer whichever
    // encoding the client ends up receiving.
    if (request.header('if-none-match') === entry.etag) {
      response.removeHeader('Content-Type')
      return response.status(304).send(null)
    }

    const encoding = StaticAssetService.negotiate(entry, request.header('accept-encoding'))
    const body = encoding ? entry.encoded[encoding]! : entry.identity
    if (encoding) response.header('Content-Encoding', encoding)

    if (method === 'HEAD') {
      response.header('Content-Length', body.length)
      return response.send(null)
    }

    return response.send(body, false)
  }
}
