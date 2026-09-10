import { defineConfig } from '@adonisjs/static'
import { ASSET_REVALIDATE_SECONDS } from '#constants/assets'

/**
 * Configuration options to tweak the static files middleware.
 * The complete set of options are documented on the
 * official documentation website.
 *
 * https://docs.adonisjs.com/guides/static-assets
 *
 * The built front-end and the self-hosted fonts never reach this middleware:
 * `static_assets_middleware` answers those from memory, already compressed and
 * marked immutable. What is left here are loose files in `public/`, which get
 * a month of browser caching rather than `serve-static`'s default of zero — that
 * default costs a conditional request per file per page view.
 */
const staticServerConfig = defineConfig({
  enabled: true,
  etag: true,
  lastModified: true,
  dotFiles: 'ignore',
  maxAge: ASSET_REVALIDATE_SECONDS * 1000,
})

export default staticServerConfig
