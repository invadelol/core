import { test } from '@japa/runner'
import {
  DEFAULT_STATS,
  MAX_STATS,
  STATS,
  cellsFor,
  columnsFor,
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
})
