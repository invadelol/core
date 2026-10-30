import { test } from '@japa/runner'
import { buildRowsSql, itemKinds, summarizeBuilds, type BuildRow } from '#services/build_stats'

const rift = { '11': true }
/** Data Dragon items, the fields read: a mage's road and the items around it. */
const ITEMS = {
  '1001': { into: ['3020'], gold: { total: 300, purchasable: true }, tags: ['Boots'], maps: rift },
  '3020': { from: ['1001'], gold: { total: 1100, purchasable: true }, tags: ['Boots'], maps: rift },
  '1052': { into: ['3802'], gold: { total: 400, purchasable: true }, maps: rift },
  '3802': { from: ['1052'], into: ['6655'], gold: { total: 1200, purchasable: true }, maps: rift },
  '6655': { from: ['3802', '1052'], gold: { total: 2900, purchasable: true }, maps: rift },
  '3089': { from: ['1058'], gold: { total: 3600, purchasable: true }, maps: rift },
  '1058': { into: ['3089'], gold: { total: 1200, purchasable: true }, maps: rift },
  '3003': { from: ['3070'], into: ['3040'], gold: { total: 2900, purchasable: true }, maps: rift },
  // Seraph's Embrace: Archangel's Staff transforms into it, nobody buys it.
  '3040': { from: ['3003'], gold: { total: 2900, purchasable: false }, maps: rift },
  '3070': { into: ['3003'], gold: { total: 400, purchasable: true }, maps: rift },
  '1056': { gold: { total: 400, purchasable: true }, maps: rift },
  '2003': { gold: { total: 50, purchasable: true }, tags: ['Consumable'], maps: rift },
  '3340': { gold: { total: 0, purchasable: true }, tags: ['Trinket'], maps: rift },
  // Arena's copy of Rabadon's: not on the Rift.
  '223089': { from: ['1058'], gold: { total: 3600, purchasable: true }, maps: { '30': true } },
}

const LUDENS = 6655
const RABADON = 3089
const ARCHANGEL = 3003
const SHOES = 3020

test.group('Build stats', () => {
  test('tells boots, legendary items and trinkets apart as the app does', ({ assert }) => {
    const kinds = itemKinds(ITEMS)
    assert.deepEqual(kinds.boots, [SHOES])
    assert.deepEqual(kinds.legendary, [ARCHANGEL, RABADON, LUDENS])
    assert.deepEqual(kinds.trinkets, [3340])
    assert.equal(kinds.gold[1056], 400)
    assert.notProperty(kinds.gold, '223089')
  })

  test('merges the orders of a core and keeps the one most bought', ({ assert }) => {
    const rows: BuildRow[] = [
      ['games', [], 0, 1000, 520],
      ['core', [LUDENS, SHOES, RABADON], 0, 10, 5],
      ['core', [LUDENS, RABADON, ARCHANGEL], 0, 300, 160],
      ['core', [RABADON, LUDENS, ARCHANGEL], 0, 100, 50],
      ['core', [ARCHANGEL, LUDENS, RABADON], 0, 50, 30],
    ]
    const stats = summarizeBuilds(rows, itemKinds(ITEMS))
    assert.equal(stats.games, 1000)
    assert.equal(stats.win, 0.52)
    assert.deepEqual(stats.cores[0].items, [LUDENS, RABADON, ARCHANGEL])
    assert.equal(stats.cores[0].games, 450)
    assert.equal(stats.cores[0].share, round(450 / 460))
    assert.isFalse(stats.cores[0].tie)
  })

  test('starting items lead with the main item, boots and slots carry their own shares', ({
    assert,
  }) => {
    const rows: BuildRow[] = [
      ['games', [], 0, 1000, 500],
      ['start', [1056, 2003, 2003].sort((a, b) => a - b), 0, 900, 460],
      ['start', [1056, 2003], 0, 80, 40],
      ['boots', [SHOES], 0, 700, 360],
      ['slot', [RABADON], 1, 200, 120],
      ['slot', [ARCHANGEL], 1, 100, 50],
      ['slot', [ARCHANGEL], 2, 60, 35],
      ['item', [LUDENS], 0, 800, 420],
      ['item', [RABADON], 0, 200, 115],
    ]
    const stats = summarizeBuilds(rows, itemKinds(ITEMS))
    assert.deepEqual(stats.starters[0].items, [1056, 2003, 2003])
    assert.equal(stats.starters[0].share, round(900 / 980))
    assert.deepEqual(stats.boots[0], {
      items: [SHOES],
      games: 700,
      win: round(360 / 700),
      share: 1,
      level: 2,
      tie: false,
    })
    assert.deepEqual(
      stats.slots.map((s) => s.map((o) => [o.item, o.share])),
      [
        [
          [RABADON, round(200 / 300)],
          [ARCHANGEL, round(100 / 300)],
        ],
        [[ARCHANGEL, 1]],
        [],
      ]
    )
    assert.deepEqual(
      stats.items.map((i) => [i.item, i.share, i.level]),
      [
        [LUDENS, 0.8, 2],
        [RABADON, 0.2, 1],
      ]
    )
  })

  test('two cores played as often are a tie, capped at level 2', ({ assert }) => {
    const stats = summarizeBuilds(
      [
        ['core', [LUDENS, RABADON, ARCHANGEL], 0, 1700, 850],
        ['core', [LUDENS, RABADON, SHOES], 0, 1650, 825],
      ],
      itemKinds(ITEMS)
    )
    assert.deepEqual(
      stats.cores.map((c) => [c.level, c.tie]),
      [
        [2, true],
        [3, false],
      ]
    )
  })

  test('no games, no build', ({ assert }) => {
    assert.deepEqual(summarizeBuilds([], itemKinds(ITEMS)), {
      games: 0,
      win: 0,
      starters: [],
      boots: [],
      cores: [],
      slots: [],
      items: [],
    })
  })

  test('the query reads one champion, or every one with its role', ({ assert }) => {
    const kinds = itemKinds(ITEMS)
    const one = buildRowsSql('emerald_plus', { champion: 103, position: 'MIDDLE' }, kinds)
    assert.include(one, 'champion_id = {champion:UInt16}')
    assert.include(one, "seed_tier IN ('EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER')")
    assert.include(one, 'i IN (3003,3089,6655)')
    // One read of the games, every option counted in the same pass.
    assert.equal(one.match(/FROM participant_items FINAL/g)?.length, 1)
    // The bracket's crawled games are looked up among the champion's own only.
    assert.include(
      one,
      "seed_tier IN ('EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER') AND match_id IN (SELECT match_id FROM participant_items WHERE patch = {patch:String} AND queue_id = 420 AND champion_id = {champion:UInt16}"
    )
    assert.notInclude(
      buildRowsSql('emerald_plus', null, kinds),
      'SELECT match_id FROM participant_items'
    )
    const every = buildRowsSql('all', null, kinds)
    assert.notInclude(every, 'match_seed')
    assert.include(every, 'SELECT champion_id, team_position, o.1')
    assert.include(every, 'GROUP BY champion_id, team_position, o.1')
  })

  test('item ids wrap to UInt16 as the purchases store them, and no ids match nothing', ({
    assert,
  }) => {
    const kinds = { legendary: [3003, 3003 + 65536], boots: [], trinkets: [], gold: {} }
    const sql = buildRowsSql('all', { champion: 1, position: 'TOP' }, kinds)
    assert.include(sql, 'arrayFilter(i -> i IN (3003), purchases) AS bought')
    assert.include(sql, 'arrayFilter(i -> 0, purchases)[1] AS boots')
  })
})

function round(n: number) {
  return Math.round(n * 10 ** 4) / 10 ** 4
}
