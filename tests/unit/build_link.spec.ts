import { test } from '@japa/runner'
import sharp from 'sharp'
import { buildPath, cleanName, groupsOf, parseBuildLink } from '#services/build_link'
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
        start: [1101, 2003],
        boots: 3047,
        core: [6665, 3075],
        later: [[3143], [3053, 3071]],
      },
    })
    assert.equal(groupsOf(link.items), GROUPS)
    const { path, query } = buildPath('/desktop/build', link)
    assert.equal(path, `/desktop/build/1/shyvana/jungle/${GROUPS}`)
    assert.equal(query.get('n'), 'Kraken / Dusk')
    assert.equal(parseBuildLink('1', 'jinx', 'bottom', '--6672')!.lane, 'ADC')
    assert.equal(groupsOf(parseBuildLink('1', 'jinx', 'adc', '--6672')!.items), '--6672')
  })

  test('refuses anything the app would not have written', ({ assert }) => {
    const bad: [unknown, unknown, unknown, unknown][] = [
      ['2', 'ahri', 'mid', '-3020-3118'],
      ['1', 'ah<ri', 'mid', '-3020-3118'],
      ['1', 'a'.repeat(33), 'mid', '-3020-3118'],
      ['1', 'ahri', 'feeder', '-3020-3118'],
      ['1', 'ahri', 'mid', '-3020'],
      ['1', 'ahri', 'mid', '-3020,3006-3118'],
      ['1', 'ahri', 'mid', '-3020-3118,3089,3157,3135'],
      ['1', 'ahri', 'mid', '-3020-3118-3118'],
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
      { championName: 'Shyvana', lane: link.lane, name: link.name, items: link.items },
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
    for (const s of buildCardLayout(full.items).slots) {
      assert.isAtLeast(s.x, 0)
      assert.isAtMost(s.x + s.size, CARD_WIDTH)
      assert.isAtLeast(s.y, 0)
      assert.isAtMost(s.y + s.size, CARD_HEIGHT)
    }
  })
})
