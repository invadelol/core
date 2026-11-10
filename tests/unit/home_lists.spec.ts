import { test } from '@japa/runner'
import {
  LANE_MIN_GAMES,
  bestPicks,
  climbersOf,
  laneRows,
  mostBanned,
  movesOf,
  type ChampionInfo,
} from '#services/home_service'
import type { RoleStat, Summary } from '#services/champion_stats'

/** A summary of made-up rows: every figure here is the test's own. */
function summary(rows: Partial<RoleStat>[]): Summary {
  return {
    patch: '16.20',
    bracket: 'emerald_plus',
    region: null,
    games: 1000,
    ranked: { TOP: 0, JUNGLE: 0, MIDDLE: 0, BOTTOM: 0, UTILITY: 0 },
    roles: rows.map((r) => ({
      champion: 1,
      position: 'MIDDLE',
      games: 300,
      win: 0.5,
      pick: 0.1,
      ban: 0,
      roleShare: 1,
      tier: 2,
      rank: null,
      level: 3,
      ...r,
    })) as RoleStat[],
  }
}

const names = new Map<number, ChampionInfo>(
  [1, 2, 3, 4].map((id) => [id, { id, name: `Champion ${id}`, slug: `champion-${id}` }])
)

test.group('Home lists', () => {
  test('takes the first of each role, in the roles order', ({ assert }) => {
    const s = summary([
      { champion: 1, position: 'MIDDLE', rank: 1, tier: 0, win: 0.53 },
      { champion: 2, position: 'TOP', rank: 1, tier: 1, win: 0.52 },
      { champion: 3, position: 'TOP', rank: 2 },
    ])
    const picks = bestPicks(s, names)
    assert.deepEqual(
      picks.map((p) => [p.position, p.championId, p.tier]),
      [
        ['TOP', 2, 1],
        ['MIDDLE', 1, 0],
      ]
    )
  })

  test('lists the most banned once each, in the role played most', ({ assert }) => {
    const s = summary([
      { champion: 1, position: 'MIDDLE', games: 500, ban: 0.2 },
      { champion: 1, position: 'TOP', games: 50, ban: 0.2 },
      { champion: 2, position: 'UTILITY', ban: 0.3 },
      { champion: 3, position: 'BOTTOM', ban: 0 },
    ])
    assert.deepEqual(
      mostBanned(s, names).map((b) => [b.championId, b.position]),
      [
        [2, 'UTILITY'],
        [1, 'MIDDLE'],
      ]
    )
  })

  test('counts a climb only into the top of the role, biggest first', ({ assert }) => {
    const now = summary([
      { champion: 1, position: 'MIDDLE', rank: 3 },
      { champion: 2, position: 'TOP', rank: 5 },
      { champion: 3, position: 'TOP', rank: 40 },
    ])
    const before = summary([
      { champion: 1, position: 'MIDDLE', rank: 9 },
      { champion: 2, position: 'TOP', rank: 30 },
      { champion: 3, position: 'TOP', rank: 90 },
    ])
    assert.deepEqual(
      climbersOf(now, before, names).map((c) => [c.championId, c.from, c.to]),
      [
        [2, 30, 5],
        [1, 9, 3],
      ]
    )
    assert.deepEqual(climbersOf(now, null, names), [])
  })

  test("lists each role's climbs and falls since the patch before", ({ assert }) => {
    const before = summary([
      { champion: 1, position: 'TOP', rank: 12 },
      { champion: 2, position: 'TOP', rank: 2 },
      { champion: 3, position: 'TOP', rank: 40 },
      { champion: 4, position: 'TOP', rank: 5 },
    ])
    const now = summary([
      { champion: 1, position: 'TOP', rank: 3, win: 0.53 },
      { champion: 2, position: 'TOP', rank: 9 },
      { champion: 3, position: 'TOP', rank: 35 },
      { champion: 4, position: 'TOP', rank: 5 },
    ])
    const moves = movesOf(now, { ...before, patch: '16.19' }, names)!
    const top = moves.roles.find((r) => r.position === 'TOP')!
    assert.equal(moves.previousPatch, '16.19')
    assert.deepEqual(
      top.up.map((m) => [m.championId, m.from, m.to, m.winRate]),
      [[1, 12, 3, 0.53]]
    )
    assert.deepEqual(
      top.down.map((m) => [m.championId, m.from, m.to]),
      [[2, 2, 9]]
    )
    assert.isNull(movesOf(now, null, names))
  })

  test('reads a lane figure per game, gated by games and by the listed roles', ({ assert }) => {
    const s = summary([
      { champion: 1, position: 'MIDDLE' },
      { champion: 2, position: 'TOP' },
    ])
    const rows = laneRows(
      [
        ['MIDDLE', 1, LANE_MIN_GAMES, LANE_MIN_GAMES * 120],
        ['TOP', 2, LANE_MIN_GAMES * 2, LANE_MIN_GAMES * 2 * 150],
        ['TOP', 1, LANE_MIN_GAMES, LANE_MIN_GAMES * 900],
        ['MIDDLE', 2, LANE_MIN_GAMES - 1, LANE_MIN_GAMES * 900],
      ],
      s,
      names
    )
    assert.deepEqual(
      rows.map((r) => [r.championId, r.position, r.value]),
      [
        [2, 'TOP', 150],
        [1, 'MIDDLE', 120],
      ]
    )
  })

  test('lists a champion once, in its best role', ({ assert }) => {
    const s = summary([
      { champion: 1, position: 'MIDDLE' },
      { champion: 1, position: 'TOP' },
      { champion: 2, position: 'TOP' },
    ])
    const rows = laneRows(
      [
        ['MIDDLE', 1, LANE_MIN_GAMES, LANE_MIN_GAMES * 455],
        ['TOP', 1, LANE_MIN_GAMES, LANE_MIN_GAMES * 454],
        ['TOP', 2, LANE_MIN_GAMES, LANE_MIN_GAMES * 300],
      ],
      s,
      names
    )
    assert.deepEqual(
      rows.map((r) => [r.championId, r.position]),
      [
        [1, 'MIDDLE'],
        [2, 'TOP'],
      ]
    )
  })
})
