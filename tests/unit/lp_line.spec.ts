import { test } from '@japa/runner'
import {
  firstRangeWithLine,
  inRange,
  ladderValue,
  lpPath,
  lpPoints,
  lpScale,
  peakOf,
} from '../../inertia/lib/lp_line.js'
import type { Rank } from '../../inertia/lib/types.js'

const DAY = 86_400_000
const NOW = new Date('2026-11-21T12:00:00').getTime()

/** A Solo/Duo snapshot `daysAgo` days before NOW. */
const snap = (
  daysAgo: number,
  tier: string,
  division: string,
  lp: number,
  queue = 'RANKED_SOLO_5x5'
) =>
  ({
    queueType: queue,
    tier,
    division,
    leaguePoints: lp,
    wins: 10,
    losses: 10,
    fetchedAt: new Date(NOW - daysAgo * DAY).toISOString(),
  }) as Rank

test.group('LP line', () => {
  test('ranks sit on one ladder axis', ({ assert }) => {
    assert.equal(ladderValue({ tier: 'IRON', division: 'IV', leaguePoints: 0 }), 0)
    assert.equal(ladderValue({ tier: 'PLATINUM', division: 'II', leaguePoints: 68 }), 1868)
    assert.equal(ladderValue({ tier: 'DIAMOND', division: 'I', leaguePoints: 99 }), 2799)
    assert.equal(ladderValue({ tier: 'MASTER', division: 'I', leaguePoints: 0 }), 2800)
    assert.equal(ladderValue({ tier: 'CHALLENGER', division: 'I', leaguePoints: 1200 }), 4000)
    assert.isNull(ladderValue({ tier: '', division: '', leaguePoints: 0 }))
  })

  test('one point per change, oldest first, for one queue', ({ assert }) => {
    const points = lpPoints(
      [
        snap(1, 'GOLD', 'I', 50),
        snap(3, 'GOLD', 'I', 30),
        snap(2, 'GOLD', 'I', 30),
        snap(2, 'SILVER', 'I', 10, 'RANKED_FLEX_SR'),
        snap(5, 'GOLD', 'II', 90),
      ],
      'RANKED_SOLO_5x5'
    )
    assert.deepEqual(
      points.map((p) => p.v),
      [1490, 1530, 1550]
    )
    // the repeated read keeps the moment the value was first seen
    assert.equal(points[1].t, NOW - 3 * DAY)
  })

  test('a range starts from the last change before it', ({ assert }) => {
    const points = lpPoints(
      [snap(60, 'GOLD', 'IV', 0), snap(40, 'GOLD', 'IV', 20), snap(10, 'GOLD', 'IV', 40)],
      'RANKED_SOLO_5x5'
    )
    assert.deepEqual(
      inRange(points, '30d', NOW).map((p) => p.v),
      [1220, 1240]
    )
    assert.lengthOf(inRange(points, 'all', NOW), 3)
    // nothing changed in the last 5 days: no line
    assert.lengthOf(
      inRange(lpPoints([snap(10, 'GOLD', 'IV', 40)], 'RANKED_SOLO_5x5'), '30d', NOW),
      0
    )
  })

  test('the default range is the shortest one with a line', ({ assert }) => {
    const points = lpPoints(
      [snap(200, 'GOLD', 'IV', 0), snap(150, 'GOLD', 'IV', 20)],
      'RANKED_SOLO_5x5'
    )
    assert.equal(firstRangeWithLine(points, NOW), '1y')
    assert.isNull(firstRangeWithLine(points.slice(0, 1), NOW))
  })

  test('the peak is the highest point stored', ({ assert }) => {
    const points = lpPoints(
      [snap(3, 'PLATINUM', 'I', 20), snap(2, 'EMERALD', 'IV', 5), snap(1, 'PLATINUM', 'I', 80)],
      'RANKED_SOLO_5x5'
    )
    assert.equal(peakOf(points)!.rank.tier, 'EMERALD')
    assert.isNull(peakOf([]))
  })

  test('guides: divisions in a tier or two, tiers on a long climb, LP above Master', ({
    assert,
  }) => {
    const near = lpScale(1810, 1868)
    assert.deepEqual(
      near.guides.map((g) => [g.tier, g.label, g.emblem]),
      [
        ['PLATINUM', 'II', true],
        ['PLATINUM', 'I', false],
      ]
    )
    const long = lpScale(400, 1700)
    assert.deepEqual(
      long.guides.map((g) => g.tier),
      ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD']
    )
    assert.isTrue(long.guides.every((g) => g.label === ''))
    // a short climb into Master keeps the Diamond divisions
    const apex = lpScale(2630, 2832)
    assert.deepEqual(
      apex.guides.map((g) => [g.tier, g.label]),
      [
        ['DIAMOND', 'II'],
        ['DIAMOND', 'I'],
        ['MASTER', ''],
        ['MASTER', '100'],
      ]
    )
  })

  test('the path joins the points with straight segments, evenly spaced', ({ assert }) => {
    const points = lpPoints(
      [snap(3, 'GOLD', 'IV', 0), snap(2, 'GOLD', 'IV', 50), snap(1, 'GOLD', 'IV', 25)],
      'RANKED_SOLO_5x5'
    )
    const { d, xy } = lpPath(points, 200, 100, { lo: 1200, hi: 1300 }, 0)
    assert.notInclude(d, 'C')
    assert.deepEqual(
      xy.map(([x]) => x),
      [0, 100, 200]
    )
    assert.deepEqual(
      xy.map(([, y]) => y),
      [100, 50, 75]
    )
  })
})
