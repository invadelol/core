import app from '@adonisjs/core/services/app'

/** The site, its preview, and `www` (which only redirects to the site). */
const SITE = new Set(['https://invade.lol', 'https://www.invade.lol', 'https://pp.invade.lol'])

/**
 * The desktop app's webviews (Tauri 2): `tauri://localhost` on macOS, `http://tauri.localhost` on
 * Windows, and its https form should the app ever switch scheme.
 */
const DESKTOP = new Set(['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost'])

/** A page served from this machine, while developing. */
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/

/**
 * Whether a page from `origin` may call the API from a browser and read the answer, cookies
 * included. Everyone else gets no CORS headers at all.
 */
export function allowedOrigin(origin: string, development = !app.inProduction): boolean {
  return SITE.has(origin) || DESKTOP.has(origin) || (development && LOCAL.test(origin))
}

interface FetchMetadata {
  header(name: string): string | null | undefined
  host(): string | null
}

/**
 * Whether a browser is making this request for a page of another site. CORS only stops that page
 * from reading the answer; the request itself (a plain `fetch` in `no-cors` mode, an image) is
 * still sent, and on a route that asks Riot it would spend the key from each of the page's
 * visitors. Browsers say where a request comes from (`Sec-Fetch-Site`); one too old to say it
 * still sends `Origin` with a cross-site `fetch`. Anything that is not a browser (the desktop
 * app, a script) sends neither, and is held by the quotas instead.
 */
export function crossSiteRequest(request: FetchMetadata, development = !app.inProduction): boolean {
  const origin = request.header('origin')
  if (origin && allowedOrigin(origin, development)) return false
  const site = request.header('sec-fetch-site')
  if (site) return site === 'cross-site'
  if (!origin) return false
  try {
    return new URL(origin).host !== request.host()
  } catch {
    return true
  }
}
