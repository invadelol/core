import { defineConfig } from '@adonisjs/cors'
import { allowedOrigin } from '#utils/origins'

/**
 * Configuration options to tweak the CORS policy. The following
 * options are documented on the official documentation website.
 *
 * https://docs.adonisjs.com/guides/security/cors
 */
const corsConfig = defineConfig({
  enabled: true,
  /**
   * Only invade.lol, its preview, the desktop app's webviews and, while developing, localhost
   * (`#utils/origins`). Any other origin gets no CORS headers, so no other site can read the
   * API's answers from its visitors' browsers, with their cookies or without.
   */
  origin: (origin) => allowedOrigin(origin),
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'],
  headers: true,
  /** How long to wait after a 429, readable by the allowed origins. */
  exposeHeaders: ['retry-after'],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
