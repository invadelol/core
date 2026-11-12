import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import proService from '#services/pro_service'
import proLadderService, { type LadderRow } from '#services/pro_ladder_service'
import proMatchService, { type ProMatch } from '#services/pro_match_service'
import { leagueCatalog } from '#services/pro_leagues'

/** Fictional players, teams and leagues only: the repository is public. */
const TEAM = {
  id: '00000000-0000-4000-8000-0000000000a1',
  slug: 'test-ember-wolves',
  name: 'Ember Wolves',
  shortName: 'EW',
  region: 'EMEA',
}
const LEAGUE = { slug: 'lec', code: 'LEC', name: 'A league', region: 'EMEA' }

const ladderRow = (place: number, name: string, lp: number): LadderRow => ({
  place,
  pro: {
    slug: name.toLowerCase(),
    name,
    role: 'MID',
    country: 'FR',
    staff: false,
    team: place === 1 ? TEAM : null,
    ...(place === 1 ? { photo: 'a1b2c3d4' } : {}),
  },
  league: place === 1 ? LEAGUE : null,
  account: {
    id: `00000000-0000-4000-8000-00000000000${place}`,
    gameName: name,
    tagLine: 'TEST',
    platform: 'KR',
    tier: 'CHALLENGER',
    division: 1,
    lp,
  },
  move: place === 1 ? { places: 2, lp: 87 } : null,
})

const match = (id: number, over: Partial<ProMatch> = {}): ProMatch => ({
  id,
  league: { slug: 'lec', code: 'LEC', name: 'A league' },
  tournament: 'Playoffs',
  name: 'Final: EW vs NH',
  at: new Date(Date.now() + 86_400_000).toISOString(),
  status: 'not_started',
  bestOf: 5,
  teams: [
    { id: TEAM.id, slug: TEAM.slug, name: TEAM.name, code: 'EW', score: 0 },
    { id: null, slug: null, name: 'Night Herons', code: 'NH', score: 0 },
  ],
  winner: null,
  stream: 'https://example.com/stream',
  ...over,
})

/** The Inertia version the site serves, read from a full page load. */
function versionOf(html: string) {
  return /&quot;version&quot;:&quot;([^&]+)&quot;/.exec(html)?.[1] ?? ''
}

test.group('Pros API: ladder', (group) => {
  const { ladder, servers } = proLadderService
  group.each.teardown(() => {
    proLadderService.ladder = ladder
    proLadderService.servers = servers
  })

  /** A ladder of two pros on one server, with what was asked of it. */
  function stub() {
    const asked: unknown[] = []
    const rows = [ladderRow(1, 'Mirelight', 1500), ladderRow(2, 'Quietfen', 1200)]
    proLadderService.ladder = async (opts = {}) => {
      asked.push(opts)
      return { total: 120, rows }
    }
    proLadderService.servers = async (role) => {
      asked.push({ serversOf: role ?? null })
      return [{ platform: 'KR', label: 'KR', slug: 'kr', pros: 120 }]
    }
    return asked
  }

  test('answers a page of rows with the total and the servers', async ({ client, assert }) => {
    const asked = stub()
    const response = await client.get('/api/pros/ladder?server=kr&role=mid&page=2')
    response.assertStatus(200)
    assert.deepEqual(asked, [
      { platform: 'KR', role: 'MID', limit: 50, offset: 50 },
      { serversOf: 'MID' },
    ])
    assert.deepEqual(response.body(), {
      total: 120,
      page: 2,
      pageSize: 50,
      servers: [{ slug: 'kr', label: 'KR', pros: 120 }],
      rows: [
        {
          place: 1,
          pro: {
            slug: 'mirelight',
            name: 'Mirelight',
            photo: 'a1b2c3d4',
            role: 'MID',
            country: 'FR',
            team: { id: TEAM.id, slug: TEAM.slug, name: TEAM.name, shortName: 'EW' },
          },
          league: { slug: 'lec', code: 'LEC' },
          account: { platform: 'KR', tier: 'CHALLENGER', division: 1, lp: 1500 },
          move: { places: 2, lp: 87 },
        },
        {
          place: 2,
          pro: { slug: 'quietfen', name: 'Quietfen', role: 'MID', country: 'FR', team: null },
          league: null,
          account: { platform: 'KR', tier: 'CHALLENGER', division: 1, lp: 1200 },
          move: null,
        },
      ],
    })
    // No account identifier leaves with a row.
    assert.notInclude(response.text(), 'TEST')
    assert.notInclude(response.text(), 'gameName')
    assert.include(response.header('cache-control'), 'public, max-age=300')
  })

  test('an unknown server, role or page reads as the first page of everyone', async ({
    client,
    assert,
  }) => {
    const asked = stub()
    const response = await client.get('/api/pros/ladder?server=moon&role=coach&page=abc')
    response.assertStatus(200)
    assert.deepEqual(asked[0], { platform: null, role: null, limit: 50, offset: 0 })
    assert.equal(response.body().page, 1)

    const last = await client.get('/api/pros/ladder?role=adc&page=9999')
    assert.deepEqual(asked[2], { platform: null, role: 'ADC', limit: 50, offset: 49 * 50 })
    assert.equal(last.body().page, 50)
  })

  test('an unreadable ladder answers empty', async ({ client, assert }) => {
    proLadderService.ladder = async () => {
      throw new Error('down')
    }
    proLadderService.servers = async () => {
      throw new Error('down')
    }
    const response = await client.get('/api/pros/ladder')
    response.assertStatus(200)
    assert.deepEqual(response.body(), { total: 0, page: 1, pageSize: 50, servers: [], rows: [] })
  })

  test('the page gets the same rows', async ({ client, assert }) => {
    stub()
    const path = '?server=kr&role=mid&page=2'
    const api = await client.get(`/api/pros/ladder${path}`)
    const html = await client.get(`/pros?view=ladder${path.replace('?', '&')}`)
    html.assertStatus(200)
    const visit = await client
      .get(`/pros?view=ladder${path.replace('?', '&')}`)
      .header('x-inertia', 'true')
      .header('x-inertia-version', versionOf(html.text()))
    visit.assertStatus(200)
    const { props } = visit.body()
    assert.deepEqual(props.ladder, api.body().rows)
    assert.deepEqual(props.servers, api.body().servers)
    assert.deepEqual(
      [props.total, props.page, props.pageSize],
      [api.body().total, api.body().page, api.body().pageSize]
    )
  })
})

test.group('Pros API: matches', (group) => {
  const { upcoming } = proMatchService
  group.each.teardown(() => {
    proMatchService.upcoming = upcoming
  })

  function stub(list: ProMatch[] = [match(1), match(2)]) {
    const asked: unknown[] = []
    proMatchService.upcoming = async (slugs, limit) => {
      asked.push([slugs, limit])
      return list
    }
    return asked
  }

  test('answers the next games of every league, or of one', async ({ client, assert }) => {
    const asked = stub()
    const catalog = await leagueCatalog()
    const response = await client.get('/api/pros/matches')
    response.assertStatus(200)
    assert.deepEqual(asked[0], [catalog.all.map((l) => l.slug), 12])
    assert.deepEqual(Object.keys(response.body()), ['upcoming'])
    assert.deepEqual(
      response.body().upcoming.map((m: ProMatch) => m.id),
      [1, 2]
    )
    assert.deepEqual(Object.keys(response.body().upcoming[0]), [
      'id',
      'league',
      'tournament',
      'name',
      'at',
      'status',
      'bestOf',
      'teams',
      'winner',
      'stream',
    ])
    assert.include(response.header('cache-control'), 'public, max-age=60')

    const first = catalog.first!
    const one = await client.get(`/api/pros/matches?league=${first.slug.toUpperCase()}`)
    one.assertStatus(200)
    assert.deepEqual(asked[1], [[first.slug], 12])
  })

  test('an unknown league answers 404', async ({ client, assert }) => {
    const asked = stub()
    const response = await client.get('/api/pros/matches?league=not-a-league')
    response.assertStatus(404)
    assert.deepEqual(response.body(), { error: 'Unknown league' })
    assert.lengthOf(asked, 0)
  })
})

test.group('Pros API: several leagues’ next games', (group) => {
  const LEAGUES = ['test-api-league-a', 'test-api-league-b', 'test-api-league-c']
  const HOUR = 3_600_000
  group.each.teardown(async () => {
    await db.from('pro_match').whereIn('league_slug', LEAGUES).delete()
    await db.from('pro_league').whereIn('slug', LEAGUES).delete()
  })

  test('reads them together, soonest first, without the played and the stale ones', async ({
    assert,
  }) => {
    await db.table('pro_league').insert(
      LEAGUES.map((slug, i) => ({
        slug,
        code: `T${i}`,
        name: `Test league ${i}`,
        tier: 1,
        priority: 900 + i,
      }))
    )
    const game = (id: number, league: string, inHours: number, status = 'not_started') => ({
      external_id: 990_000_000 + id,
      league_slug: league,
      name: `Game ${id}`,
      begin_at: new Date(Date.now() + inHours * HOUR),
      status,
      best_of: 3,
      team1_name: 'Ember Wolves',
      team1_code: 'EW',
      team2_name: 'Night Herons',
      team2_code: 'NH',
    })
    await db.table('pro_match').insert([
      game(1, LEAGUES[0], 30),
      game(2, LEAGUES[1], 5),
      game(3, LEAGUES[0], -1, 'running'),
      game(4, LEAGUES[1], 50),
      // Played, long past its start time without starting, and another league's.
      game(5, LEAGUES[0], -3, 'finished'),
      game(6, LEAGUES[0], -7),
      game(7, LEAGUES[2], 2),
    ])
    const ids = (list: ProMatch[]) => list.map((m) => m.id - 990_000_000)

    const both = await proMatchService.upcoming([LEAGUES[1], LEAGUES[0]], 12)
    assert.deepEqual(ids(both), [3, 2, 1, 4])
    assert.equal(both[0].league?.slug, LEAGUES[0])
    assert.deepEqual(both[0].teams[0], {
      id: null,
      slug: null,
      name: 'Ember Wolves',
      code: 'EW',
      score: null,
    })

    assert.deepEqual(ids(await proMatchService.upcoming([LEAGUES[0], LEAGUES[1]], 3)), [3, 2, 1])
    // A league's strip on `/pros` is the same read, of one league.
    assert.deepEqual(ids(await proMatchService.forLeague(LEAGUES[0], 4)), [3, 1])
    assert.deepEqual(await proMatchService.upcoming([], 12), [])
  })
})

test.group('Pros API: player', (group) => {
  const { player, search, board } = proService
  const { forTeam } = proMatchService
  group.each.teardown(() => {
    proService.player = player
    proService.search = search
    proService.board = board
    proMatchService.forTeam = forTeam
  })

  /** A pro as the service reads them, with the summaries only other pages use. */
  const PRO = {
    slug: 'mirelight',
    name: 'Mirelight',
    role: 'MID',
    country: 'FR',
    staff: false,
    team: TEAM,
    photo: 'a1b2c3d4',
    id: '00000000-0000-4000-8000-0000000000b1',
    socials: { x: 'https://example.com/mirelight' },
    league: LEAGUE,
    about: { firstName: 'Mire', lastName: 'Light', nationality: 'FR', birthday: '2001-02-03' },
    accounts: [
      {
        id: '00000000-0000-4000-8000-0000000000c1',
        platform: 'EUW1',
        gameName: 'Mirelight',
        tagLine: 'TEST',
        tier: 'CHALLENGER',
        division: 1,
        lp: 1500,
        wins: 210,
        losses: 150,
        peakTier: 'CHALLENGER',
        peakDivision: 1,
        peakLp: 1720,
      },
    ],
    teams: [
      {
        team: TEAM,
        league: LEAGUE,
        title: 'player',
        role: 'MID',
        current: true,
        joinedAt: '2026-01-05T00:00:00.000Z',
        leftAt: null,
      },
    ],
    games: [
      {
        matchId: 'EUW1_1',
        account: 'Mirelight#TEST',
        platform: 'EUW1',
        startMs: 1_790_000_000_000,
        champion: 103,
        position: 'MIDDLE',
        win: true,
        kills: 7,
        deaths: 2,
        assists: 9,
        cs: 250,
        items: [3157, 3089, 3020, 0, 0, 0],
        spells: [4, 14],
        keystone: 8112,
        secondaryStyle: 8200,
        durationSec: 1800,
        opponent: 238,
        opponentName: 'Quietfen',
      },
    ],
    record: { games: 1, wins: 1, kills: 7, deaths: 2, assists: 9 },
    champions: [{ champion: 103, games: 1, wins: 1, kda: 8 }],
    roles: [{ position: 'MIDDLE', games: 1 }],
    items: [{ item: 3157, games: 1, wins: 1 }],
    builds: [
      {
        champion: 103,
        games: 1,
        wins: 1,
        kda: 8,
        boots: 3020,
        core: [3157, 3089],
        coreGames: 1,
        keystone: 8112,
        secondaryStyle: 8200,
        spells: [4, 14],
        max: ['Q', 'W', 'E'],
        form: [true],
      },
    ],
    pools: {},
  }

  function stub() {
    const asked: string[] = []
    proService.player = (async (slug: string) => {
      asked.push(slug)
      return slug === PRO.slug ? PRO : null
    }) as unknown as typeof proService.player
    proMatchService.forTeam = async (teamId) => {
      asked.push(`team:${teamId}`)
      return [
        match(10, { status: 'finished', at: new Date(Date.now() - 86_400_000).toISOString() }),
        match(11, { status: 'finished', at: new Date(Date.now() - 3_600_000).toISOString() }),
        match(12),
        match(13, { at: new Date(Date.now() + 2 * 86_400_000).toISOString() }),
      ]
    }
    return asked
  }

  test('answers the pro as their page shows them, without the page’s own parts', async ({
    client,
    assert,
  }) => {
    const asked = stub()
    const response = await client.get('/api/pros/player/mirelight')
    response.assertStatus(200)
    assert.deepEqual(asked, ['mirelight', `team:${TEAM.id}`])
    const body = response.body()
    assert.deepEqual(Object.keys(body).sort(), ['matches', 'pro'])
    const { id, champions, roles, items, pools, ...shown } = PRO
    assert.deepEqual(body.pro, shown)
    assert.equal(body.pro.accounts[0].peakLp, 1720)
    assert.equal(body.pro.builds[0].champion, 103)
    // Their team's next match and last result.
    assert.equal(body.matches.next.id, 12)
    assert.equal(body.matches.last.id, 11)
    assert.include(response.header('cache-control'), 'public, max-age=300')
  })

  test('a pro without a team has no match, and no team is asked for', async ({
    client,
    assert,
  }) => {
    const asked = stub()
    proService.player = (async () => ({
      ...PRO,
      team: null,
    })) as unknown as typeof proService.player
    const response = await client.get('/api/pros/player/mirelight')
    response.assertStatus(200)
    assert.isNull(response.body().pro.team)
    assert.deepEqual(response.body().matches, { next: null, last: null })
    assert.lengthOf(asked, 0)
  })

  test('an unknown pro answers 404', async ({ client, assert }) => {
    stub()
    const response = await client.get('/api/pros/player/nobody')
    response.assertStatus(404)
    assert.deepEqual(response.body(), { error: 'Pro not found' })
  })

  test('the search and a game’s players keep their addresses', async ({ client, assert }) => {
    stub()
    proService.search = (async (q: string) => ({
      pros: [],
      teams: [],
      accounts: [{ q }],
    })) as unknown as typeof proService.search
    proService.board = (async (matchId: string) => ({
      matchId,
    })) as unknown as typeof proService.board
    const found = await client.get('/api/pros/search?q=mi')
    found.assertStatus(200)
    assert.deepEqual(found.body().accounts, [{ q: 'mi' }])
    const game = await client.get('/api/pros/games/EUW1_1')
    game.assertStatus(200)
    assert.deepEqual(game.body(), { matchId: 'EUW1_1' })
  })
})
