import type { HttpContext } from '@adonisjs/core/http'
import proService from '#services/pro_service'
import championStatsService from '#services/champion_stats_service'
import proLadderService from '#services/pro_ladder_service'
import teamLogoService, { logoSize } from '#services/team_logo_service'
import { LEAGUES, leagueBySlug, leagueRef } from '#services/pro_leagues'
import { breadcrumbs, count, meta, percent, today } from '#services/page_meta'

/** Rows of the ladder per page; "Show more" asks for the next ones. */
const LADDER_PAGE = 50
const SERVERS: Record<string, string> = { euw: 'EUW1', na: 'NA1', br: 'BR1' }
const ROLE_SLUG: Record<string, string> = {
  top: 'TOP',
  jungle: 'JUNGLE',
  mid: 'MID',
  bot: 'ADC',
  adc: 'ADC',
  support: 'SUPPORT',
}

/** "Mid", "Bot". */
const roleName = (role: string | null) =>
  role
    ? (({ ADC: 'Bot', MID: 'Mid' } as Record<string, string>)[role] ??
      role.charAt(0) + role.slice(1).toLowerCase())
    : ''

/** Every champion's name and address, so a page is sent with them. */
async function championNames() {
  const list = await championStatsService.champions().catch(() => [])
  return Object.fromEntries(list.map((c) => [c.id, [c.name, c.slug]]))
}

/** Professional players and teams: the leagues, the ladder, a pro's page, a team's page, logos. */
export default class ProsController {
  /**
   * `/pros`: a league (`?league=lec`, the first one by default) with its teams and players, every
   * team by league (`?view=teams`), or the ladder of every pro by LP (`?view=ladder`).
   */
  async index({ inertia, request, response }: HttpContext) {
    const view = String(request.input('view', ''))
    const leagues = LEAGUES.map(leagueRef)
    const version = today()
    if (view === 'ladder') {
      const platform = SERVERS[String(request.input('server', '')).toLowerCase()] ?? null
      const role = ROLE_SLUG[String(request.input('role', '')).toLowerCase()] ?? null
      const page = Math.max(1, Math.min(50, Number.parseInt(String(request.input('page', 1))) || 1))
      const ladder = await proLadderService
        .ladder({ platform, role, limit: LADDER_PAGE, offset: (page - 1) * LADDER_PAGE })
        .catch(() => ({ total: 0, rows: [] }))
      const top = ladder.rows[0]
      const filtered = Boolean(platform || role || page > 1)
      return inertia.render('pros/index', {
        view: 'ladder',
        leagues,
        filters: { server: request.input('server') ?? null, role: request.input('role') ?? null },
        ladder: inertia.merge(() =>
          ladder.rows.map((r) => ({
            place: r.place,
            pro: {
              slug: r.pro.slug,
              name: r.pro.name,
              role: r.pro.role,
              country: r.pro.country,
              team: r.pro.team
                ? {
                    id: r.pro.team.id,
                    slug: r.pro.team.slug,
                    name: r.pro.team.name,
                    shortName: r.pro.team.shortName,
                  }
                : null,
            },
            league: r.league ? { slug: r.league.slug, code: r.league.code } : null,
            account: {
              platform: r.account.platform,
              tier: r.account.tier,
              division: r.account.division,
              lp: r.account.lp,
            },
            move: r.move,
          }))
        ),
        total: ladder.total,
        page,
        pageSize: LADDER_PAGE,
        ...meta({
          title: 'Pro ladder: every pro ranked by LP',
          description: top
            ? `${count(ladder.total)} pros in Master and above on EUW, NA and BR, ranked by LP. ${top.pro.name} leads with ${count(top.account.lp)} LP.`
            : 'Every pro ranked by LP on EUW, NA and BR, with their moves of the last 24 hours.',
          path: '/pros?view=ladder',
          image: '/og/pros/all.jpg',
          version,
          alt: 'The pro ladder on invade.lol',
        }),
        robots: filtered ? 'noindex,follow' : null,
        jsonld: [
          breadcrumbs([
            { name: 'Pros', path: '/pros' },
            { name: 'Ladder', path: '/pros?view=ladder' },
          ]),
        ],
      })
    }
    if (view === 'teams') {
      const groups = await proService.leagueTeams().catch(() => [])
      const teams = groups.reduce((n, g) => n + g.teams.length, 0)
      return inertia.render('pros/index', {
        view: 'teams',
        leagues,
        groups,
        ...meta({
          title: 'Pro teams of the LEC, LCK, LPL, LCS, CBLOL and LCP',
          description: `${teams} teams in ${groups.length} leagues, with their rosters and how their players rank in solo queue.`,
          path: '/pros?view=teams',
          image: '/og/pros/all.jpg',
          version,
          alt: 'Pro teams on invade.lol',
        }),
        jsonld: [
          breadcrumbs([
            { name: 'Pros', path: '/pros' },
            { name: 'Teams', path: '/pros?view=teams' },
          ]),
        ],
      })
    }
    const asked = request.input('league')
    const league = leagueBySlug(asked ?? LEAGUES[0].slug)
    if (!league) return response.notFound()
    const data = await proService.league(league.slug)
    if (!data) return response.notFound()
    const first = data.players[0]
    const path = league.slug === LEAGUES[0].slug ? '/pros' : `/pros?league=${league.slug}`
    return inertia.render('pros/index', {
      view: 'league',
      leagues,
      data,
      ...meta({
        title: `${league.code} pros and teams in solo queue`,
        description: `${league.name}: ${data.counts.teams} teams, ${data.counts.players} players and ${data.counts.accounts} ranked accounts${first?.best ? `, led by ${first.name} at ${count(first.best.lp)} LP` : ''}.`,
        path,
        image: `/og/pros/${league.slug}.jpg`,
        version,
        alt: `${league.code} pros on invade.lol`,
      }),
      robots: data.players.length ? null : 'noindex,follow',
      jsonld: [
        breadcrumbs([
          { name: 'Pros', path: '/pros' },
          { name: league.code, path },
        ]),
      ],
    })
  }

  /** `/pro/:slug`: a pro, every account they play on, their teams, games and builds. */
  async show({ inertia, params, response }: HttpContext) {
    const pro = await proService.player(String(params.slug))
    if (!pro) return response.notFound()
    const { id, ...shown } = pro
    const best = pro.accounts.find((a: { tier: string | null }) => a.tier) ?? null
    const games = pro.record.games
    const role = roleName(pro.role)
    const facts = [
      pro.team ? `${pro.team.name}${pro.league ? ` (${pro.league.code})` : ''}` : null,
      role || null,
      best?.tier
        ? `${best.tier.charAt(0)}${best.tier.slice(1).toLowerCase()}${best.lp !== null ? ` ${count(best.lp)} LP` : ''}`
        : null,
      games
        ? `${games} solo queue games in 30 days at ${percent(pro.record.wins / games, 0)} wins`
        : null,
    ].filter(Boolean)
    const crumbs = [{ name: 'Pros', path: '/pros' }]
    if (pro.league) crumbs.push({ name: pro.league.code, path: `/pros?league=${pro.league.slug}` })
    if (pro.team) crumbs.push({ name: pro.team.name, path: `/team/${pro.team.slug}` })
    crumbs.push({ name: pro.name, path: `/pro/${pro.slug}` })
    return inertia.render('pros/show', {
      pro: shown,
      now: Date.now(),
      names: await championNames(),
      ...meta({
        title: `${pro.name}${pro.team ? `, ${pro.team.name}` : ''}: ranked accounts, builds and games`,
        description: `${pro.name}: ${facts.join(', ')}.`,
        path: `/pro/${pro.slug}`,
        image: `/og/pro/${pro.slug}.jpg`,
        version: today(),
        alt: `${pro.name} on invade.lol`,
        type: 'profile',
      }),
      robots: pro.accounts.length || pro.team ? null : 'noindex,follow',
      jsonld: [
        breadcrumbs(crumbs),
        {
          '@context': 'https://schema.org',
          '@type': 'Person',
          'name': pro.name,
          'url': `https://invade.lol/pro/${pro.slug}`,
          ...(pro.team
            ? {
                memberOf: {
                  '@type': 'SportsTeam',
                  'name': pro.team.name,
                  'url': `https://invade.lol/team/${pro.team.slug}`,
                },
              }
            : {}),
          ...(pro.country ? { nationality: { '@type': 'Country', 'name': pro.country } } : {}),
        },
      ],
    })
  }

  /** `/team/:slug`: a team's roster, past players, games and champions. */
  async team({ inertia, params, response }: HttpContext) {
    const team = await proService.team(String(params.slug))
    if (!team) return response.notFound()
    const players = team.roster.filter(
      (m: { current: boolean; title: string }) => m.current && m.title !== 'staff'
    ) as { name: string; slug: string | null }[]
    const crumbs = [{ name: 'Pros', path: '/pros' }]
    if (team.league)
      crumbs.push({ name: team.league.code, path: `/pros?league=${team.league.slug}` })
    crumbs.push({ name: team.name, path: `/team/${team.slug}` })
    const games = team.record.games
    return inertia.render('pros/team', {
      now: Date.now(),
      names: await championNames(),
      team: {
        ...team,
        roster: team.roster.map(({ playerId: _, ...m }: Record<string, unknown>) => m),
      },
      ...meta({
        title: `${team.name}${team.league ? ` (${team.league.code})` : ''}: roster and solo queue`,
        description: `${team.name}: ${players.map((m) => m.name).join(', ') || 'no current roster'}${games ? `. ${games} solo queue games in 30 days at ${percent(team.record.wins / games, 0)} wins` : ''}.`,
        path: `/team/${team.slug}`,
        image: `/og/team/${team.slug}.jpg`,
        version: today(),
        alt: `${team.name} on invade.lol`,
      }),
      robots: players.length ? null : 'noindex,follow',
      jsonld: [
        breadcrumbs(crumbs),
        {
          '@context': 'https://schema.org',
          '@type': 'SportsTeam',
          'name': team.name,
          'sport': 'League of Legends',
          'url': `https://invade.lol/team/${team.slug}`,
          'logo': `https://invade.lol/cdn/team/${team.id}?s=96`,
          ...(team.league
            ? { memberOf: { '@type': 'SportsOrganization', 'name': team.league.name } }
            : {}),
          'athlete': players.map((m) => ({
            '@type': 'Person',
            'name': m.name,
            ...(m.slug ? { url: `https://invade.lol/pro/${m.slug}` } : {}),
          })),
        },
      ],
    })
  }

  /** `/api/pros/games/:matchId`: one game's ten players for a pro's page, as two teams. */
  async board({ params, response }: HttpContext) {
    const board = await proService.board(String(params.matchId)).catch(() => null)
    if (!board) return response.notFound()
    response.header('Cache-Control', 'public, max-age=86400')
    return response.ok(board)
  }

  /**
   * Pros and teams whose name starts with the query, for the site's search.
   * @paramQuery q - At least two characters
   */
  async search({ request, response }: HttpContext) {
    const q = String(request.input('q', ''))
    const found = await proService.search(q, 5).catch(() => ({ pros: [], teams: [], accounts: [] }))
    response.header('Cache-Control', 'public, max-age=300')
    return response.ok(found)
  }

  /** `/cdn/team/:id?s=40`: a team's logo, from our own origin, at a served size or as stored. */
  async logo({ params, request, response }: HttpContext) {
    const logo = await teamLogoService.get(String(params.id), logoSize(request.input('s')))
    if (!logo) return response.notFound()
    response.header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    return this.send(response, logo)
  }

  /** `/cdn/league/:slug?s=40`: a league's logo. The files only change with a new address. */
  async leagueLogo({ params, request, response }: HttpContext) {
    const slug = String(params.slug).replace(/\.webp$/, '')
    const logo = await teamLogoService.league(slug, logoSize(request.input('s')))
    if (!logo) return response.notFound()
    response.header('Cache-Control', 'public, max-age=31536000, immutable')
    return this.send(response, logo)
  }

  private send(response: HttpContext['response'], logo: { body: Uint8Array; contentType: string }) {
    response.header('X-Content-Type-Options', 'nosniff')
    response.header('Cross-Origin-Resource-Policy', 'cross-origin')
    response.header('Content-Type', logo.contentType)
    return response.send(Buffer.from(logo.body))
  }
}
