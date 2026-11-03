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

/** A sitemap entry: an address and when it last changed (`yyyy-mm-dd`). */
export interface SitemapUrl {
  path: string
  lastmod?: string | null
}

/** The sections of the site's own pages, after the players' pages in the index. */
export const SITEMAP_SECTIONS = ['pages', 'champions', 'pros', 'teams'] as const
export type SitemapSection = (typeof SITEMAP_SECTIONS)[number]

export function urlSitemap(urls: SitemapUrl[]) {
  const rows = urls.map(
    (u) =>
      `  <url><loc>${xml(`${SITE_ORIGIN}${u.path}`)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`
  )
  return `${XML_HEADER}<urlset xmlns="${XML_NAMESPACE}">\n${rows.join('\n')}\n</urlset>\n`
}

/** The index of every sitemap: the site's own sections, then the players' pages. */
export function fullIndex(count: number, lastmod: string) {
  const pages = Math.max(1, Math.ceil(count / SITEMAP_PAGE_SIZE))
  const locs = [
    ...SITEMAP_SECTIONS.map((s) => `${SITE_ORIGIN}/sitemap.xml?section=${s}`),
    ...Array.from({ length: pages }, (_, i) => `${SITE_ORIGIN}/sitemap.xml?page=${i + 1}`),
  ]
  return `${XML_HEADER}<sitemapindex xmlns="${XML_NAMESPACE}">\n${locs.map((loc) => `  <sitemap><loc>${xml(loc)}</loc><lastmod>${lastmod}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`
}

const day = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : null

/** The pros worth a page in search: on a team now, or with an account in Master and above. */
export async function sitemapPros(): Promise<SitemapUrl[]> {
  const { rows } = await db.rawQuery(
    `SELECT p.slug, p.updated_at FROM pro_player p
     WHERE EXISTS (SELECT 1 FROM pro_team_member m WHERE m.player_id = p.id AND m.current)
        OR EXISTS (SELECT 1 FROM pro_account a WHERE a.player_id = p.id
                   AND a.tier IN ('MASTER', 'GRANDMASTER', 'CHALLENGER'))
     ORDER BY p.slug`
  )
  return rows.map((r: { slug: string; updated_at: Date }) => ({
    path: `/pro/${encodeURIComponent(r.slug)}`,
    lastmod: day(r.updated_at),
  }))
}

/** Active teams with a current roster. */
export async function sitemapTeams(): Promise<SitemapUrl[]> {
  const { rows } = await db.rawQuery(
    `SELECT t.slug, t.updated_at FROM pro_team t
     WHERE t.active AND EXISTS (SELECT 1 FROM pro_team_member m WHERE m.team_id = t.id AND m.current)
     ORDER BY t.slug`
  )
  return rows.map((r: { slug: string; updated_at: Date }) => ({
    path: `/team/${encodeURIComponent(r.slug)}`,
    lastmod: day(r.updated_at),
  }))
}
