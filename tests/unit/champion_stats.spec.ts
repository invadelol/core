import { test } from '@japa/runner'
import {
  averages,
  laneSql,
  matchups,
  positionOf,
  profileSql,
  seedGamesSql,
  skillOrderSql,
  skillOrders,
  summarize,
  tierOf,
  trendGamesSql,
  trendRows,
  type Filter,
} from '#services/champion_stats'
import { pageRowsSql } from '#services/rune_stats'
import { championSlug } from '../../inertia/lib/champions.js'

const round2 = (n: number) => Math.round(n * 100) / 100

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

  test('reads per-player and per-game tables from the patch on, not whole tables', ({ assert }) => {
    // Skill orders and rune pages: one champion's rows of participants, from the patch on.
    const skills = skillOrderSql(FILTER)
    assert.include(skills, 'FROM participants')
    assert.include(skills, 'champion_id = {champion:UInt16}')
    assert.include(skills, 'game_start_ms >= {patchStart:UInt64}')
    assert.notInclude(skills, 'match_timeline')
    const lane = laneSql(FILTER)
    assert.include(lane, 'FROM match_lineups')
    assert.include(lane, 'WHERE patch = {patch:String}')
    // The champion's games, then the crawled games looked up among them only.
    assert.equal(lane.match(/FROM participant_items/g)?.length, 2)
    const runes = pageRowsSql('emerald_plus', { champion: 21, position: 'BOTTOM' })
    assert.include(runes, 'FROM participants')
    assert.include(runes, 'game_start_ms >= {patchStart:UInt64}')
    assert.notInclude(runes, 'match_timeline')
    // The patch start is a parameter, asked once per patch, not two scans per query.
    for (const sql of [skills, runes, profileSql(FILTER)])
      assert.notInclude(sql, 'min(game_start_ms)')
  })

  test("a champion's crawled games are looked up among its own, not the patch's", ({ assert }) => {
    // The set an IN builds is the champion's games of the patch: a few thousand, not millions.
    for (const sql of [laneSql(FILTER), skillOrderSql(FILTER), profileSql(FILTER)]) {
      const seeds = sql.indexOf('FROM match_seed')
      assert.isAbove(seeds, 0)
      const inside = sql.slice(seeds, sql.indexOf('))', seeds))
      assert.include(
        inside,
        "seed_tier IN ('EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER')"
      )
      assert.include(inside, 'match_id IN (SELECT match_id FROM participant_items')
      assert.include(
        inside,
        'champion_id = {champion:UInt16} AND team_position = {position:String}'
      )
    }
    // Every champion at once has no champion to start from: the bracket's games, as before.
    assert.notInclude(seedGamesSql(FILTER), 'participant_items')
  })

  test('orders matchups by games, then by champion, so equal counts never swap', ({ assert }) => {
    const list = matchups([
      [30, 10, 5],
      [12, 10, 4],
      [40, 20, 9],
    ])
    assert.deepEqual(
      list.map((m) => m.champion),
      [40, 12, 30]
    )
  })

  test('gives each champion a plain address', ({ assert }) => {
    assert.equal(championSlug('Miss Fortune'), 'miss-fortune')
    assert.equal(championSlug("Kai'Sa"), 'kaisa')
    assert.equal(championSlug('Nunu & Willump'), 'nunu-willump')
    assert.equal(championSlug('Dr. Mundo'), 'dr-mundo')
  })

  test('averages the Statistics tab from its length buckets', ({ assert }) => {
    // bucket, games, wins, games with a participant row, kills, deaths, assists, CS, gold,
    // damage, vision, seconds of those games.
    const rows = [
      [5, 30, 15, 30, 150, 90, 210, 4500, 300000, 450000, 600, 49500],
      [6, 10, 6, 9, 54, 27, 63, 1620, 108000, 162000, 216, 17820],
    ]
    const a = averages(rows)!
    assert.equal(a.games, 39)
    assert.equal(a.kills, 5.2)
    assert.equal(a.deaths, 3)
    assert.equal(a.kda, round2((204 + 273) / 117))
    assert.equal(a.csPerMin, 5.5)
    assert.equal(a.length, 1726)
    assert.isNull(averages([]))
    assert.isNull(averages([[5, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]]))
  })

  test("builds a champion trend from every champion's days and its own", ({ assert }) => {
    const days: [string, number, [number[], number[]]][] = [
      [
        '2026-10-21',
        1000,
        [
          [1, 21],
          [40, 120],
        ],
      ],
      ['2026-10-22', 1200, [[1], [50]]],
    ]
    assert.deepEqual(trendRows(days, [['2026-10-22', 60, 33]], 21), [
      ['2026-10-21', 0, 0, 1000, 120],
      ['2026-10-22', 60, 33, 1200, 0],
    ])
  })

  test('reads each source of the Statistics tab once', ({ assert }) => {
    const profile = profileSql(FILTER)
    assert.notInclude(profile, 'WITH me')
    assert.equal(profile.match(/FROM participant_items FINAL/g)?.length, 1)
    assert.include(profile, 'LIMIT 1 BY match_id')
    const trend = trendGamesSql(FILTER)
    assert.equal(trend.match(/FROM participant_items/g)?.length, 1)
    assert.include(trend, 'game_start_ms < {until:UInt64}')
    assert.notInclude(trend, 'FROM matches')
  })
})
