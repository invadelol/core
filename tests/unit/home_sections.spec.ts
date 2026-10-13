import { test } from '@japa/runner'
import {
  BEST_GAMES,
  MIN_CHAMPION_GAMES,
  MIN_PATCH_GAMES,
  bestLines,
  championRows,
  climbsFrom,
  comparePatches,
  hourlySeries,
  pickPatch,
  viewBucketKeys,
  type RankSnapshot,
} from '#services/home_service'
import type { Match, Participant } from '../../inertia/lib/types.js'

const HOUR = 3_600_000
const NOW = Date.UTC(2026, 9, 13, 18)
const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']

function snapshot(puuid: string, overrides: Partial<RankSnapshot> = {}): RankSnapshot {
  return {
    puuid,
    tier: 'GOLD',
    division: 'II',
    lp: 40,
    wins: 50,
    losses: 50,
    at: NOW - 30 * HOUR,
    ...overrides,
  }
}

/** A fictional lobby: player `star` of match `id` has the game of their life. */
function lobby(id: string, start: number, star = -1): Match {
  const participants = Array.from({ length: 10 }, (_, i) => {
    const great = i === star
    return {
      puuid: `${id}-p${i}`,
      gameName: `Lantern ${i}`,
      tagLine: 'TEST',
      championId: i + 1,
      teamId: i < 5 ? 100 : 200,
      win: i < 5,
      kills: great ? 18 : 4,
      deaths: great ? 1 : 5,
      assists: great ? 12 : 6,
      cs: great ? 290 : 170,
      visionScore: 25,
      damageTaken: 20000,
      totalDamageDealtToChampions: great ? 52000 : 18000,
      damageDealtToObjectives: great ? 20000 : 6000,
      goldEarned: great ? 19000 : 11000,
      position: ROLES[i % 5],
      items: [],
      spells: [],
      perks: { primary: 8000, sub: 8100, keystone: 8005 },
    } as unknown as Participant
  })
  return {
    matchId: id,
    platform: 'EUW1',
    gameStartMs: start,
    duration: 1800,
    queueId: 420,
    t1Win: 1,
    t2Win: 0,
    participants,
  } as Match
}

test.group('Home: today and trending', () => {
  test('buckets games by hour, oldest first, and drops what is outside the day', ({ assert }) => {
    const series = hourlySeries([
      [0, 5],
      [23, 2],
      [3, 1],
      [24, 9],
      [-1, 9],
    ])
    assert.lengthOf(series, 24)
    assert.equal(series[23], 5)
    assert.equal(series[0], 2)
    assert.equal(series[20], 1)
    assert.equal(
      series.reduce((a, b) => a + b, 0),
      8
    )
  })

  test('names one view bucket per UTC day, today first', ({ assert }) => {
    assert.deepEqual(viewBucketKeys(NOW, 3), [
      'home:views:2026-10-13',
      'home:views:2026-10-12',
      'home:views:2026-10-11',
    ])
  })
})

test.group('Home: climbs', () => {
  test('measures from the last snapshot before the day, across divisions', ({ assert }) => {
    const baselines = new Map([['a', snapshot('a', { division: 'IV', lp: 80 })]])
    const [climb] = climbsFrom(
      [
        snapshot('a', { division: 'III', lp: 20, wins: 52, losses: 50, at: NOW - 5 * HOUR }),
        snapshot('a', { division: 'III', lp: 60, wins: 54, losses: 51, at: NOW - 2 * HOUR }),
      ],
      baselines
    )
    assert.equal(climb.puuid, 'a')
    assert.equal(climb.gain, 80)
    assert.equal(climb.wins, 4)
    assert.equal(climb.losses, 1)
    assert.deepEqual(climb.points, [1280, 1320, 1360])
    assert.equal(climb.now.lp, 60)
  })

  test('starts from the first snapshot of the day when there is none before', ({ assert }) => {
    const [climb] = climbsFrom(
      [
        snapshot('b', { lp: 10, at: NOW - 6 * HOUR }),
        snapshot('b', { lp: 70, wins: 53, at: NOW - HOUR }),
      ],
      new Map()
    )
    assert.equal(climb.gain, 60)
  })

  test('lists only gains, never a single snapshot, and keeps losses unknown', ({ assert }) => {
    const climbs = climbsFrom(
      [
        snapshot('falling', { lp: 10, at: NOW - HOUR }),
        snapshot('alone', { lp: 99, at: NOW - HOUR }),
        snapshot('hidden', { lp: 90, wins: 53, losses: null, at: NOW - HOUR }),
      ],
      new Map([
        ['falling', snapshot('falling', { lp: 60 })],
        ['hidden', snapshot('hidden', { lp: 20 })],
      ])
    )
    assert.deepEqual(
      climbs.map((c) => c.puuid),
      ['hidden']
    )
    assert.isNull(climbs[0].losses)
  })

  test('crosses into the apex ladder and orders by gain', ({ assert }) => {
    const climbs = climbsFrom(
      [
        snapshot('small', { lp: 60, at: NOW - HOUR }),
        snapshot('apex', { tier: 'MASTER', division: 'I', lp: 30, at: NOW - HOUR }),
      ],
      new Map([
        ['small', snapshot('small', { lp: 40 })],
        ['apex', snapshot('apex', { tier: 'DIAMOND', division: 'I', lp: 70 })],
      ])
    )
    assert.deepEqual(
      climbs.map((c) => [c.puuid, c.gain]),
      [
        ['apex', 60],
        ['small', 20],
      ]
    )
  })
})

test.group('Home: champions', () => {
  test('orders patches by number and skips a patch without enough games', ({ assert }) => {
    assert.isAbove(comparePatches('16.20', '16.9'), 0)
    const picked = pickPatch([
      { patch: '16.9', games: MIN_PATCH_GAMES * 3 },
      { patch: '16.21', games: MIN_PATCH_GAMES - 1 },
      { patch: '16.20', games: MIN_PATCH_GAMES },
    ])
    assert.equal(picked?.current.patch, '16.20')
    assert.equal(picked?.previous?.patch, '16.9')
    assert.isNull(pickPatch([{ patch: '16.21', games: MIN_PATCH_GAMES - 1 }]))
  })

  test('hides champions under the gate and their change when the patch before was thin', ({
    assert,
  }) => {
    const gate = MIN_CHAMPION_GAMES
    const rows = championRows(
      [
        { championId: 1, position: 'TOP', games: gate, wins: gate / 2 },
        { championId: 1, position: 'MIDDLE', games: gate, wins: gate },
        { championId: 2, position: 'UTILITY', games: gate - 1, wins: gate - 1 },
        { championId: 3, position: 'JUNGLE', games: gate, wins: gate * 0.4 },
      ],
      new Map([[3, 500]]),
      2000,
      [
        { championId: 1, position: 'TOP', games: gate, wins: gate / 2 },
        { championId: 3, position: 'JUNGLE', games: gate - 1, wins: 10 },
      ]
    )
    assert.deepEqual(
      rows.map((r) => r.championId),
      [1, 3]
    )
    const [first, second] = rows
    assert.equal(first.games, gate * 2)
    assert.equal(first.winRate, 0.75)
    assert.equal(first.pickRate, (gate * 2) / 2000)
    assert.equal(first.previousWinRate, 0.5)
    assert.equal(second.banRate, 0.25)
    assert.isNull(second.previousWinRate)
    assert.equal(second.position, 'JUNGLE')
  })

  test('shows nothing for a patch with no games', ({ assert }) => {
    assert.deepEqual(
      championRows([{ championId: 1, position: '', games: 500, wins: 1 }], new Map(), 0),
      []
    )
  })
})

test.group('Home: best games', () => {
  test('ranks every player of every game and keeps one line per player', ({ assert }) => {
    const older = lobby('EUW1_1', NOW - 5 * HOUR, 2)
    const newer = lobby('EUW1_2', NOW - HOUR, 7)
    // The same player stars in both games: only their best line stays.
    newer.participants[7].puuid = older.participants[2].puuid
    const lines = bestLines([older, newer])
    assert.lengthOf(lines, BEST_GAMES)
    assert.equal(new Set(lines.map((l) => l.puuid)).size, lines.length)
    assert.equal(lines[0].puuid, older.participants[2].puuid)
    for (let i = 1; i < lines.length; i++) assert.isAtMost(lines[i].score, lines[i - 1].score)
  })

  test('never scores a remake', ({ assert }) => {
    const remake = { ...lobby('EUW1_3', NOW, 0), duration: 200 } as Match
    assert.deepEqual(bestLines([remake]), [])
  })
})
