import type { HttpContext } from '@adonisjs/core/http'
import { desktopPlatform, desktopReleases } from '#services/desktop_release'
import { track } from '#services/openpanel'

export default class DownloadsController {
  /**
   * `/download/:platform`: sends the browser straight to the newest installer. It answers
   * from memory, so a slow or failing GitHub never holds a download up.
   */
  async show({ params, request, response }: HttpContext) {
    const platform = desktopPlatform(String(params.platform ?? ''))
    if (!platform) return response.notFound()
    const installer = await desktopReleases.installer(platform)
    // A link preview or a checker asking for the headers is not a download.
    if (request.method() === 'GET') {
      track(
        'download',
        {
          platform,
          version: installer.version,
          source: installer.source,
          ...source(request.header('referer')),
        },
        {
          ip: request.ip(),
          userAgent: request.header('user-agent'),
        }
      )
    }
    // Not cacheable on the way (no-cache, set for every page): each click reaches us and counts.
    return response.redirect(installer.url, false, 302)
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
