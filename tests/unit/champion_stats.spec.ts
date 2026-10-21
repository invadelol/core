import { test } from '@japa/runner'
import {
  positionOf,
  seedGamesSql,
  skillOrders,
  summarize,
  tierOf,
  type Filter,
} from '#services/champion_stats'
import { championSlug } from '../../inertia/lib/champions.js'

const FILTER: Filter = { patch: '16.20', bracket: 'emerald_plus', region: null }

test.group('Champion stats', () => {
  test('gives tiers by place in the role, best first', ({ assert }) => {
    const tiers = Array.from({ length: 20 }, (_, i) => tierOf(i, 20))
    assert.equal(tiers[0], 0)
    assert.equal(tiers[19], 5)
    // Never better further down the list.
    for (let i = 1; i < tiers.length; i++) assert.isAtLeast(tiers[i], tiers[i - 1])
  })

  test('ranks a role and leaves rare picks unranked', ({ assert }) => {
    const rows: [number, string, number, number][] = [
      // Played a lot and winning.
      [1, 'TOP', 3000, 1650],
      // Played a lot and losing.
      [2, 'TOP', 3000, 1350],
      // Enough to show, too few to rank.
      [3, 'TOP', 60, 40],
      // Under the pick-rate floor: not shown at all.
      [4, 'TOP', 10, 9],
      // An off-role pick of champion 1.
      [1, 'MIDDLE', 1000, 500],
    ]
    const totals: [string, number, number][] = [
      ['games', 0, 10_000],
      ['ban', 2, 500],
    ]
    const s = summarize(FILTER, rows, totals)
    const top = s.roles.filter((r) => r.position === 'TOP')
    assert.deepEqual(
      top.map((r) => r.champion),
      [1, 2, 3]
    )
    assert.equal(top.find((r) => r.champion === 1)?.rank, 1)
    assert.equal(top.find((r) => r.champion === 2)?.rank, 2)
    assert.isNull(top.find((r) => r.champion === 3)?.rank)
    assert.equal(s.ranked.TOP, 2)
    assert.equal(top.find((r) => r.champion === 2)?.ban, 0.05)
    assert.equal(top.find((r) => r.champion === 1)?.roleShare, 0.75)
    assert.notProperty(top[0], 'score')
  })

  test('reads skill orders and the order skills are maxed in', ({ assert }) => {
    // Q W E, then Q first, W second.
    const order = [1, 2, 3, 1, 1, 4, 1, 1, 2, 4, 2, 2, 2, 3, 3]
    const skills = skillOrders([
      [order, 600, 330],
      [[1, 3, 2, 1, 1, 4, 1, 1, 3, 4, 3, 3, 3, 2, 2], 200, 90],
    ])
    assert.equal(skills.games, 800)
    assert.deepEqual(skills.orders[0].order.slice(0, 6), ['Q', 'W', 'E', 'Q', 'Q', 'R'])
    assert.deepEqual(skills.max, ['Q', 'W', 'E'])
    assert.equal(skills.orders[0].share, 0.75)
  })

  test('reads role and bracket filters', ({ assert }) => {
    assert.equal(positionOf('bot'), 'BOTTOM')
    assert.equal(positionOf('support'), 'UTILITY')
    assert.isNull(positionOf('nope'))
    assert.notInclude(seedGamesSql({ ...FILTER, bracket: 'all' }), 'seed_tier')
    assert.include(seedGamesSql(FILTER), 'seed_tier IN')
  })

  test('gives each champion a plain address', ({ assert }) => {
    assert.equal(championSlug('Miss Fortune'), 'miss-fortune')
    assert.equal(championSlug("Kai'Sa"), 'kaisa')
    assert.equal(championSlug('Nunu & Willump'), 'nunu-willump')
    assert.equal(championSlug('Dr. Mundo'), 'dr-mundo')
  })
})
