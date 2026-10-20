import { test } from '@japa/runner'
import sharp from 'sharp'
import {
  allItems,
  buildPath,
  cleanName,
  groupsOf,
  parseBuildLink,
  routeOf,
} from '#services/build_link'
import { CARD_HEIGHT, CARD_WIDTH, buildCardLayout, renderBuildCard } from '#services/build_card'

const GROUPS = '1101,2003-3047-6665,3075-3143-3053,3071'

test.group('Shared build links', () => {
  test('reads the app link and writes it back the same', ({ assert }) => {
    const link = parseBuildLink('1', 'Shyvana', 'jungle', GROUPS, 'Kraken / Dusk')!
    assert.deepEqual(link, {
      champion: 'shyvana',
      lane: 'JUNGLE',
      name: 'Kraken / Dusk',
      items: {
        start: [[1101, 2003]],
        early: [],
        boots: [3047],
        core: [6665, 3075],
        later: [[3143], [3053, 3071]],
        situational: [],
        elixirs: [],
        trinkets: [],
        max: '',
      },
    })
    assert.deepEqual(groupsOf(link.items), { version: 1, groups: GROUPS })
    const { path, query } = buildPath('/desktop/build', link)
    assert.equal(path, `/desktop/build/1/shyvana/jungle/${GROUPS}`)
    assert.equal(query.get('n'), 'Kraken / Dusk')
    assert.equal(parseBuildLink('1', 'jinx', 'bottom', '--6672')!.lane, 'ADC')
    assert.equal(groupsOf(parseBuildLink('1', 'jinx', 'adc', '--6672')!.items).groups, '--6672')
  })

  test('reads every row of a version 2 link and writes it back the same', ({ assert }) => {
    const groups =
      's1101,2003.1083,2003-e1082,1083,2055-b3047,3111,3006-c6672,2510,3053,6665-l3075,3143,6665,3065,4401-l3143,3075-o3075,3065,3742,6333-x2138,2140-t3364,3363-mqew'
    const link = parseBuildLink('2', 'shyvana', 'jungle', groups, 'Tank')!
    assert.deepEqual(link.items, {
      start: [
        [1101, 2003],
        [1083, 2003],
      ],
      early: [1082, 1083, 2055],
      boots: [3047, 3111, 3006],
      core: [6672, 2510, 3053, 6665],
      later: [
        [3075, 3143, 6665, 3065, 4401],
        [3143, 3075],
      ],
      situational: [3075, 3065, 3742, 6333],
      elixirs: [2138, 2140],
      trinkets: [3364, 3363],
      max: 'QEW',
    })
    assert.deepEqual(groupsOf(link.items), { version: 2, groups })
    assert.equal(
      buildPath('/desktop/build', link).path,
      `/desktop/build/2/shyvana/jungle/${groups}`
    )
    // The page and the card draw the route; every item is checked against the game data.
    assert.deepEqual(routeOf(link.items), {
      start: [1101, 2003],
      boots: 3047,
      core: [6672, 2510, 3053, 6665],
      later: link.items.later,
    })
    assert.includeMembers(allItems(link.items), [1082, 2138, 3364, 2055])
    // An item may sit in two rows: the 4th and 5th items are interchangeable.
    const twice = parseBuildLink('2', 'shyvana', 'jungle', 'c6672-l6665-l6665,3075')!
    assert.deepEqual(twice.items.later, [[6665], [6665, 3075]])
    // A build that fits version 1 is written as version 1, which 0.3.4 reads.
    assert.deepEqual(
      groupsOf(parseBuildLink('2', 'jinx', 'adc', 's1055,2003-b3006-c6672')!.items),
      {
        version: 1,
        groups: '1055,2003-3006-6672',
      }
    )
  })

  test('refuses anything the app would not have written', ({ assert }) => {
    const bad: [unknown, unknown, unknown, unknown][] = [
      ['3', 'ahri', 'mid', 'c3118'],
      ['2', 'ahri', 'mid', '-3020-3118'],
      ['2', 'ahri', 'mid', 'b3020'],
      ['2', 'ahri', 'mid', 'c3118-c3089'],
      ['2', 'ahri', 'mid', 'c3118-z1'],
      ['2', 'ahri', 'mid', 'c3118-b'],
      ['2', 'ahri', 'mid', 'c3118-b3020,3020'],
      ['2', 'ahri', 'mid', 's1056..2003-c3118'],
      ['2', 'ahri', 'mid', 'c3118-mqqe'],
      ['2', 'ahri', 'mid', 'c3118,3089,3157,3135-l3102-l3165-l4645'],
      ['2', 'ahri', 'mid', `c3118-o${Array.from({ length: 17 }, (_, i) => 3000 + i).join(',')}`],
      ['2', 'ahri', 'mid', 's2003-s2003-c3118'],
      ['1', 'ah<ri', 'mid', '-3020-3118'],
      ['1', 'a'.repeat(33), 'mid', '-3020-3118'],
      ['1', 'ahri', 'feeder', '-3020-3118'],
      ['1', 'ahri', 'mid', '-3020'],
      ['1', 'ahri', 'mid', '-3020,3006-3118'],
      ['1', 'ahri', 'mid', '-3020-3118,3089,3157,3135'],
      ['1', 'ahri', 'mid', '-3020-3118-3157,3157,3157,3157'],
      ['1', 'ahri', 'mid', '-3020-3118-3157,3157'],
      ['1', 'ahri', 'mid', '-3020-3118-1-2-3-4'],
      ['1', 'ahri', 'mid', '-3020-31x8'],
      ['1', 'ahri', 'mid', '-3020-1234567'],
      ['1', 'ahri', 'mid', '-3020-0118'],
      ['1', 'ahri', 'mid', `-3020-3118-${'1,'.repeat(400)}2`],
      ['1', 'ahri', ['mid'], '-3020-3118'],
    ]
    for (const [v, c, r, g] of bad) assert.isNull(parseBuildLink(v, c, r, g), String(g))
  })

  test('names are cleaned and capped like the app', ({ assert }) => {
    assert.equal(cleanName('  Burst \n\t mid\u0000 '), 'Burst mid')
    assert.equal([...cleanName('é'.repeat(60))].length, 40)
    assert.equal(cleanName(['x']), '')
    assert.equal(cleanName('<b>&amp;</b>'), '<b>&amp;</b>')
  })
})

test.group('Shared build card', () => {
  test('a 1200 by 630 JPEG, items inside the card', async ({ assert }) => {
    const art = await sharp({
      create: { width: 1280, height: 720, channels: 3, background: '#335' },
    })
      .jpeg()
      .toBuffer()
    const icon = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#a85' } })
      .png()
      .toBuffer()
    const link = parseBuildLink(
      '1',
      'shyvana',
      'jungle',
      GROUPS,
      '<script>alert(1)</script> & "x"'
    )!
    const icons = new Map([1101, 2003, 3047, 6665, 3075, 3143, 3053, 3071].map((id) => [id, icon]))
    const jpg = await renderBuildCard(
      { championName: 'Shyvana', lane: link.lane, name: link.name, items: routeOf(link.items) },
      art,
      icons
    )
    const meta = await sharp(jpg).metadata()
    assert.equal(meta.format, 'jpeg')
    assert.equal(meta.width, CARD_WIDTH)
    assert.equal(meta.height, CARD_HEIGHT)
    assert.isAtMost(jpg.byteLength, 200_000)

    const full = parseBuildLink(
      '1',
      'ahri',
      'mid',
      '1056,2003,2003,2003,2003,2003-3020-3118,4646,3089-3157,3102,3135-3135,3157,3102-3102,3135,3157'
    )!
    const wide = parseBuildLink(
      '2',
      'ahri',
      'mid',
      's1056,2003,2003-b3020,3158,3111-c3118,4646,3089,3157-l3102,3135,3165,4645,3916-l3135,3102,3165'
    )!
    for (const s of [
      ...buildCardLayout(routeOf(full.items)).slots,
      ...buildCardLayout(routeOf(wide.items)).slots,
    ]) {
      assert.isAtLeast(s.x, 0)
      assert.isAtMost(s.x + s.size, CARD_WIDTH)
      assert.isAtLeast(s.y, 0)
      assert.isAtMost(s.y + s.size, CARD_HEIGHT)
    }
  })
})
