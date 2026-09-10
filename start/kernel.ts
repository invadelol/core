/*
|--------------------------------------------------------------------------
| HTTP kernel file
|--------------------------------------------------------------------------
|
| The HTTP kernel file is used to register the middleware with the server
| or the router.
|
*/

import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

/**
 * The error handler is used to convert an exception
 * to an HTTP response.
 */
server.errorHandler(() => import('#exceptions/handler'))

/**
 * The server middleware stack runs middleware on all the HTTP
 * requests, even if there is no route registered for
 * the request URL.
 */
server.use([
  () => import('#middleware/container_bindings_middleware'),
  () => import('#middleware/force_json_response_middleware'),
  () => import('@adonisjs/cors/cors_middleware'),
  /**
   * The built front-end short-circuits here, served from memory and already
   * compressed, before any of the heavier machinery below gets involved.
   */
  () => import('#middleware/static_assets_middleware'),
  /**
   * Wraps everything that generates a body per request, so it can encode the
   * result on the way out. Responses that already carry a Content-Encoding —
   * cached analytics, static assets — pass straight through.
   */
  () => import('#middleware/compression_middleware'),
  () => import('@adonisjs/inertia/inertia_middleware'),
  () => import('@adonisjs/vite/vite_middleware'),
  () => import('@adonisjs/static/static_middleware'),
  () => import('#middleware/no_cache_inertia_middleware'),
])

/**
 * The router middleware stack runs middleware on all the HTTP
 * requests with a registered route.
 */
router.use([() => import('@adonisjs/core/bodyparser_middleware')])
