import { test } from '@japa/runner'
import {
  DEFAULT_STATS,
  MAX_STATS,
  STATS,
  CARD_DEFAULTS,
  LEDGER_DEFAULT,
  cardImagePath,
  cardPagePath,
  parseCard,
  cellsFor,
  championLines,
  columnsFor,
  linesFor,
  record,
  windowLabel,
  type CardData,
} from '../../inertia/lib/share_card.js'

const figures = {
  winrate: 0.534,
  kda: 3.214,
  csMin: 7.26,
  killParticipation: 0.612,
  damagePerMinute: 1043.6,
  damageShare: 0.271,
  visionMin: 1.234,
  goldPerMinute: 432.4,
  total: 30,
}

const data: CardData = {
  figures,
  role: { name: 'Mid', share: 0.64 },
  rank: { name: 'Emerald II', tier: 'emerald', lp: 45, queue: 'Solo/Duo' },
}

test.group('Share card', () => {
  test('untouched, it shows what it always did', ({ assert }) => {
    assert.deepEqual(
      cellsFor(data, DEFAULT_STATS).map((c) => [c.value, c.label]),
      [
        ['53%', 'Win rate'],
        ['3.21', 'KDA'],
        ['7.3', 'CS per minute'],
      ]
    )
  })

  test('cells follow the card order, not the order they were ticked', ({ assert }) => {
    const cells = cellsFor(data, ['role', 'kda', 'rank'])
    assert.deepEqual(
      cells.map((c) => c.key),
      ['rank', 'kda', 'role']
    )
    assert.equal(cells[0].tone, '--tier-emerald')
    assert.equal(cells[0].label, 'Solo/Duo, 45 LP')
    assert.equal(cells[2].label, 'Main role, 64% of games')
  })

  test('never more than fit, and nothing made up for an empty window', ({ assert }) => {
    const all = STATS.map((s) => s.key)
    assert.lengthOf(cellsFor(data, all), MAX_STATS)
    const empty = cellsFor({ ...data, figures: { ...figures, total: 0 } }, all)
    // Only the rank, which does not come from the window, is left.
    assert.deepEqual(
      empty.map((c) => c.key),
      ['rank']
    )
    assert.deepEqual(cellsFor({ figures: null, role: null, rank: null }, all), [])
  })

  test('columns per format', ({ assert }) => {
    assert.equal(columnsFor('wide', 3), 3)
    assert.equal(columnsFor('wide', 4), 4)
    assert.equal(columnsFor('wide', 6), 3)
    assert.equal(columnsFor('square', 4), 3)
    assert.equal(columnsFor('story', 5), 2)
  })

  test('says what the figures cover', ({ assert }) => {
    assert.equal(windowLabel(30, 'all'), 'Last 30 games, all queues')
    assert.equal(windowLabel(1, 'ranked'), 'Last 1 game, Solo/Duo')
  })

  test("the ledger keeps the player's order and adds the asides", ({ assert }) => {
    const lines = linesFor(data, ['kda', 'rank', 'winrate'])
    assert.deepEqual(
      lines.map((l) => [l.label, l.value, l.aside ?? '']),
      [
        ['KDA', '3.21', ''],
        ['Rank', 'Emerald II', '45 LP'],
        ['Win rate', '53%', '16W 14L'],
      ]
    )
    assert.equal(lines[1].tier, 'emerald')
    assert.lengthOf(linesFor(data, LEDGER_DEFAULT), 6)
  })

  test('an empty window keeps only the rank', ({ assert }) => {
    const empty = { ...data, figures: { ...figures, total: 0 } }
    assert.deepEqual(
      linesFor(empty, LEDGER_DEFAULT).map((l) => l.key),
      ['rank']
    )
  })

  test('records and champion lines', ({ assert }) => {
    assert.equal(record(0.5714, 30), '17W 13L')
    assert.deepEqual(
      championLines({ games: 46, winrate: 0.61, kda: 3.4 }).map((l) => [l.value, l.aside ?? '']),
      [
        ['46', ''],
        ['61%', '28W 18L'],
        ['3.40', ''],
      ]
    )
  })

  test('a card is its link, defaults left out', ({ assert }) => {
    assert.equal(
      cardImagePath('Briar Signal-5555', CARD_DEFAULTS),
      '/card/Briar%20Signal-5555/stats-wide.png'
    )
    const s = {
      ...CARD_DEFAULTS,
      kind: 'stats' as const,
      format: 'square' as const,
      queue: 'ranked' as const,
      count: 50,
      lines: ['rank', 'kda'] as const,
      champion: 103,
      skin: 4,
    }
    const page = cardPagePath('Briar Signal-5555', { ...s, lines: [...s.lines] })
    assert.equal(
      page,
      '/Briar%20Signal-5555?q=ranked&n=50&l=rank%2Ckda&c=103&s=4&card=stats-square'
    )
    const back = parseCard(
      'stats-square',
      Object.fromEntries(new URL(`https://x${page}`).searchParams)
    )
    assert.deepEqual(back, { ...s, lines: ['rank', 'kda'] })
  })

  test('a link with junk falls back to the defaults', ({ assert }) => {
    assert.deepEqual(
      parseCard('nope-huge.png', { q: 'aram', n: '7', l: 'evil,kda', c: '-3', s: '9' }),
      {
        ...CARD_DEFAULTS,
        lines: ['kda'],
      }
    )
    assert.deepEqual(parseCard('ranked-story.png', { l: ['kda', 'winrate'] }).lines, [
      'kda',
      'winrate',
    ])
  })
})
