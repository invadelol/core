import type { HttpContext } from '@adonisjs/core/http'
import { profileSitemap, sitemapIndex, sitemapPlayers, SITEMAP_PAGE_SIZE } from '#services/sitemap'

export default class SitemapsController {
  async index({ request, response }: HttpContext) {
    const requested = request.input('page')
    if (requested !== undefined && !/^[1-9]\d*$/.test(String(requested))) return response.notFound()
    const page = requested === undefined ? 1 : Number(requested)
    if (!Number.isSafeInteger(page)) return response.notFound()
    const count = await sitemapPlayers.count()
    if (page > Math.max(1, Math.ceil(count / SITEMAP_PAGE_SIZE))) return response.notFound()
    const body =
      requested === undefined && count > SITEMAP_PAGE_SIZE
        ? sitemapIndex(count)
        : profileSitemap(await sitemapPlayers.page(page), page === 1)
    response.header('Content-Type', 'application/xml; charset=utf-8')
    response.header('Cache-Control', 'public, max-age=300')
    return response.send(body)
  }
}
