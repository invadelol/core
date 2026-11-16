import { test } from '@japa/runner'
import championStatsService from '#services/champion_stats_service'
import tierListsService from '#services/tier_lists_service'
import type { Filter } from '#services/champion_stats'

const PATCHES = [
  { patch: '16.21', games: 2_700_000 },
  { patch: '16.20', games: 1_000_000 },
]

/** The Inertia version the site serves, read from a full page load. */
function versionOf(html: string) {
  return /&quot;version&quot;:&quot;([^&]+)&quot;/.exec(html)?.[1] ?? ''
}

test.group('Tier lists of items, runes, duos and ARAM', (group) => {
  const { filter, patches } = championStatsService
  const { items, runes, duos, aram } = tierListsService
  group.each.teardown(() => {
    Object.assign(championStatsService, { filter, patches })
    Object.assign(tierListsService, { items, runes, duos, aram })
  })

  /** Filters as the service fills them; each list answers what it was asked for. */
  function stub() {
    const asked: unknown[] = []
    championStatsService.patches = async () => PATCHES
    championStatsService.filter = async (input) =>
      ({
        patch: String(input.patch ?? '16.21'),
        patches: [String(input.patch ?? '16.21')],
        bracket: input.rank ?? 'emerald_plus',
        region: input.region ?? null,
      }) as Filter
    tierListsService.items = async (f, position, cls) => {
      asked.push(['items', f.bracket, position, cls])
      return { rows: [], position, class: cls } as never
    }
    tierListsService.runes = async (f, position) => {
      asked.push(['runes', f.bracket, position])
      return { rows: [], position } as never
    }
    tierListsService.duos = async (f, lane) => {
      asked.push(['duos', f.bracket, lane])
      return { rows: [], lane } as never
    }
    tierListsService.aram = async (f, mode) => {
      asked.push(['aram', f.bracket, mode])
      return { rows: [], mode } as never
    }
    return asked
  }

  const pages = [
    [
      '/tier-list/items?role=mid&class=mage',
      'tier_lists/items',
      ['items', 'emerald_plus', 'MIDDLE', 'mage'],
    ],
    ['/tier-list/items?class=bogus', 'tier_lists/items', ['items', 'emerald_plus', null, null]],
    [
      '/tier-list/runes?role=support&rank=diamond_plus',
      'tier_lists/runes',
      ['runes', 'diamond_plus', 'UTILITY'],
    ],
    ['/tier-list/duos?lane=mid', 'tier_lists/duos', ['duos', 'emerald_plus', 'mid']],
    ['/tier-list/duos?lane=aram', 'tier_lists/duos', ['duos', 'emerald_plus', 'bot']],
    // ARAM has no rank: every stored game counts, whatever the address says.
    ['/tier-list/aram?mode=mayhem&rank=gold', 'tier_lists/aram', ['aram', 'all', 'mayhem']],
  ] as const

  for (const [path, component, expected] of pages) {
    test(`${path} renders ${component} with its list`, async ({ client, assert }) => {
      const asked = stub()
      const page = await client.get(path)
      page.assertStatus(200)
      page.assertTextIncludes(`&quot;component&quot;:&quot;${component}&quot;`)
      assert.deepEqual(asked[0], expected)

      const visit = await client
        .get(path)
        .header('x-inertia', 'true')
        .header('x-inertia-version', versionOf(page.text()))
      visit.assertStatus(200)
      const props = visit.body().props
      assert.isArray(props.list.rows)
      assert.deepEqual(props.patches, PATCHES)
      assert.include(props.social.url, path.split('?')[0])
      assert.equal(props.jsonld[0].itemListElement[0].name, 'Tier list')
    })
  }

  test('a filter other than the default is not indexed', async ({ client, assert }) => {
    stub()
    const first = await client.get('/tier-list/runes')
    const page = await client
      .get('/tier-list/runes?rank=gold')
      .header('x-inertia', 'true')
      .header('x-inertia-version', versionOf(first.text()))
    page.assertStatus(200)
    assert.equal(page.body().props.robots, 'noindex,follow')
  })
})

test.group('Champion directory', () => {
  test('the old directory leads to the tier list, with its role', async ({ client }) => {
    const all = await client.get('/champions').redirects(0)
    all.assertStatus(301)
    all.assertHeader('location', '/tier-list')
    const mid = await client.get('/champions?role=middle&tab=items').redirects(0)
    mid.assertStatus(301)
    mid.assertHeader('location', '/tier-list?role=mid')
  })
})

test.group('Matchup page', (group) => {
  const { champions, champion, patches, filter } = championStatsService
  group.each.teardown(() => {
    Object.assign(championStatsService, { champions, champion, patches, filter })
  })

  const AHRI = { id: 103, name: 'Ahri', slug: 'ahri', alias: 'Ahri', roles: ['mage'] }
  const SYNDRA = { id: 134, name: 'Syndra', slug: 'syndra', alias: 'Syndra', roles: ['mage'] }

  function stub() {
    championStatsService.champions = async () => [AHRI, SYNDRA]
    championStatsService.champion = async (slug) =>
      [AHRI, SYNDRA].find((c) => c.slug === slug) ?? null
    championStatsService.patches = async () => PATCHES
    // No stored games yet: the page still answers, with no side to show.
    championStatsService.filter = async () => null
  }

  test('two champions of the same lane, side by side', async ({ client, assert }) => {
    stub()
    const page = await client.get('/champions/ahri/matchups/syndra?role=mid')
    page.assertStatus(200)
    page.assertTextIncludes('&quot;component&quot;:&quot;champions/matchup&quot;')
    const visit = await client
      .get('/champions/ahri/matchups/syndra?role=mid')
      .header('x-inertia', 'true')
      .header('x-inertia-version', versionOf(page.text()))
    const props = visit.body().props
    assert.equal(props.champion.slug, 'ahri')
    assert.equal(props.opponent.slug, 'syndra')
    assert.equal(props.position, 'MIDDLE')
    assert.isNull(props.expected)
    assert.equal(props.robots, 'noindex,follow')
    assert.equal(props.jsonld[0].itemListElement[2].name, 'Against Syndra')
  })

  test('an unknown opponent, or the champion itself, is the site’s 404 page', async ({
    client,
  }) => {
    stub()
    for (const path of ['/champions/ahri/matchups/nobody', '/champions/ahri/matchups/ahri']) {
      const page = await client.get(path)
      page.assertStatus(404)
      page.assertTextIncludes('&quot;component&quot;:&quot;errors/not_found&quot;')
    }
  })
})

test.group('Champion tier list', (group) => {
  const { champions, summary, previous, patches, filter } = championStatsService
  group.each.teardown(() => {
    Object.assign(championStatsService, { champions, summary, previous, patches, filter })
  })

  const role = (champion: number, position: string, rank: number, tier: number, games = 500) => ({
    champion,
    position,
    games,
    win: 0.5,
    pick: 0.05,
    ban: 0.01,
    roleShare: 0.9,
    tier,
    rank,
    level: 3,
  })

  function stub() {
    championStatsService.patches = async () => PATCHES
    championStatsService.filter = async () =>
      ({ patch: '16.21', patches: ['16.21'], bracket: 'emerald_plus', region: null }) as Filter
    championStatsService.champions = async () =>
      [1, 2, 3].map((id) => ({
        id,
        name: `Champion ${id}`,
        slug: `champion-${id}`,
        alias: `C${id}`,
        roles: ['mage'],
      }))
    championStatsService.summary = async () =>
      ({
        patch: '16.21',
        bracket: 'emerald_plus',
        region: null,
        games: 1000,
        roles: [
          role(1, 'MIDDLE', 2, 1),
          role(2, 'MIDDLE', 1, 0),
          role(3, 'TOP', 1, 0),
          role(1, 'TOP', 2, 4),
        ],
        ranked: { TOP: 2, MIDDLE: 2, JUNGLE: 0, BOTTOM: 0, UTILITY: 0 },
      }) as never
    championStatsService.previous = async () =>
      ({
        patch: '16.20',
        bracket: 'emerald_plus',
        region: null,
        games: 900,
        roles: [role(2, 'MIDDLE', 2, 1), role(1, 'MIDDLE', 1, 0)],
        ranked: { TOP: 0, MIDDLE: 2, JUNGLE: 0, BOTTOM: 0, UTILITY: 0 },
      }) as never
  }

  test('every role by default, each row with its place on the patch before', async ({
    client,
    assert,
  }) => {
    stub()
    const page = await client.get('/tier-list')
    page.assertStatus(200)
    const visit = await client
      .get('/tier-list')
      .header('x-inertia', 'true')
      .header('x-inertia-version', versionOf(page.text()))
    const props = visit.body().props
    assert.isNull(props.position)
    // By tier first, then by place in the role.
    assert.deepEqual(
      props.rows.map((r: { champion: number; position: string }) => `${r.champion}:${r.position}`),
      ['2:MIDDLE', '3:TOP', '1:MIDDLE', '1:TOP']
    )
    assert.equal(props.rows[0].before, 2)
    assert.isNull(props.rows[1].before)
    assert.equal(props.previousPatch, '16.20')
  })

  test('one role with ?role=', async ({ client, assert }) => {
    stub()
    const page = await client.get('/tier-list?role=mid')
    const visit = await client
      .get('/tier-list?role=mid')
      .header('x-inertia', 'true')
      .header('x-inertia-version', versionOf(page.text()))
    const props = visit.body().props
    assert.equal(props.position, 'MIDDLE')
    assert.deepEqual(
      props.rows.map((r: { champion: number }) => r.champion),
      [2, 1]
    )
  })
})
