import type { HttpContext } from '@adonisjs/core/http'
import proService from '#services/pro_service'
import championStatsService from '#services/champion_stats_service'
import proLadderService from '#services/pro_ladder_service'
import teamLogoService, { logoSize } from '#services/team_logo_service'
import proPhotoService, { photoSize } from '#services/pro_photo_service'
import proMatchService, { split, type ProMatch } from '#services/pro_match_service'
import { leagueCatalog, leagueRef } from '#services/pro_leagues'
import { ORIGIN, breadcrumbs, count, meta, notFoundPage, percent, today } from '#services/page_meta'
import { SERVERS, serverList } from '#constants/riot'

/** Games in each strip of next games on `/pros` (one row on wide screens). */
const STRIP_GAMES = 4
/** Rows of the ladder per page; "Show more" asks for the next ones. */
const LADDER_PAGE = 50
/** The roles the ladder names a best player for, in lane order. */
const LADDER_ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'] as const
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

/** A country code as its English name ("FR" to "France"). */
function countryName(code: string) {
  const fixed = (
    { FK: 'Falkland Islands', HK: 'Hong Kong', MO: 'Macao', PS: 'Palestine' } as const
  )[code.toUpperCase() as 'HK']
  if (fixed) return fixed
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

/** A copy of `o` without some of its keys. */
function without<T extends object, K extends keyof T>(o: T, ...keys: K[]): Omit<T, K> {
  const out = { ...o }
  for (const k of keys) delete out[k]
  return out
}

/** A pro's photo address, at a served size. */
const photoUrl = (slug: string, photo: string, size: number) =>
  `${ORIGIN}/cdn/pro/${encodeURIComponent(slug)}?s=${size}&v=${photo}`

/** "Bo3 Quarterfinal 4: TES vs IG", "T1 vs Gen.G" */
const matchTitle = (m: ProMatch) =>
  m.name || `${m.teams[0].name || m.teams[0].code} vs ${m.teams[1].name || m.teams[1].code}`

/**
 * schema.org SportsEvent of an upcoming match: online, with both teams as competitors and its
 * stream (else the page) as the place it is watched.
 */
function sportsEvent(m: ProMatch, pageUrl: string) {
  const team = (t: ProMatch['teams'][number]) => ({
    '@type': 'SportsTeam',
    'name': t.name || t.code,
    ...(t.slug ? { url: `${ORIGIN}/team/${t.slug}` } : {}),
  })
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    'name': [m.league?.code, matchTitle(m)].filter(Boolean).join(', '),
    'sport': 'League of Legends',
    'startDate': m.at,
    'eventStatus':
      m.status === 'postponed'
        ? 'https://schema.org/EventPostponed'
        : 'https://schema.org/EventScheduled',
    'eventAttendanceMode': 'https://schema.org/OnlineEventAttendanceMode',
    'location': { '@type': 'VirtualLocation', 'url': m.stream ?? pageUrl },
    'competitor': m.teams.filter((t) => t.name || t.code).map(team),
    ...(m.tournament
      ? {
          superEvent: {
            '@type': 'SportsEvent',
            'name': [m.league?.name, m.tournament].filter(Boolean).join(' '),
          },
        }
      : {}),
  }
}

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
    const catalog = await leagueCatalog()
    const leagues = catalog.listed.map(leagueRef)
    const version = today()
    if (view === 'ladder') {
      const server = SERVERS.find(
        (s) => s.slug === String(request.input('server', '')).toLowerCase()
      )
      const platform = server?.platform ?? null
      const role = ROLE_SLUG[String(request.input('role', '')).toLowerCase()] ?? null
      const asked = String(request.input('league', '')).toLowerCase()
      const league = asked ? (catalog.bySlug(asked) ?? null) : null
      const page = Math.max(1, Math.min(50, Number.parseInt(String(request.input('page', 1))) || 1))
      const scope = { platform, league: league?.slug ?? null }
      const [ladder, servers, top, ...best] = await Promise.all([
        proLadderService
          .ladder({ ...scope, role, limit: LADDER_PAGE, offset: (page - 1) * LADDER_PAGE })
          .catch(() => ({ total: 0, rows: [] })),
        proLadderService.servers(role).catch(() => []),
        // The first 50 of every role: who climbed today and how the roles share the top.
        proLadderService.ladder({ ...scope, limit: 50 }).catch(() => ({ total: 0, rows: [] })),
        ...LADDER_ROLES.map((r) =>
          proLadderService
            .ladder({ ...scope, role: r, limit: 1 })
            .catch(() => ({ total: 0, rows: [] }))
        ),
      ])
      const ids = ladder.rows.map((r) => r.playerId)
      const [records, form] = await Promise.all([
        proService.records(ids).catch(() => new Map()),
        proService.form(ids).catch(() => new Map<string, boolean[]>()),
      ])
      const first = ladder.rows[0]
      const filtered = Boolean(platform || role || league || page > 1)
      const on = server ? server.label : serverList(servers.map((s) => s.platform))
      const proOf = (r: (typeof ladder.rows)[number]) => ({
        slug: r.pro.slug,
        name: r.pro.name,
        ...(r.pro.photo ? { photo: r.pro.photo } : {}),
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
      })
      const roles = new Map<string, number>()
      for (const r of top.rows)
        if (r.pro.role) roles.set(r.pro.role, (roles.get(r.pro.role) ?? 0) + 1)
      return inertia.render('pros/index', {
        view: 'ladder',
        leagues,
        filters: {
          server: server?.slug ?? null,
          role: request.input('role') ?? null,
          league: league?.slug ?? null,
        },
        servers: servers.map(({ slug, label, pros }) => ({ slug, label, pros })),
        on,
        ladder: inertia.merge(() =>
          ladder.rows.map((r) => ({
            place: r.place,
            pro: proOf(r),
            league: r.league ? { slug: r.league.slug, code: r.league.code } : null,
            account: {
              platform: r.account.platform,
              tier: r.account.tier,
              division: r.account.division,
              lp: r.account.lp,
              wins: r.account.wins,
              losses: r.account.losses,
            },
            move: r.move,
            form: form.get(r.playerId) ?? [],
            champions: (records.get(r.playerId)?.champions ?? []).slice(0, 4),
          }))
        ),
        best: best
          .map((b, i) => {
            const r = b.rows[0]
            return r
              ? {
                  role: LADDER_ROLES[i],
                  place: top.rows.find((t) => t.pro.slug === r.pro.slug)?.place ?? null,
                  pro: proOf(r),
                  account: { platform: r.account.platform, lp: r.account.lp, tier: r.account.tier },
                }
              : null
          })
          .filter(Boolean),
        climbing: top.rows
          .filter((r) => r.move && r.move.lp > 0)
          .sort((a, b) => b.move!.lp - a.move!.lp)
          .slice(0, 5)
          .map((r) => ({ place: r.place, pro: proOf(r), move: r.move })),
        split: LADDER_ROLES.map((r) => ({ role: r, pros: roles.get(r) ?? 0 })),
        total: ladder.total,
        page,
        pageSize: LADDER_PAGE,
        ...meta({
          title: 'Pro ladder: every pro ranked by LP',
          description: first
            ? `${count(ladder.total)} ${ladder.total === 1 ? 'pro' : 'pros'} in Master and above on ${on}, ranked by LP. ${first.pro.name} leads with ${count(first.account.lp)} LP.`
            : `Every pro ranked by LP on ${on}, with their moves of the last 24 hours.`,
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
      const codes = leagues.slice(0, 6).map((l) => l.code)
      return inertia.render('pros/index', {
        view: 'teams',
        leagues,
        groups,
        ...meta({
          title: `Pro teams of the ${codes.length > 1 ? `${codes.slice(0, -1).join(', ')} and ${codes.at(-1)}` : (codes[0] ?? 'leagues')}`,
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
    const found = asked ? catalog.bySlug(asked) : catalog.first
    // An event without teams of its own (Worlds) has its games on the first league's page.
    if (found && !found.teams.length) return response.redirect().toPath('/pros')
    const league = found
    if (!league) {
      // A league that moved to another address (its code, or where its teams play now).
      const moved = catalog.successor(asked)
      if (moved) {
        const to = moved.slug === catalog.first?.slug ? '/pros' : `/pros?league=${moved.slug}`
        return response.redirect().status(301).toPath(to)
      }
      return notFoundPage({ inertia, response })
    }
    const [data, next, international] = await Promise.all([
      proService.league(league.slug),
      proMatchService.forLeague(league.slug, STRIP_GAMES),
      proMatchService.international(STRIP_GAMES),
    ])
    if (!data) return notFoundPage({ inertia, response })
    const first = data.players[0]
    const path = league.slug === catalog.first?.slug ? '/pros' : `/pros?league=${league.slug}`
    return inertia.render('pros/index', {
      view: 'league',
      leagues,
      data,
      matches: { league: next, international },
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
    if (!pro) return notFoundPage({ inertia, response })
    // What the page draws: its builds, not the summaries the share card and the team page use.
    const shown = without(pro, 'id', 'champions', 'roles', 'items', 'pools')
    const matches = pro.team ? split(await proMatchService.forTeam(pro.team.id)) : null
    const about = pro.about ?? null
    const best = pro.accounts.find((a: { tier: string | null }) => a.tier) ?? null
    const played = pro.record.games
    const role = roleName(pro.role)
    const facts = [
      pro.team ? `${pro.team.name}${pro.league ? ` (${pro.league.code})` : ''}` : null,
      role || null,
      best?.tier
        ? `${best.tier.charAt(0)}${best.tier.slice(1).toLowerCase()}${best.lp !== null ? ` ${count(best.lp)} LP` : ''}`
        : null,
      played
        ? `${played} solo queue games in 30 days, ${percent(pro.record.wins / played, 0)} won`
        : null,
    ].filter(Boolean)
    const crumbs = [{ name: 'Pros', path: '/pros' }]
    if (pro.league) crumbs.push({ name: pro.league.code, path: `/pros?league=${pro.league.slug}` })
    if (pro.team) crumbs.push({ name: pro.team.name, path: `/team/${pro.team.slug}` })
    crumbs.push({ name: pro.name, path: `/pro/${pro.slug}` })
    // Its games as stored matches, drawn and opened like a profile's; their team's roster and
    // where they stand on the pro ladder.
    const [games, team, ladder] = await Promise.all([
      proService.recentMatches(pro.games),
      pro.team ? proService.team(pro.team.slug).catch(() => null) : null,
      proLadderService.ladder().catch(() => ({ total: 0, rows: [] })),
    ])
    const onLadder = ladder.rows.find((r) => r.pro.slug === pro.slug)
    const roster = team
      ? {
          team: {
            id: team.id,
            slug: team.slug,
            name: team.name,
            shortName: team.shortName,
            league: team.league,
            lp: team.lp,
            place: team.place,
          },
          members: team.roster
            .filter((m: { current: boolean }) => m.current)
            .map(({ playerId: _, ...m }: Record<string, unknown>) => m),
          pools: Object.fromEntries(
            Object.entries(team.pools ?? {}).map(([slug, list]) => [
              slug,
              (list as { champion: number }[]).slice(0, 3).map((c) => c.champion),
            ])
          ),
        }
      : null
    return inertia.render('pros/show', {
      pro: shown,
      games,
      roster,
      ladder: onLadder ? { place: onLadder.place, total: ladder.total } : null,
      matches: { next: matches?.next[0] ?? null, last: matches?.results[0] ?? null },
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
          ...(pro.photo ? { image: photoUrl(pro.slug, pro.photo, 240) } : {}),
          // The real name as written: given or family name first varies, so it is not split.
          ...(about?.firstName || about?.lastName
            ? {
                alternateName: [about?.firstName, about?.lastName].filter(Boolean).join(' '),
              }
            : {}),
          ...(about?.birthday ? { birthDate: about.birthday } : {}),
          ...(pro.team
            ? {
                memberOf: {
                  '@type': 'SportsTeam',
                  'name': pro.team.name,
                  'url': `https://invade.lol/team/${pro.team.slug}`,
                },
              }
            : {}),
          ...((about?.nationality ?? pro.country)
            ? {
                nationality: {
                  '@type': 'Country',
                  'name': countryName((about?.nationality ?? pro.country)!),
                },
              }
            : {}),
        },
      ],
    })
  }

  /** `/team/:slug`: a team's roster, past players, games and champions. */
  async team({ inertia, params, response }: HttpContext) {
    const team = await proService.team(String(params.slug))
    if (!team) return notFoundPage({ inertia, response })
    const matches = split(await proMatchService.forTeam(team.id))
    const upcoming = matches.next.filter((m) => m.status !== 'running').slice(0, 3)
    const players = team.roster.filter(
      (m: { current: boolean; title: string }) => m.current && m.title !== 'staff'
    ) as { name: string; slug: string | null }[]
    const crumbs = [{ name: 'Pros', path: '/pros' }]
    if (team.league)
      crumbs.push({ name: team.league.code, path: `/pros?league=${team.league.slug}` })
    crumbs.push({ name: team.name, path: `/team/${team.slug}` })
    const games = team.record.games
    return inertia.render('pros/team', {
      matches: { next: matches.next.slice(0, 5), results: matches.results.slice(0, 5) },
      now: Date.now(),
      names: await championNames(),
      team: {
        ...without(team, 'champions', 'roles', 'items', 'builds'),
        roster: team.roster.map(({ playerId: _, ...m }: Record<string, unknown>) => m),
      },
      ...meta({
        title: `${team.name}${team.league ? ` (${team.league.code})` : ''}: roster and solo queue`,
        description: `${team.name}: ${players.map((m) => m.name).join(', ') || 'no current roster'}${games ? `. ${games} solo queue games in 30 days, ${percent(team.record.wins / games, 0)} won` : ''}.`,
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
        ...upcoming.map((m) => sportsEvent(m, `${ORIGIN}/team/${team.slug}`)),
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

  /**
   * `/cdn/league/:slug?s=40`: a league's logo. The repository's files only change with a new
   * address; a stored logo can change, so it is kept a day.
   */
  async leagueLogo({ params, request, response }: HttpContext) {
    const slug = String(params.slug).replace(/\.webp$/, '')
    const logo = await teamLogoService.league(slug, logoSize(request.input('s')))
    if (!logo) return response.notFound()
    response.header(
      'Cache-Control',
      (await teamLogoService.isLeagueFile(slug))
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=86400, stale-while-revalidate=604800'
    )
    return this.send(response, logo)
  }

  /**
   * `/cdn/pro/:slug?s=48&v=…`: a pro's photo, square from the top, at a served size. With the
   * photo's current version (`v`, from the pages) it never changes, so it is kept a year.
   */
  async photo({ params, request, response }: HttpContext) {
    const slug = String(params.slug).replace(/\.webp$/, '')
    const index = await proPhotoService.index()
    const version = index.get(slug)
    if (!version) return response.notFound()
    const photo = await proPhotoService.get(slug, photoSize(request.input('s')))
    if (!photo) return response.notFound()
    response.header(
      'Cache-Control',
      request.input('v') === version
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=86400, stale-while-revalidate=604800'
    )
    return this.send(response, photo)
  }

  private send(response: HttpContext['response'], logo: { body: Uint8Array; contentType: string }) {
    response.header('X-Content-Type-Options', 'nosniff')
    response.header('Cross-Origin-Resource-Policy', 'cross-origin')
    response.header('Content-Type', logo.contentType)
    return response.send(Buffer.from(logo.body))
  }
}
