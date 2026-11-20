import { test } from '@japa/runner'
import { LENGTHS, lengthWin, studioRows } from '#services/stats_explorer_service'
import type { RoleStat } from '#services/champion_stats'
import { METRICS, STATS, fmt, oldStat, statOf } from '../../inertia/lib/studio.js'

const role = (
  champion: number,
  position: RoleStat['position'],
  games: number,
  win: number,
  pick: number
): RoleStat => ({
  champion,
  position,
  games,
  win,
  pick,
  ban: 0.1,
  roleShare: 0,
  tier: null,
  rank: null,
  level: 0,
})

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

  test('sums every role of a champion when no role is asked', ({ assert }) => {
    const now = [
      role(1, 'MIDDLE', 300, 0.5, 0.03),
      role(1, 'TOP', 100, 0.6, 0.01),
      role(2, 'TOP', 50, 0.4, 0.005),
    ]
    const before = [role(1, 'MIDDLE', 200, 0.45, 0.02)]
    const all = studioRows(now, before, null)
    const one = all.find((r) => r.champion === 1)!
    assert.equal(one.games, 400)
    assert.equal(one.win, 0.525)
    assert.equal(one.pick, 0.04)
    assert.equal(one.position, 'MIDDLE')
    assert.deepEqual(one.before, { win: 0.45, pick: 0.02, ban: 0.1 })
    const top = studioRows(now, before, 'TOP')
    assert.deepEqual(
      top.map((r) => [r.champion, r.games, r.win]),
      [
        [1, 100, 0.6],
        [2, 50, 0.4],
      ]
    )
    assert.isNull(top[0].before)
  })
})

test.group('Stats studio', () => {
  test('sends the old explorer addresses to their page', ({ assert }) => {
    assert.isUndefined(oldStat(undefined, undefined))
    assert.isNull(oldStat('overview', undefined))
    assert.equal(oldStat('early', undefined), 'gold-lead-10')
    assert.equal(oldStat('length', undefined), 'game-length')
    assert.equal(oldStat('table', 'ahead'), 'ahead-at-10')
    assert.equal(oldStat('table', undefined), 'table')
    assert.isNull(oldStat('nothing', undefined))
  })

  test('names every page once, in a category, with figures it knows', ({ assert }) => {
    const slugs = STATS.map((s) => s.slug)
    assert.equal(new Set(slugs).size, slugs.length)
    for (const s of STATS) {
      assert.match(s.slug, /^[a-z0-9-]{1,40}$/)
      for (const k of [s.key, ...s.cols]) assert.property(METRICS, k)
      assert.equal(statOf(s.slug), s)
    }
    assert.isNull(statOf('nope'))
  })

  test('writes figures as the page shows them', ({ assert }) => {
    assert.equal(fmt('pct2', 0.5234), '52.34%')
    assert.equal(fmt('sgn0', -161.4), '−161')
    assert.equal(fmt('sgn0', 1234), '+1,234')
    assert.equal(fmt('sgn1', 0.04), '0.0')
    assert.equal(fmt('pts', 1.5), '+1.50')
    assert.equal(fmt('time', 1754), '29:14')
  })
})
