import type { HttpContext } from '@adonisjs/core/http'
import { desktopReleases, isDesktopPlatform } from '#services/desktop_release'

export default class DownloadsController {
  /** `/download/:platform`: sends the browser straight to the newest installer. */
  async show({ params, response }: HttpContext) {
    if (!isDesktopPlatform(params.platform)) return response.notFound()
    const release = await desktopReleases.latest()
    const url = release?.urls[params.platform]
    if (!url) {
      response.header('Retry-After', '60')
      return response.status(503).send('The download is not available right now. Try again soon.')
    }
    // Short: a new release should reach visitors within minutes.
    response.header('Cache-Control', 'public, max-age=300')
    return response.redirect(url, false, 302)
  }
}
