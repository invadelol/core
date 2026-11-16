import { test } from '@japa/runner'
import { LENGTHS, lengthWin } from '#services/stats_explorer_service'

test.group('Stats explorer', () => {
  test('reads the win rate of any span of the length buckets', ({ assert }) => {
    // Games and wins under 20, 20-25, 25-30, 30-35 and 35+ minutes.
    const buckets: [number, number][] = [
      [100, 60],
      [100, 50],
      [200, 90],
      [100, 50],
      [20, 5],
    ]
    assert.lengthOf(buckets, LENGTHS.length)
    assert.equal(lengthWin(buckets, 0, 25), 0.55)
    assert.equal(lengthWin(buckets, 25, 999), Math.round((145 / 320) * 10000) / 10000)
    // Twenty games say nothing yet.
    assert.isNull(lengthWin(buckets, 35, 999))
    assert.isNull(lengthWin([], 0, 25))
  })
})
