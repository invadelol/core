import type { HttpContext } from '@adonisjs/core/http'
import {
  SITEMAP_PAGE_SIZE,
  SITEMAP_SECTIONS,
  fullIndex,
  profileSitemap,
  sitemapPlayers,
  sitemapPros,
  sitemapTeams,
  urlSitemap,
  type SitemapSection,
  type SitemapUrl,
} from '#services/sitemap'
import championStatsService from '#services/champion_stats_service'
import { AnswerCache } from '#services/ranked_stats'
import { ROLE_OF } from '#services/champion_stats'
import { LEAGUES } from '#services/pro_leagues'
import { VIEWS } from '#services/stats_explorer_service'

/** A section's sitemap is built at most once an hour. */
const sections = new AnswerCache(8, 3600_000)
const today = () => new Date().toISOString().slice(0, 10)

/** A champion's page in a role is listed from this many games (its main role always is). */
const MIN_ROLE_GAMES = 1000

async function section(name: SitemapSection): Promise<SitemapUrl[]> {
  const lastmod = today()
  if (name === 'pages') {
    return [
      { path: '/champions', lastmod },
      { path: '/tier-list', lastmod },
      ...Object.values(ROLE_OF).map((r) => ({ path: `/tier-list?role=${r.slug}`, lastmod })),
      { path: '/stats', lastmod },
      ...VIEWS.filter((v) => v !== 'overview').map((v) => ({ path: `/stats?view=${v}`, lastmod })),
      { path: '/pros', lastmod },
      ...LEAGUES.slice(1).map((l) => ({ path: `/pros?league=${l.slug}`, lastmod })),
      { path: '/pros?view=teams', lastmod },
      { path: '/pros?view=ladder', lastmod },
    ]
  }
  if (name === 'champions') {
    const [champions, filter] = await Promise.all([
      championStatsService.champions(),
      championStatsService.filter({}),
    ])
    const summary = filter ? await championStatsService.summary(filter).catch(() => null) : null
    const roles = new Map<number, { position: string; games: number }[]>()
    for (const r of summary?.roles ?? [])
      roles.set(r.champion, [...(roles.get(r.champion) ?? []), r])
    return champions.flatMap((c) => {
      const mine = (roles.get(c.id) ?? []).sort((a, b) => b.games - a.games)
      return [
        { path: `/champions/${c.slug}`, lastmod },
        ...mine
          .slice(1)
          .filter((r) => r.games >= MIN_ROLE_GAMES)
          .map((r) => ({
            path: `/champions/${c.slug}?role=${ROLE_OF[r.position as keyof typeof ROLE_OF].slug}`,
            lastmod,
          })),
      ]
    })
  }
  if (name === 'pros') return sitemapPros()
  return sitemapTeams()
}

export default class SitemapsController {
  async index({ request, response }: HttpContext) {
    const asked = request.input('section')
    const requested = request.input('page')
    response.header('Content-Type', 'application/xml; charset=utf-8')
    response.header('Cache-Control', 'public, max-age=300')
    if (asked !== undefined) {
      if (!(SITEMAP_SECTIONS as readonly string[]).includes(String(asked)))
        return response.notFound()
      const urls = await sections.get(String(asked), () => section(asked as SitemapSection))
      return response.send(urlSitemap(urls))
    }
    if (requested !== undefined && !/^[1-9]\d*$/.test(String(requested))) return response.notFound()
    const page = requested === undefined ? 1 : Number(requested)
    if (!Number.isSafeInteger(page)) return response.notFound()
    const count = await sitemapPlayers.count()
    if (page > Math.max(1, Math.ceil(count / SITEMAP_PAGE_SIZE))) return response.notFound()
    if (requested === undefined) return response.send(fullIndex(count, today()))
    return response.send(profileSitemap(await sitemapPlayers.page(page), page === 1))
  }
}
