import { test } from '@japa/runner'
import redis from '@adonisjs/redis/services/main'
import ladderService, { clickhouseSource, type LadderSource } from '#services/ladder_service'
import { redisHistory, type HistoryPoint, type HistoryStore } from '#services/ladder_history'
import flexLadderService, { postgresSource, type FlexSource } from '#services/flex_ladder_service'
import type { ApexEntry, GamesRow } from '#services/ladder'
import { SIGNATURE_GAMES } from '#services/pro_service'

/** Made-up players only: the repository is public. A PUUID is 78 characters. */
const puuid = (name: string) => `test-board-${name}-`.padEnd(78, 'x')
const NOW = Date.now()
const H = 3_600_000

function entry(name: string, tier: ApexEntry['tier'], lp: number, seenAt: number): ApexEntry {
  return {
    puuid: puuid(name),
    tier,
    lp,
    wins: 120,
    losses: 100,
    hotStreak: name === 'second',
    veteran: false,
    freshBlood: false,
    inactive: false,
    seenAt,
  }
}

const games = (name: string, champion: number, position: string, n: number, wins: number) =>
  ({
    puuid: puuid(name),
    champion,
    position,
    games: n,
    wins,
    kills: n * 4,
    deaths: n * 3,
    assists: n * 5,
    last: NOW - H,
  }) satisfies GamesRow

/** A server of four apex players: one pro, one one-trick, one who left the ladder. */
const fake: LadderSource = {
  reads: async () => [
    { tier: 'CHALLENGER', at: NOW - 2 * H, entries: 2 },
    { tier: 'GRANDMASTER', at: NOW - H, entries: 1 },
  ],
  entries: async () => [
    entry('first', 'CHALLENGER', 2400, NOW - 2 * H),
    entry('second', 'CHALLENGER', 1900, NOW - 2 * H),
    entry('third', 'GRANDMASTER', 1500, NOW - H),
    entry('gone', 'CHALLENGER', 2600, NOW - 40 * H),
  ],
  games: async () => ({
    games: [
      games('first', 103, 'MIDDLE', 18, 10),
      games('first', 7, 'MIDDLE', 15, 8),
      games('first', 238, 'MIDDLE', 10, 6),
      games('second', 55, 'MIDDLE', 30, 20),
      games('second', 7, 'MIDDLE', 6, 2),
      games('third', 64, 'JUNGLE', 12, 6),
      games('third', 121, 'JUNGLE', 12, 7),
      games('third', 9, 'JUNGLE', 5, 2),
    ],
    // The third player has no named game in the window: their older name is read instead.
    identities: new Map([
      [puuid('first'), { gameName: 'Test First', tagLine: 'TEST', icon: 29, level: 300 }],
      [puuid('second'), { gameName: 'Test Second', tagLine: 'TEST', icon: 30, level: 200 }],
    ]),
  }),
  identitiesOf: async () =>
    new Map([[puuid('third'), { gameName: 'Test Third', tagLine: 'TEST', icon: 31, level: 100 }]]),
  pros: async () => new Map([[puuid('third'), 'test-pro-id']]),
  proTags: async () =>
    new Map([['test-pro-id', { slug: 'test-pro', name: 'Test Pro', team: null, league: null }]]),
  recentGames: async () => new Map(),
  matches: async () => [],
  championGames: async (puuids, champion) =>
    champion === 55 && puuids.includes(puuid('second'))
      ? [1, 2, 3].map((i) => ({
          puuid: puuid('second'),
          items: [3020, 6655, 3157, i === 3 ? 3089 : 4645, 0, 0],
          keystone: 8112,
          secondaryStyle: 8300,
          spells: [4, 14] as [number, number],
          skillOrder: [],
          win: i < 3,
        }))
      : [],
}

/** A history kept in memory, empty at first. */
function memoryHistory(): HistoryStore {
  const points: HistoryPoint[] = []
  const lp = new Map<number, Record<string, number>>()
  return {
    points: async () => points,
    add: async (_platform, point, values) => {
      points.unshift(point)
      lp.set(point.at, values)
    },
    lp: async (_platform, at) => lp.get(at) ?? null,
  }
}

/** The props of an Inertia page, out of its HTML. */
function propsOf(html: string): Record<string, any> {
  const found = html.match(/data-page="([^"]*)"/)
  if (!found) throw new Error('no Inertia page in the response')
  const json = found[1]
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
  return JSON.parse(json).props
}

async function forget() {
  ladderService.clear()
  flexLadderService.clear()
  const keys = [
    ...(await redis.keys('stats:v1:ladder*')),
    ...(await redis.keys('stats:v1:flex-ladder*')),
  ]
  if (keys.length) await redis.del(...keys)
}

test.group('Leaderboards', (group) => {
  group.each.setup(async () => {
    await forget()
    ladderService.source = fake
    ladderService.history = memoryHistory()
  })
  group.each.teardown(async () => {
    ladderService.source = clickhouseSource
    ladderService.history = redisHistory
    flexLadderService.source = postgresSource
    await forget()
  })

  test('opens on the Solo/Duo ladder', async ({ client }) => {
    const response = await client.get('/leaderboards').redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/leaderboards/solo')
  })

  test('ranks the apex ladder from the stored league reads, without a PUUID', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/leaderboards/solo?region=euw')
    response.assertStatus(200)
    assert.notInclude(response.text(), 'test-board-')
    const props = propsOf(response.text())
    assert.deepEqual(
      props.rows.map((r: any) => [r.place, r.gameName, r.tier, r.lp]),
      [
        [1, 'Test First', 'CHALLENGER', 2400],
        [2, 'Test Second', 'CHALLENGER', 1900],
        [3, 'Test Third', 'GRANDMASTER', 1500],
      ]
    )
    assert.equal(props.rows[0].role, 'MIDDLE')
    assert.deepEqual(props.rows[0].champions[0], { champion: 103, games: 18, wins: 10 })
    assert.isTrue(props.rows[1].hotStreak)
    assert.equal(props.rows[2].pro.slug, 'test-pro')
    assert.deepEqual(
      props.cutoffs.map((c: any) => [c.tier, c.lp, c.players]),
      [
        ['CHALLENGER', 1900, 2],
        ['GRANDMASTER', 1500, 1],
      ]
    )
    // The head of the page: the first three, in ladder order.
    assert.deepEqual(
      props.podium.map((r: any) => r.place),
      [1, 2, 3]
    )
    // A first read: no moves yet, nothing made up in their place.
    assert.isNull(props.movesSince)
    assert.isNull(props.cutoffs[0].change)
    assert.isNull(props.rows[0].move)
    assert.equal(props.region.platform, 'EUW1')
  })

  test('filters the ladder by role, pros and name', async ({ client, assert }) => {
    const byRole = await client.get('/leaderboards/solo?role=jungle')
    const jungle = propsOf(byRole.text())
    assert.deepEqual(
      jungle.rows.map((r: any) => r.gameName),
      ['Test Third']
    )
    const prosOnly = await client.get('/leaderboards/solo?pros=1')
    const pros = propsOf(prosOnly.text())
    assert.deepEqual(
      pros.rows.map((r: any) => r.gameName),
      ['Test Third']
    )
    const byName = await client.get('/leaderboards/solo?q=second')
    const named = propsOf(byName.text())
    assert.deepEqual(
      named.rows.map((r: any) => r.gameName),
      ['Test Second']
    )
    assert.equal(named.robots, 'noindex,follow')
  })

  test('finds a Riot ID’s place on the ladder', async ({ client, assert }) => {
    const found = await client.get(
      '/api/leaderboards/solo/place?region=euw&riotId=test%20second%23test'
    )
    found.assertStatus(200)
    assert.equal(found.body().place, 2)
    assert.equal(found.body().total, 3)
    const missing = await client.get('/api/leaderboards/solo/place?region=euw&riotId=Nobody%23TEST')
    assert.isNull(missing.body().place)
    const bad = await client.get('/api/leaderboards/solo/place?riotId=nobody')
    bad.assertStatus(400)
  })

  test('lists the one-tricks by champion', async ({ client, assert }) => {
    const response = await client.get('/leaderboards/one-tricks?region=euw')
    response.assertStatus(200)
    const props = propsOf(response.text())
    assert.equal(props.oneTricks, 1)
    assert.deepEqual(props.champions, [
      {
        champion: 55,
        oneTricks: 1,
        byTier: { CHALLENGER: 1, GRANDMASTER: 0, MASTER: 0 },
        roles: [{ position: 'MIDDLE', oneTricks: 1 }],
      },
    ])
    assert.equal(props.selected.champion, 55)
    const [row] = props.selected.rows
    assert.equal(row.gameName, 'Test Second')
    assert.equal(row.games, 30)
    assert.equal(row.share, 0.833)
    assert.equal(row.winRate, 0.667)
    assert.deepEqual(row.also, { champion: 7, share: 0.167 })
    assert.isNull(row.mastery)
    assert.equal(row.build.games, 3)
    assert.equal(row.build.keystone, 8112)
    assert.equal(row.build.secondaryStyle, 8300)
    // Boots apart when the patch's item kinds are stored, among the items otherwise.
    assert.includeMembers([...row.build.core, row.build.boots], [3020, 6655, 3157])
    assert.equal(props.best.rows[0].best.gameName, 'Test Second')
    assert.deepEqual(props.rule, { minGames: 20, minShare: 0.5, windowDays: 30, recentDays: 14 })

    // A role lists every champion one-tricked in it, and nothing else.
    const mid = propsOf((await client.get('/leaderboards/one-tricks?role=mid')).text())
    assert.deepEqual(
      mid.best.rows.map((b: any) => [b.champion, b.position, b.oneTricks]),
      [[55, 'MIDDLE', 1]]
    )
    const top = propsOf((await client.get('/leaderboards/one-tricks?role=top')).text())
    assert.deepEqual(top.best.rows, [])
  })

  test('ranks the flex players Invade knows, with their role and champions', async ({
    client,
    assert,
  }) => {
    const flex: FlexSource = {
      entries: async () => [
        {
          puuid: puuid('flex-a'),
          gameName: 'Test flex-a',
          tagLine: 'TEST',
          icon: 1,
          level: 100,
          tier: 'MASTER',
          division: 'I',
          lp: 120,
          wins: 40,
          losses: 30,
          at: NOW,
        },
        {
          puuid: puuid('flex-b'),
          gameName: 'Test flex-b',
          tagLine: 'TEST',
          icon: 2,
          level: 90,
          tier: 'DIAMOND',
          division: 'II',
          lp: 50,
          wins: 20,
          losses: 22,
          at: NOW,
        },
      ],
      games: async () => [
        {
          puuid: puuid('flex-a'),
          champion: 10,
          position: 'TOP',
          games: 3,
          wins: 2,
          kills: 0,
          deaths: 0,
          assists: 0,
          last: NOW,
        },
        {
          puuid: puuid('flex-a'),
          champion: 11,
          position: 'TOP',
          games: 1,
          wins: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
          last: NOW,
        },
        {
          puuid: puuid('flex-b'),
          champion: 12,
          position: 'JUNGLE',
          games: 2,
          wins: 1,
          kills: 0,
          deaths: 0,
          assists: 0,
          last: NOW,
        },
      ],
    }
    flexLadderService.source = flex
    const response = await client.get('/leaderboards/flex?region=euw')
    response.assertStatus(200)
    assert.notInclude(response.text(), 'test-board-')
    const props = propsOf(response.text())
    assert.equal(props.scope.kind, 'tracked')
    assert.deepEqual(
      props.rows.map((r: any) => [r.place, r.gameName, r.tier, r.division]),
      [
        [1, 'Test flex-a', 'MASTER', null],
        [2, 'Test flex-b', 'DIAMOND', 'II'],
      ]
    )
    assert.equal(props.rows[0].role, 'TOP')
    assert.equal(props.rows[0].games, 4)
    assert.deepEqual(
      props.rows[0].champions.map((c: any) => c.champion),
      [10, 11]
    )
    assert.equal(props.rows[1].role, 'JUNGLE')
    assert.notProperty(props, 'groups')
    assert.notProperty(props.rows[0], 'queuesWith')
  })

  test('answers the pro ladder from the stored pro data, the first league by default', async ({
    client,
    assert,
  }) => {
    const pros = await client.get('/leaderboards/pros')
    pros.assertStatus(200)
    const props = propsOf(pros.text())
    assert.containsSubset(Object.keys(props), ['apex', 'podium', 'rows', 'teams', 'leagues'])
    assert.notEqual(props.filters.league, 'all')
    const all = await client.get('/leaderboards/pros?league=all&role=mid&q=zz')
    all.assertStatus(200)
    assert.equal(propsOf(all.text()).filters.league, 'all')
  }).timeout(60_000)

  test("a pro's page stands them before a champion they play, never a one-game pick", async ({
    client,
    assert,
  }) => {
    const board = propsOf((await client.get('/leaderboards/pros')).text())
    for (const r of board.rows.slice(0, 5)) {
      const page = await client.get(`/pro/${r.pro.slug}`)
      page.assertStatus(200)
      const props = propsOf(page.text())
      assert.notProperty(props, 'ladder')
      if (props.signature === null) continue
      assert.isAbove(props.signature.champion, 0)
      assert.isAtLeast(props.signature.games, SIGNATURE_GAMES)
      assert.isAtMost(props.signature.wins, props.signature.games)
    }
  }).timeout(120_000)

  test('the pros page leads to the pro ladder, its league kept', async ({ client, assert }) => {
    const bare = await client.get('/pros').redirects(0)
    bare.assertStatus(302)
    assert.equal(bare.header('location'), '/leaderboards/pros')
    const lfl = await client.get('/pros?league=lfl&role=mid').redirects(0)
    lfl.assertStatus(302)
    assert.equal(lfl.header('location'), '/leaderboards/pros?role=mid&league=lfl')
    const ladder = await client.get('/pros?view=ladder').redirects(0)
    ladder.assertStatus(301)
    assert.equal(ladder.header('location'), '/leaderboards/pros?league=all')
  }).timeout(60_000)

  test("a league's board lists its players, the unranked last", async ({ client, assert }) => {
    const board = await client.get('/leaderboards/pros')
    board.assertStatus(200)
    const props = propsOf(board.text())
    const places = props.rows.map((r: { place: number }) => r.place)
    assert.deepEqual(
      places,
      [...places].sort((a: number, b: number) => a - b)
    )
    // A league's board says who sits on the bench; every league's does not.
    for (const r of props.rows) assert.isBoolean(r.sub)
    const sorted = propsOf((await client.get('/leaderboards/pros?sort=name&dir=asc')).text())
    const names = sorted.rows.map((r: { pro: { name: string } }) => r.pro.name)
    assert.deepEqual(
      names,
      [...names].sort((a: string, b: string) => a.localeCompare(b, 'en'))
    )
  }).timeout(60_000)

  test('answers the esports overview from the stored pro data', async ({ client, assert }) => {
    const esports = await client.get('/esports')
    esports.assertStatus(200)
    assert.containsSubset(Object.keys(propsOf(esports.text())), [
      'headline',
      'live',
      'next',
      'results',
      'leagues',
      'leaders',
      'event',
      'climbers',
      'moves',
    ])
    const teams = await client.get('/teams?league=lec')
    teams.assertStatus(200)
    assert.containsSubset(Object.keys(propsOf(teams.text())), ['boards'])
  }).timeout(60_000)
})
