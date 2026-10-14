import type { HttpContext } from '@adonisjs/core/http'
import { desktopReleases, isDesktopPlatform } from '#services/desktop_release'
import { track } from '#services/openpanel'

export default class DownloadsController {
  /** `/download/:platform`: sends the browser straight to the newest installer. */
  async show({ params, request, response }: HttpContext) {
    if (!isDesktopPlatform(params.platform)) return response.notFound()
    const release = await desktopReleases.latest()
    const url = release?.urls[params.platform]
    if (!url) {
      response.header('Retry-After', '60')
      return response.status(503).send('The download is not available right now. Try again soon.')
    }
    // Short: a new release should reach visitors within minutes.
    track(
      'download',
      {
        platform: params.platform,
        version: release?.version ?? null,
        ...source(request.header('referer')),
      },
      {
        ip: request.ip(),
        userAgent: request.header('user-agent'),
      }
    )
    response.header('Cache-Control', 'public, max-age=300')
    return response.redirect(url, false, 302)
  }
}

/** Where a download came from: the referring host, and the `ref` tag of the page it was on. */
function source(referer: string | undefined) {
  try {
    const url = new URL(referer ?? '')
    const ref = url.searchParams.get('ref')
    return { referrer: url.host, ref: ref && /^[\w-]{1,32}$/.test(ref) ? ref : null }
  } catch {
    return { referrer: null, ref: null }
  }
}
