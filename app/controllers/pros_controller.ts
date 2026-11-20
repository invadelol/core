import type { HttpContext } from '@adonisjs/core/http'
import proService from '#services/pro_service'
import championStatsService from '#services/champion_stats_service'
import teamLogoService, { groundOf, logoSize } from '#services/team_logo_service'
import proPhotoService, { photoSize } from '#services/pro_photo_service'
import proMatchService, { split, type ProMatch } from '#services/pro_match_service'
import { leagueCatalog, leagueRef } from '#services/pro_leagues'
import { ORIGIN, breadcrumbs, count, meta, notFoundPage, percent, today } from '#services/page_meta'
import esportsService from '#services/esports_service'
import esportsLandingService from '#services/esports_landing_service'

/** What the league pages read of a league's players (`proService.league`). */
interface LeaguePlayer {
  slug: string
  name: string
  best: { tier: string; lp: number } | null
  move: { lp: number; places: number | null } | null
  record: { games: number; wins: number } | null
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
   * `/pros`: the pros' page is the pro ladder now (`/leaderboards/pros`), a league's players there
   * as they were here (`?league=lec`, the first one by default, a moved league where its teams
   * play now); `?view=teams` is `/teams`.
   */
  async index({ request, response }: HttpContext) {
    const view = String(request.input('view', ''))
    if (view === 'teams') return response.redirect().status(301).toPath('/teams')
    const catalog = await leagueCatalog()
    const q = new URLSearchParams()
    for (const key of ['role', 'server', 'team', 'q', 'page']) {
      const v = request.input(key)
      if (v) q.set(key, String(v))
    }
    const asked = String(request.input('league', '') || '').toLowerCase()
    const league =
      asked === 'all' ? null : asked ? (catalog.bySlug(asked) ?? catalog.successor(asked)) : null
    if (asked === 'all' || view === 'ladder') q.set('league', league?.slug ?? 'all')
    else if (league && league.teams.length && league.slug !== catalog.first?.slug) {
      q.set('league', league.slug)
    }
    const query = q.toString()
    return response
      .redirect()
      .status(view === 'ladder' ? 301 : 302)
      .toPath(`/leaderboards/pros${query ? `?${query}` : ''}`)
  }

  /** `/leagues`: every league, its teams and players, and its next game. */
  async leagues({ inertia }: HttpContext) {
    const catalog = await leagueCatalog()
    const listed = await Promise.all(
      catalog.listed.map(async (l) => {
        const [data, next, results] = await Promise.all([
          proService.league(l.slug).catch(() => null),
          proMatchService.forLeague(l.slug, 1),
          esportsService.results(l.slug, 1),
        ])
        return {
          ...leagueRef(l),
          tier: l.tier,
          counts: data?.counts ?? null,
          leader: (data?.players as LeaguePlayer[] | undefined)?.find((p) => p.best) ?? null,
          next: next[0] ?? null,
          last: results[0] ?? null,
        }
      })
    )
    return inertia.render('esports/leagues', {
      leagues: listed,
      ...meta({
        title: 'Pro leagues: teams, games and solo queue',
        description: `${listed.length} leagues, ${listed.reduce((n, l) => n + (l.counts?.teams ?? 0), 0)} teams, with their games around now and how their players rank in solo queue.`,
        path: '/leagues',
        image: '/og/pros/all.jpg',
        version: today(),
        alt: 'Photos of the five best pros by LP, with a poro holding a foam finger',
      }),
      jsonld: [
        breadcrumbs([
          { name: 'Esports', path: '/esports' },
          { name: 'Leagues', path: '/leagues' },
        ]),
      ],
    })
  }

  /**
   * `/league/:slug`: a league's games of the last two weeks and the next three, its teams by their
   * starters' solo queue and its players' solo queue (best LP, LP won in a day, most games).
   */
  async league({ inertia, params, response }: HttpContext) {
    const catalog = await leagueCatalog()
    const asked = String(params.slug).toLowerCase()
    const league = catalog.bySlug(asked)
    if (!league || !league.teams.length) {
      const moved = catalog.successor(asked)
      if (moved) return response.redirect().status(301).toPath(`/league/${moved.slug}`)
      return notFoundPage({ inertia, response })
    }
    const [data, next, results, international] = await Promise.all([
      proService.league(league.slug),
      proMatchService.forLeague(league.slug, 8),
      esportsService.results(league.slug, 10),
      proMatchService.international(4),
    ])
    if (!data) return notFoundPage({ inertia, response })
    const players = data.players as LeaguePlayer[]
    const top = <T>(list: T[], key: (x: T) => number) =>
      [...list].sort((a, b) => key(b) - key(a)).slice(0, 3)
    return inertia.render('esports/league', {
      league: leagueRef(league),
      leagues: catalog.listed.map(leagueRef),
      teams: data.teams,
      counts: data.counts,
      leaders: {
        lp: players.filter((p) => p.best).slice(0, 3),
        gained: top(
          players.filter((p) => (p.move?.lp ?? 0) > 0),
          (p) => p.move!.lp
        ),
        games: top(
          players.filter((p) => (p.record?.games ?? 0) > 0),
          (p) => p.record!.games
        ),
      },
      next,
      results,
      international: [...international.next, ...international.results].slice(0, 4),
      ...meta({
        title: `${league.code}: teams, games and solo queue`,
        description: `${league.name}: ${data.counts.teams} teams and ${data.counts.players} players, their games around now and how they rank in solo queue.`,
        path: `/league/${league.slug}`,
        image: `/og/pros/${league.slug}.jpg`,
        version: today(),
        alt: `Photos of the five best ${league.code} pros by LP, the league's logo and a poro with a foam finger`,
      }),
      jsonld: [
        breadcrumbs([
          { name: 'Esports', path: '/esports' },
          { name: league.code, path: `/league/${league.slug}` },
        ]),
      ],
    })
  }

  /** `/teams`: every league's teams in one ranking by their starters' solo queue, with their five. */
  async teams({ inertia }: HttpContext) {
    const boards = await esportsLandingService.teams().catch(() => [])
    const teams = boards.reduce((n, b) => n + b.teams.length, 0)
    return inertia.render('esports/teams', {
      boards,
      ...meta({
        title: 'Pro teams: rosters and solo queue',
        description: `${teams} teams in ${boards.length} leagues ranked by their starters' solo queue LP, each with its starting five.`,
        path: '/teams',
        image: '/og/pros/all.jpg',
        version: today(),
        alt: 'Photos of the five best pros by LP, with a poro holding a foam finger',
      }),
      jsonld: [
        breadcrumbs([
          { name: 'Esports', path: '/esports' },
          { name: 'Teams', path: '/teams' },
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
    const crumbs = [{ name: 'Esports', path: '/esports' }]
    if (pro.league) crumbs.push({ name: pro.league.code, path: `/league/${pro.league.slug}` })
    if (pro.team) crumbs.push({ name: pro.team.name, path: `/team/${pro.team.slug}` })
    crumbs.push({ name: pro.name, path: `/pro/${pro.slug}` })
    // Its games as stored matches, drawn and opened like a profile's; their team's roster and
    // the champion they play most, which the hero stands them before.
    const [games, team, signature, cutout] = await Promise.all([
      proService.recentMatches(pro.games),
      pro.team ? proService.team(pro.team.slug).catch(() => null) : null,
      proService.signature(pro.id),
      pro.photo ? proPhotoService.cutout(pro.slug) : false,
    ])
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
    return inertia.render('esports/pro', {
      pro: shown,
      games,
      roster,
      signature,
      /** Whether their photo is a cutout, which can stand before the champion's art. */
      cutout,
      matches: { next: matches?.next[0] ?? null, last: matches?.results[0] ?? null },
      now: Date.now(),
      names: await championNames(),
      ...meta({
        title: `${pro.name}${pro.team ? `, ${pro.team.name}` : ''}: ranked accounts, builds and games`,
        description: `${pro.name}: ${facts.join(', ')}.`,
        path: `/pro/${pro.slug}`,
        image: `/og/pro/${pro.slug}.jpg`,
        version: today(),
        alt: `${pro.name}'s photo, ${pro.team ? `${pro.team.name}'s logo, ` : ''}and their best solo queue LP, with a poro`,
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
    const [matches, standing] = await Promise.all([
      proMatchService.forTeam(team.id).then(split),
      team.league ? proService.league(team.league.slug).catch(() => null) : null,
    ])
    const upcoming = matches.next.filter((m) => m.status !== 'running').slice(0, 3)
    const players = team.roster.filter(
      (m: { current: boolean; title: string }) => m.current && m.title !== 'staff'
    ) as { name: string; slug: string | null }[]
    const crumbs = [{ name: 'Esports', path: '/esports' }]
    if (team.league) crumbs.push({ name: team.league.code, path: `/league/${team.league.slug}` })
    crumbs.push({ name: team.name, path: `/team/${team.slug}` })
    const games = team.record.games
    return inertia.render('esports/team', {
      matches: { next: matches.next.slice(0, 5), results: matches.results.slice(0, 10) },
      /** The league's teams by their starters' average LP, this one among them. */
      leagueTeams: standing?.teams ?? [],
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
        alt: `${team.name}'s logo and its players' photos and names, with two poros`,
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

  /**
   * `/cdn/team/:id?s=40`: a team's logo, from our own origin, at a served size or full size, for
   * the dark ground (`?on=light` for the light one: a logo drawn in ink lost there is redrawn).
   */
  async logo({ params, request, response }: HttpContext) {
    const logo = await teamLogoService.get(
      String(params.id),
      logoSize(request.input('s')),
      groundOf(request.input('on'))
    )
    if (!logo) return response.notFound()
    response.header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    return this.send(response, logo)
  }

  /**
   * `/cdn/league/:slug?s=40`: a league's logo, for the dark ground or the light one (`?on=light`),
   * as a team's. The repository's files only change with a new address; a stored logo can
   * change, so it is kept a day.
   */
  async leagueLogo({ params, request, response }: HttpContext) {
    const slug = String(params.slug).replace(/\.webp$/, '')
    const logo = await teamLogoService.league(
      slug,
      logoSize(request.input('s')),
      groundOf(request.input('on'))
    )
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
