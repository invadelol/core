import { test } from '@japa/runner'
import {
  bracketTiers,
  championClasses,
  delta,
  gate,
  placeTiers,
  shrunk,
} from '#services/tier_lists'
import {
  ITEM_KINDS,
  itemBlob,
  itemRowsSql,
  itemText,
  itemView,
  recipesOf,
  roleItemCounts,
  type ItemCounts,
  type ItemRow,
} from '#services/item_tier_list'
import {
  RUNE_KINDS,
  keystoneTrees,
  runeBlob,
  mergeRuneCounts,
  roleRuneCounts,
  runeRowsSql,
  runeView,
  type RuneRow,
} from '#services/rune_tier_list'
import {
  duoBlob,
  duoCounts,
  duoLaneOf,
  duoRowsSql,
  duoView,
  type DuoRow,
} from '#services/duo_tier_list'
import {
  MIN_ARAM_GAMES,
  aramCounts,
  aramModeOf,
  aramRowsSql,
  aramView,
  type AramRow,
} from '#services/aram_tier_list'
import { log5 } from '#services/matchup_stats'

// Game ids only (items, runes, champions): no player anywhere.
const LUDENS = 6655
const SHADOWFLAME = 4645
const RABADON = 3089
const INFINITY_EDGE = 3031
const SHOES = 3020
const ALTERNATOR = 3145
const ROD = 1058
const AHRI = 103
const SYNDRA = 134
const JINX = 222
const THRESH = 412
const LULU = 117

const rift = { '11': true }
const ITEMS = {
  [LUDENS]: { from: ['3802', String(ALTERNATOR)], gold: { total: 2750 }, maps: rift },
  [SHADOWFLAME]: {
    name: 'Shadowflame',
    from: [String(ALTERNATOR), String(ROD)],
    gold: { total: 3200 },
    maps: rift,
    description:
      '<mainText><stats><attention>110</attention> Ability Power<br><attention>15</attention> Magic Penetration</stats><br><br><passive>Cinderbloom</passive><br><magicDamage>Magic</magicDamage> damage <attention>critically strikes</attention> low enemies.</mainText>',
  },
  [RABADON]: { from: [String(ROD), String(ROD)], gold: { total: 3500 }, maps: rift },
  [ALTERNATOR]: { from: ['1052', '1052'], gold: { total: 1100 }, maps: rift },
  [ROD]: { gold: { total: 1200 }, maps: rift },
  1052: { gold: { total: 400 }, maps: rift },
}

test.group('Tier lists: shared counting', () => {
  test('pulls small samples toward the mean and tiers by place', ({ assert }) => {
    assert.equal(shrunk(0, 0, 0.5, 100), 0.5)
    assert.isBelow(shrunk(10, 10, 0.5, 100), 0.6)
    const rows = [
      { id: 'big-winner', games: 5000, wins: 2750 },
      { id: 'small-winner', games: 60, wins: 50 },
      { id: 'loser', games: 5000, wins: 2300 },
      { id: 'thin', games: 5, wins: 5 },
    ]
    const tiers = placeTiers(rows, 50, 1000)
    assert.isFalse(tiers.has(rows[3]))
    const order = [...tiers.keys()].map((r) => r.id)
    // A big sample winning a little beats a tiny one winning a lot.
    assert.deepEqual(order, ['big-winner', 'small-winner', 'loser'])
    assert.isAtMost(tiers.get(rows[0])!, tiers.get(rows[2])!)
  })

  test('gates scale with the games and changes need both patches', ({ assert }) => {
    assert.equal(gate(10_000, 0.001, 50), 50)
    assert.equal(gate(1_000_000, 0.001, 50), 1000)
    assert.isNull(delta({ games: 100, wins: 60 }, { games: 10, wins: 5 }, 50))
    assert.equal(delta({ games: 100, wins: 60 }, { games: 100, wins: 50 }, 50), 0.1)
  })

  test('takes a champion’s first known class as its main one', ({ assert }) => {
    const classes = championClasses([
      { id: AHRI, roles: ['mage', 'assassin'] },
      { id: 1, roles: ['unknown', 'tank'] },
      { id: 2, roles: [] },
    ])
    assert.equal(classes.get(AHRI), 'mage')
    assert.equal(classes.get(1), 'tank')
    assert.isFalse(classes.has(2))
  })
})

test.group('Tier lists: items', () => {
  test('reads each player once, with the recipes and the filter’s crawled games', ({ assert }) => {
    const recipes = recipesOf(ITEMS, [LUDENS, SHADOWFLAME, RABADON])
    // Each component once, smallest first.
    assert.deepEqual(recipes[RABADON], [ROD])
    assert.deepEqual(recipes[SHADOWFLAME], [ROD, ALTERNATOR])
    const sql = itemRowsSql(
      null,
      { legendary: [LUDENS, SHADOWFLAME, RABADON, 223089], boots: [SHOES], trinkets: [], gold: {} },
      recipes
    )
    assert.include(sql, `${SHADOWFLAME}, [${ROD},${ALTERNATOR}]`)
    assert.include(sql, `IN (${RABADON},${SHADOWFLAME},${LUDENS})`)
    // Every seed tier of one patch, every region.
    assert.include(sql, 'match_seed FINAL')
    assert.include(sql, 'GROUP BY tier')
    assert.notInclude(sql, 'platform IN')
    assert.include(sql, 'patch = {patch:String}')
    assert.include(sql, 'participant_items FINAL')
    assert.include(sql, 'team_position = {position:String}')
    // Arena's copies (ids past UInt16) are never asked for.
    assert.notInclude(sql, '223089')
  })

  test('ranks a role’s items, with their slot, builders, class and component order', ({
    assert,
  }) => {
    const { slot, boots, order, games } = ITEM_KINDS
    const E = 'EMERALD'
    const mid: ItemRow[] = [
      [E, games, AHRI, 0, 0, [], 1000, 520],
      [E, games, SYNDRA, 0, 0, [], 1000, 480],
      [E, games, JINX, 0, 0, [], 100, 50],
      [E, slot, AHRI, LUDENS, 1, [], 600, 330],
      [E, slot, SYNDRA, LUDENS, 1, [], 500, 240],
      [E, slot, AHRI, SHADOWFLAME, 2, [], 500, 270],
      [E, slot, SYNDRA, RABADON, 3, [], 300, 140],
      [E, slot, JINX, INFINITY_EDGE, 1, [], 90, 45],
      [E, boots, AHRI, SHOES, 1, [], 800, 0],
      [E, boots, AHRI, 0, 4, [], 200, 0],
      [E, boots, SYNDRA, SHOES, 0, [], 1000, 0],
      [E, order, 0, SHADOWFLAME, 0, [ALTERNATOR, ROD], 300, 160],
      [E, order, 0, SHADOWFLAME, 0, [ROD, ALTERNATOR], 100, 50],
    ]
    const top: ItemRow[] = [
      [E, games, AHRI, 0, 0, [], 50, 25],
      [E, slot, AHRI, LUDENS, 1, [], 50, 25],
    ]
    const tiers = bracketTiers('emerald_plus')
    const counts: ItemCounts = {
      roles: {
        MIDDLE: roleItemCounts([itemBlob(mid)], tiers),
        TOP: roleItemCounts([itemBlob(top)], tiers),
      },
    }
    const classes = championClasses([
      { id: AHRI, roles: ['mage'] },
      { id: SYNDRA, roles: ['mage'] },
      { id: JINX, roles: ['marksman'] },
    ])
    const legendary = { legendary: [LUDENS, SHADOWFLAME, RABADON, INFINITY_EDGE] }
    const view = itemView(counts, null, 'MIDDLE', 'mage', classes, legendary)
    assert.equal(view.games, 2100)
    // The marksman item is left out of the mage view.
    assert.sameMembers(
      view.rows.map((r) => r.item),
      [LUDENS, SHADOWFLAME, RABADON]
    )
    const ludens = view.rows.find((r) => r.item === LUDENS)!
    assert.equal(ludens.games, 1100)
    assert.equal(ludens.win, Math.round((570 / 1100) * 10000) / 10000)
    assert.deepEqual(ludens.slots, [1, 0, 0])
    assert.equal(ludens.champions[0].champion, AHRI)
    assert.equal(ludens.championCount, 2)
    assert.deepEqual(ludens.classes, ['mage'])
    assert.isNull(ludens.delta)
    // Best first.
    assert.equal(view.rows[0].item, SHADOWFLAME)
    assert.deepEqual(view.orders[SHADOWFLAME], {
      components: [ALTERNATOR, ROD],
      games: 300,
      of: 400,
    })
    // What the role's mages build: the two of them, their boots and when.
    assert.equal(view.build.champions, 2)
    assert.equal(view.build.games, 2000)
    assert.equal(view.build.slots[0][0].item, LUDENS)
    assert.equal(view.build.boots[0].item, SHOES)
    assert.equal(view.build.timing.before, 0.5)
    assert.equal(view.build.timing.first, 0.4)
    assert.equal(view.build.timing.never, 0.1)

    // Every role: top's games are added.
    const all = itemView(counts, null, null, null, classes, legendary)
    assert.equal(all.games, 2150)
    assert.include(
      all.rows.map((r) => r.item),
      INFINITY_EDGE
    )

    // Against the patch before, with enough games on both.
    const before: ItemCounts = {
      roles: {
        MIDDLE: roleItemCounts(
          [
            itemBlob([
              [E, games, AHRI, 0, 0, [], 1000, 500],
              [E, slot, AHRI, LUDENS, 1, [], 1000, 500],
            ]),
          ],
          tiers
        ),
      },
    }
    const moved = itemView(counts, before, 'MIDDLE', null, classes, legendary)
    const was = moved.rows.find((r) => r.item === LUDENS)!
    assert.equal(was.delta, Math.round((570 / 1100 - 0.5) * 10000) / 10000)
  })

  test('sums a bracket’s seed tiers and a range’s patches', ({ assert }) => {
    const { slot, games } = ITEM_KINDS
    const newer = itemBlob([
      ['EMERALD', games, AHRI, 0, 0, [], 100, 50],
      ['GOLD', games, AHRI, 0, 0, [], 300, 150],
      ['DIAMOND', slot, AHRI, LUDENS, 1, [], 40, 30],
      // A tier the crawler does not seed is left out.
      ['UNRANKED', games, AHRI, 0, 0, [], 5, 5],
    ])
    const older = itemBlob([
      ['EMERALD', games, AHRI, 0, 0, [], 60, 30],
      ['DIAMOND', slot, AHRI, LUDENS, 1, [], 10, 5],
    ])
    const emerald = roleItemCounts([newer, older], bracketTiers('emerald_plus'))
    assert.deepEqual(emerald.champions, [[AHRI, 160, 80]])
    assert.deepEqual(emerald.slots, [[AHRI, LUDENS, 1, 50, 35]])
    assert.deepEqual(roleItemCounts([newer], bracketTiers('all')).champions, [[AHRI, 400, 200]])
    assert.deepEqual(roleItemCounts([newer], bracketTiers('gold')).slots, [])
    assert.include(
      itemRowsSql('euw', { legendary: [], boots: [], trinkets: [], gold: {} }, {}),
      "platform IN ('EUW1')"
    )
  })

  test('reads an item’s stats, effects and recipe from Data Dragon', ({ assert }) => {
    const text = itemText(ITEMS, SHADOWFLAME)
    assert.equal(text.name, 'Shadowflame')
    assert.equal(text.gold, 3200)
    assert.deepEqual(text.stats, [
      { value: '110', stat: 'Ability Power' },
      { value: '15', stat: 'Magic Penetration' },
    ])
    assert.deepEqual(text.effects, [
      {
        kind: 'passive',
        name: 'Cinderbloom',
        text: 'Magic damage critically strikes low enemies.',
      },
    ])
    assert.deepEqual(
      text.recipe.from.map((n) => n.item),
      [ALTERNATOR, ROD]
    )
    assert.deepEqual(
      text.recipe.from[0].from.map((n) => n.gold),
      [400, 400]
    )
  })
})

test.group('Tier lists: runes', () => {
  const ELECTROCUTE = 8112
  const CONQUEROR = 8010
  const DOMINATION = 8100
  const PRECISION = 8000
  const SORCERY = 8200
  const page = (keystone: number, style: number, secondary: number) => [
    style,
    keystone,
    1,
    2,
    3,
    secondary,
    4,
    5,
    5008,
    5008,
    5001,
  ]

  test('reads every page once, with the bracket’s games from the patch start on', ({ assert }) => {
    const sql = runeRowsSql(null)
    assert.include(sql, '{patchStart:UInt64}')
    assert.include(sql, 'match_seed FINAL')
    assert.include(sql, 'LIMIT 6 BY tier')
    assert.include(sql, 'team_position = {position:String}')
  })

  test('ranks keystones with who runs them, their tree, pairing and pages', ({ assert }) => {
    const { keystone, shard, page: full, minor } = RUNE_KINDS
    const E = 'DIAMOND'
    const tiers = bracketTiers('emerald_plus')
    const midRows: RuneRow[] = [
      [E, keystone, AHRI, ELECTROCUTE, SORCERY, [], 800, 420],
      [E, keystone, AHRI, CONQUEROR, DOMINATION, [], 100, 50],
      [E, keystone, SYNDRA, ELECTROCUTE, SORCERY, [], 200, 90],
      [E, shard, 0, 0, 5008, [], 600, 0],
      [E, shard, 0, 0, 5005, [], 400, 0],
      [E, full, 0, ELECTROCUTE, 0, page(ELECTROCUTE, DOMINATION, SORCERY), 700, 370],
      [E, full, 0, CONQUEROR, 0, page(CONQUEROR, PRECISION, DOMINATION), 60, 30],
      // A page cut short is never a page.
      [E, full, 0, CONQUEROR, 0, [1, 2, 3], 50, 25],
      [E, minor, 0, 11, DOMINATION, [], 750, 0],
      [E, minor, 0, 12, DOMINATION, [], 250, 0],
    ]
    const topRows: RuneRow[] = [
      [E, keystone, AHRI, CONQUEROR, DOMINATION, [], 900, 430],
      [E, full, 0, CONQUEROR, 0, page(CONQUEROR, PRECISION, DOMINATION), 840, 400],
    ]
    const counts = mergeRuneCounts([
      roleRuneCounts([runeBlob(midRows)], tiers, 'MIDDLE'),
      roleRuneCounts([runeBlob(topRows)], tiers, 'TOP'),
    ])
    assert.lengthOf(counts.keystones, 4)
    assert.lengthOf(counts.pages, 3)
    assert.lengthOf(counts.minors, 2)
    const styles = {
      [DOMINATION]: { rows: [[ELECTROCUTE], [11, 12, 13]] },
      [PRECISION]: { rows: [[CONQUEROR], [21, 22, 23]] },
    }
    const trees = keystoneTrees(styles)
    const mid = runeView(counts, null, 'MIDDLE', trees, styles)
    assert.equal(mid.games, 1100)
    const electrocute = mid.rows.find((r) => r.keystone === ELECTROCUTE)!
    assert.equal(electrocute.style, DOMINATION)
    assert.equal(electrocute.games, 1000)
    assert.equal(electrocute.mainOf, 2)
    assert.deepEqual(electrocute.secondary, [{ style: SORCERY, share: 1 }])
    assert.equal(electrocute.pages[0].games, 700)
    assert.equal(electrocute.pages[0].page.keystone, ELECTROCUTE)
    assert.deepEqual(mid.shards[0], [
      { shard: 5008, share: 0.6 },
      { shard: 5005, share: 0.4 },
    ])
    assert.deepEqual(
      mid.trees.map((t) => t.style),
      [DOMINATION, PRECISION]
    )
    // Each tree reads like the client's: its pairing, then each row's runes with their share.
    assert.deepEqual(mid.trees[0].paired, { style: SORCERY, share: 1 })
    assert.deepEqual(mid.trees[0].rows, [
      [
        { rune: 11, share: 0.75 },
        { rune: 12, share: 0.25 },
        { rune: 13, share: 0 },
      ],
    ])
    // A tree no rune under the keystone was counted for has no rows to draw.
    assert.deepEqual(mid.trees[1].rows, [])
    assert.deepEqual(mid.trees[1].paired, { style: DOMINATION, share: 1 })

    const all = runeView(counts, null, null, trees)
    const conqueror = all.rows.find((r) => r.keystone === CONQUEROR)!
    assert.equal(conqueror.games, 1000)
    assert.deepEqual(conqueror.roles[0], { position: 'TOP', games: 900 })
    // Every role's pages are summed: the same Conqueror page in mid and top.
    assert.equal(all.pages[0].keystone, CONQUEROR)
    assert.equal(all.pages[0].games, 900)
    assert.equal(conqueror.pages[0].share, 0.9)
  })
})

test.group('Tier lists: duos', () => {
  test('reads each team’s duo roles once per game', ({ assert }) => {
    const sql = duoRowsSql(null)
    assert.include(sql, "(a.3 = 'BOTTOM' AND x.3 = 'UTILITY')")
    assert.include(sql, "(a.3 = 'MIDDLE' AND x.3 = 'JUNGLE')")
    assert.include(sql, 'match_lineups FINAL')
    assert.equal(duoLaneOf('MID'), 'mid')
    assert.isNull(duoLaneOf('aram'))
  })

  test('ranks pairs with their synergy, share and grid', ({ assert }) => {
    const rows: DuoRow[] = [
      ['EMERALD', 'BOTTOM', 'UTILITY', JINX, THRESH, 1000, 560],
      ['EMERALD', 'BOTTOM', 'UTILITY', JINX, LULU, 1000, 480],
      ['EMERALD', 'BOTTOM', 'UTILITY', 51, THRESH, 8, 4],
      ['EMERALD', 'MIDDLE', 'JUNGLE', AHRI, 64, 500, 260],
      // Not a duo of the list.
      ['EMERALD', 'TOP', 'UTILITY', AHRI, THRESH, 500, 260],
    ]
    const counts = duoCounts([duoBlob(rows)], bracketTiers('emerald_plus'))
    assert.lengthOf(counts.bot!, 3)
    assert.lengthOf(counts.mid!, 1)
    assert.isUndefined(counts.top)
    const roleWin = (champion: number) =>
      ({ [JINX]: 0.52, [THRESH]: 0.5, [LULU]: 0.49 })[champion] ?? null
    const view = duoView(counts, null, 'bot', roleWin)
    assert.equal(view.games, 2008)
    assert.lengthOf(view.rows, 2)
    const [best, worst] = view.rows
    assert.deepEqual([best.a, best.b], [JINX, THRESH])
    assert.equal(best.synergy, 0.05)
    assert.equal(best.share, 0.5)
    assert.isAtMost(best.tier, worst.tier)
    assert.deepEqual(view.grid.a, [JINX, 51])
    assert.deepEqual(view.grid.b, [THRESH, LULU])
    assert.deepEqual(view.grid.cells[0][0], { win: 0.56, games: 1000 })
    // Eight games together say nothing yet.
    assert.isNull(view.grid.cells[1][0])

    const before = duoCounts(
      [duoBlob([['MASTER', 'BOTTOM', 'UTILITY', JINX, THRESH, 1000, 500]])],
      bracketTiers('emerald_plus')
    )
    assert.equal(duoView(counts, before, 'bot', roleWin).rows[0].delta, 0.06)
  })
})

test.group('Tier lists: ARAM', () => {
  test('reads the mode’s stored games, each player once', ({ assert }) => {
    const sql = aramRowsSql({ region: 'euw' })
    assert.include(sql, '{queue:UInt16}')
    assert.include(sql, "platform IN ('EUW1')")
    assert.include(sql, 'LIMIT 1 BY match_id, champion_id')
    assert.equal(aramModeOf('Mayhem'), 'mayhem')
    assert.equal(aramModeOf('urf'), 'aram')
  })

  test('ranks champions with enough games, says whether the list can be read', ({ assert }) => {
    const rows: AramRow[] = [
      ['games', 0, 0, 0, 400, 0, 0, 0, 0],
      ['champion', AHRI, 0, 0, 100, 60, 800, 500, 1200],
      ['champion', SYNDRA, 0, 0, 80, 30, 700, 600, 900],
      ['champion', JINX, 0, 0, 3, 3, 30, 3, 30],
      ['keystone', AHRI, 8112, 8100, 70, 0, 0, 0, 0],
      ['keystone', AHRI, 8229, 8200, 30, 0, 0, 0, 0],
      // Stored before runes were kept.
      ['keystone', SYNDRA, 0, 0, 80, 0, 0, 0, 0],
    ]
    const counts = aramCounts(rows)
    assert.equal(counts.games, 400)
    assert.lengthOf(counts.keystones, 2)
    const view = aramView(counts)
    assert.isFalse(view.enough)
    assert.isBelow(400, MIN_ARAM_GAMES)
    assert.deepEqual(
      view.rows.map((r) => [r.champion, r.rank]),
      [
        [AHRI, 1],
        [SYNDRA, 2],
        [JINX, null],
      ]
    )
    assert.equal(view.rows[0].pick, 0.25)
    assert.equal(view.rows[0].kda, 4)
    assert.deepEqual(view.rows[0].keystone, { keystone: 8112, style: 8100, share: 0.7 })
    assert.isNull(view.rows[1].keystone)
    assert.isNull(view.rows[2].tier)
  })
})

test.group('Matchups', () => {
  test('two win rates predict what the pair does together (log5)', ({ assert }) => {
    assert.equal(log5(0.5, 0.5), 0.5)
    assert.equal(log5(0.5112, 0.4871), 0.5241)
    assert.equal(log5(0.4871, 0.5112), 0.4759)
  })
})
