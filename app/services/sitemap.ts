import db from '@adonisjs/lucid/services/db'

export const SITEMAP_PAGE_SIZE = 10_000
export const SITE_ORIGIN = 'https://invade.lol'
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n'
const XML_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9'

export interface SitemapPlayer {
  game_name: string
  tag_line: string
}

function profiles() {
  return db
    .from('riot_player')
    .whereNotNull('game_name')
    .whereNotNull('tag_line')
    .whereNot('game_name', '')
    .whereNot('tag_line', '')
    .distinct('game_name', 'tag_line')
}

/** Only public Riot IDs are read; duplicate identities yield one canonical URL. */
export const sitemapPlayers = {
  async count(): Promise<number> {
    const row = await db.from(profiles().as('profiles')).count('* as total').first()
    return Number(row.total)
  },
  async page(page: number): Promise<SitemapPlayer[]> {
    return profiles()
      .orderBy('game_name')
      .orderBy('tag_line')
      .limit(SITEMAP_PAGE_SIZE)
      .offset((page - 1) * SITEMAP_PAGE_SIZE)
  },
}

function xml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!
  )
}

export function profileSitemap(players: SitemapPlayer[], includeHome: boolean) {
  const urls = players.map(
    (player) => `${SITE_ORIGIN}/${encodeURIComponent(`${player.game_name}-${player.tag_line}`)}`
  )
  if (includeHome) urls.unshift(`${SITE_ORIGIN}/`)
  return `${XML_HEADER}<urlset xmlns="${XML_NAMESPACE}">\n${urls.map((url) => `  <url><loc>${xml(url)}</loc></url>`).join('\n')}\n</urlset>\n`
}

export function sitemapIndex(count: number) {
  const pages = Math.ceil(count / SITEMAP_PAGE_SIZE)
  return `${XML_HEADER}<sitemapindex xmlns="${XML_NAMESPACE}">\n${Array.from({ length: pages }, (_, index) => `  <sitemap><loc>${SITE_ORIGIN}/sitemap.xml?page=${index + 1}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`
}
