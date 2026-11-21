import { test } from '@japa/runner'
import {
  currentApex,
  cutoffs,
  matchesName,
  oneTrickOf,
  pageOf,
  placeOf,
  roleShares,
  sortParam,
  sortRows,
  summarizePlayers,
  type ApexEntry,
  type GamesRow,
  type TierRead,
} from '#services/ladder'
import { averageScores } from '#services/ladder_service'
import {
  baselineOf,
  cutoffLine,
  recordAndRead,
  type HistoryPoint,
  type HistoryStore,
} from '#services/ladder_history'
import { headlineOf } from '#services/esports_service'
import type { ProMatch } from '#services/pro_match_service'

/** Made-up players only: the repository is public. */
const puuid = (name: string) => `test-ladder-${name}-`.padEnd(78, 'x')
const H = 3_600_000
const NOW = Date.UTC(2026, 10, 16, 12)

function entry(name: string, tier: ApexEntry['tier'], lp: number, seenAt: number): ApexEntry {
  return {
    puuid: puuid(name),
    tier,
    lp,
    wins: 100,
    losses: 80,
    hotStreak: false,
    veteran: false,
    freshBlood: false,
    inactive: false,
    seenAt,
  }
}

const reads: TierRead[] = [
  { tier: 'CHALLENGER', at: NOW - 2 * H, entries: 3 },
  { tier: 'GRANDMASTER', at: NOW - 1 * H, entries: 2 },
  { tier: 'MASTER', at: NOW - 30 * H, entries: 2 },
]

function games(name: string, champion: number, position: string, n: number, wins = 0, last = NOW) {
  return {
    puuid: puuid(name),
    champion,
    position,
    games: n,
    wins,
    kills: n * 5,
    deaths: n * 2,
    assists: n * 6,
    last,
  } satisfies GamesRow
}

test.group('Apex ladder', () => {
  test('keeps the entries of each tier’s newest read, ranked by tier then LP', ({ assert }) => {
    const list = currentApex(
      [
        entry('gm-high', 'GRANDMASTER', 1900, NOW - H),
        entry('chall-low', 'CHALLENGER', 1700, NOW - 2 * H),
        entry('chall-top', 'CHALLENGER', 2500, NOW - 2 * H),
        // Missing from the newest Challenger read: demoted or decayed since.
        entry('chall-gone', 'CHALLENGER', 2600, NOW - 26 * H),
        // A single update after the read counts at its newer LP.
        entry('gm-updated', 'GRANDMASTER', 1500, NOW - 0.5 * H),
        entry('master', 'MASTER', 900, NOW - 30 * H),
        entry('master-old', 'MASTER', 950, NOW - 80 * H),
      ],
      reads
    )
    assert.deepEqual(
      list.map((e) => e.puuid),
      ['chall-top', 'chall-low', 'gm-high', 'gm-updated', 'master'].map(puuid)
    )
  })

  test('reads the Challenger and Grandmaster cutoffs off the ladder', ({ assert }) => {
    const list = currentApex(
      [
        entry('a', 'CHALLENGER', 2500, NOW - 2 * H),
        entry('b', 'CHALLENGER', 1800, NOW - 2 * H),
        entry('c', 'GRANDMASTER', 1200, NOW - H),
      ],
      reads
    )
    assert.deepEqual(cutoffs(list, reads), [
      { tier: 'CHALLENGER', lp: 1800, players: 2, at: NOW - 2 * H },
      { tier: 'GRANDMASTER', lp: 1200, players: 1, at: NOW - H },
    ])
    assert.deepEqual(cutoffs([], []), [
      { tier: 'CHALLENGER', lp: null, players: 0, at: null },
      { tier: 'GRANDMASTER', lp: null, players: 0, at: null },
    ])
  })

  test('sums a player’s stored games into a main role and champions', ({ assert }) => {
    const players = summarizePlayers([
      games('mid', 7, 'MIDDLE', 30, 18, NOW - H),
      games('mid', 7, 'TOP', 2, 1, NOW - 9 * H),
      games('mid', 103, 'MIDDLE', 10, 4, NOW - 2 * H),
      games('mid', 238, 'MIDDLE', 4, 3, NOW - 3 * H),
      games('mid', 55, 'MIDDLE', 1, 0, NOW - 4 * H),
      games('flex', 1, 'TOP', 5),
      games('flex', 2, 'JUNGLE', 5),
      games('flex', 3, 'MIDDLE', 5),
      games('flex', 4, 'BOTTOM', 5),
    ])
    const mid = players.get(puuid('mid'))!
    assert.equal(mid.games, 47)
    assert.equal(mid.wins, 26)
    assert.equal(mid.role, 'MIDDLE')
    assert.deepEqual(
      mid.champions.map((c) => [c.champion, c.games, c.position]),
      [
        [7, 32, 'MIDDLE'],
        [103, 10, 'MIDDLE'],
        [238, 4, 'MIDDLE'],
      ]
    )
    // Four roles a quarter each: no main role.
    assert.isNull(players.get(puuid('flex'))!.role)
    assert.deepEqual(
      roleShares(players.values()).map((r) => [r.role, r.players, r.share]),
      [
        ['TOP', 0, 0],
        ['JUNGLE', 0, 0],
        ['MIDDLE', 1, 1],
        ['BOTTOM', 0, 0],
        ['UTILITY', 0, 0],
      ]
    )
  })

  test('calls a player a one-trick at half their games on one champion, from 20 games', ({
    assert,
  }) => {
    const players = summarizePlayers([
      games('otp', 55, 'MIDDLE', 30, 20, NOW - H),
      games('otp', 7, 'MIDDLE', 10, 5),
      games('few', 55, 'MIDDLE', 12, 8),
      games('spread', 1, 'TOP', 10),
      games('spread', 2, 'TOP', 8),
      games('spread', 3, 'TOP', 6),
    ])
    const trick = oneTrickOf(players.get(puuid('otp'))!)!
    assert.equal(trick.champion, 55)
    assert.equal(trick.games, 30)
    assert.equal(trick.share, 0.75)
    assert.equal(trick.kda, 5.5)
    assert.deepEqual(trick.also, { champion: 7, share: 0.25 })
    assert.isNull(oneTrickOf(players.get(puuid('few'))!))
    assert.isNull(oneTrickOf(players.get(puuid('spread'))!))
  })

  test('pages a list and finds names', ({ assert }) => {
    const list = Array.from({ length: 45 }, (_, i) => i)
    assert.deepEqual(pageOf(list, 3, 20), {
      rows: [40, 41, 42, 43, 44],
      page: 3,
      pages: 3,
      total: 45,
    })
    assert.equal(pageOf(list, 9, 20).page, 3)
    assert.deepEqual(pageOf([], 1, 20), { rows: [], page: 1, pages: 1, total: 0 })
    assert.isTrue(matchesName('Velvet Ravine', 'ravine'))
    assert.isTrue(matchesName('Velvet Ravine', 'velvet#EUW'))
    assert.isFalse(matchesName('Velvet Ravine', 'okami'))
    assert.isFalse(matchesName(null, 'okami'))
  })

  test('reads a sort and sorts a list, the ladder order on ties', ({ assert }) => {
    assert.deepEqual(sortParam('wr', 'asc', ['lp', 'wr'] as const), { key: 'wr', dir: 'asc' })
    assert.deepEqual(sortParam('WR', undefined, ['lp', 'wr'] as const), { key: 'wr', dir: 'desc' })
    assert.deepEqual(sortParam('drop', 'up', ['lp', 'wr'] as const), { key: null, dir: 'desc' })
    const rows = [
      { name: 'a', v: 2 },
      { name: 'b', v: null },
      { name: 'c', v: 5 },
      { name: 'd', v: 2 },
    ]
    const names = (list: typeof rows) => list.map((r) => r.name).join('')
    assert.equal(names(sortRows(rows, (r) => r.v, 'desc')), 'cadb')
    assert.equal(names(sortRows(rows, (r) => r.v, 'asc')), 'adcb')
    assert.equal(names(rows), 'abcd')
  })

  test('averages scores over scored games only', ({ assert }) => {
    const out = averageScores([], new Map([[puuid('none'), ['EUW1_1', 'EUW1_2']]]))
    assert.equal(out.size, 0)
  })
})

test.group('Esports headline', () => {
  const match = (id: number, status: ProMatch['status'], at: number): ProMatch => ({
    id,
    league: null,
    tournament: null,
    name: null,
    at: new Date(at).toISOString(),
    status,
    bestOf: 5,
    teams: [
      { id: null, slug: null, name: 'Team A', code: 'A', score: null },
      { id: null, slug: null, name: 'Team B', code: 'B', score: null },
    ],
    winner: null,
    stream: null,
  })

  test('leads with a live match, else the next one, else the last result', ({ assert }) => {
    const live = match(1, 'running', NOW - H)
    const next = match(2, 'not_started', NOW + 5 * H)
    const done = match(3, 'finished', NOW - 30 * H)
    assert.equal(headlineOf([live], [next], [done], NOW)?.id, 1)
    assert.equal(headlineOf([], [next], [done], NOW)?.id, 2)
    assert.equal(headlineOf([], [], [done], NOW)?.id, 3)
    // A match still "running" a day later is stale data, not live.
    assert.equal(headlineOf([match(4, 'running', NOW - 30 * H)], [], [done], NOW)?.id, 3)
    assert.isNull(headlineOf([], [], [], NOW))
  })
})

test.group('Ladder history', () => {
  const read = (c: number, g: number): TierRead[] => [
    { tier: 'CHALLENGER', at: c, entries: 2 },
    { tier: 'GRANDMASTER', at: g, entries: 1 },
  ]

  test('records a point per new read, then reads moves against a day-old one', async ({
    assert,
  }) => {
    const points: HistoryPoint[] = []
    const lps = new Map<number, Record<string, number>>()
    const store: HistoryStore = {
      points: async () => points,
      add: async (_p, point, lp) => {
        points.unshift(point)
        lps.set(point.at, lp)
      },
      lp: async (_p, at) => lps.get(at) ?? null,
    }
    const day1 = [
      entry('a', 'CHALLENGER', 2000, NOW - 30 * H),
      entry('b', 'CHALLENGER', 1900, NOW - 30 * H),
      entry('c', 'GRANDMASTER', 1500, NOW - 30 * H),
    ]
    const first = await recordAndRead(
      store,
      'EUW1',
      read(NOW - 30 * H, NOW - 30 * H),
      day1,
      cutoffs(day1, read(NOW - 30 * H, NOW - 30 * H)),
      NOW - 29 * H
    )
    assert.deepEqual(first.moves, {})
    assert.isNull(first.since)
    // The same reads again write nothing.
    await recordAndRead(store, 'EUW1', read(NOW - 30 * H, NOW - 30 * H), day1, [], NOW - 28 * H)
    assert.lengthOf(points, 1)

    // A day later Challenger was read again (b climbed past a), Grandmaster was not.
    const later = read(NOW - H, NOW - 30 * H)
    const day2 = [
      entry('b', 'CHALLENGER', 2100, NOW - H),
      entry('a', 'CHALLENGER', 1950, NOW - H),
      entry('c', 'GRANDMASTER', 1500, NOW - 30 * H),
    ]
    const second = await recordAndRead(store, 'EUW1', later, day2, cutoffs(day2, later), NOW)
    assert.lengthOf(points, 2)
    assert.equal(second.since, NOW - 29 * H)
    assert.deepEqual(second.moves[puuid('b')], { lp: 200, places: 1 })
    assert.deepEqual(second.moves[puuid('a')], { lp: -50, places: -1 })
    assert.isUndefined(second.moves[puuid('c')])
    assert.deepEqual(second.cutoffsThen, { CHALLENGER: 1900, GRANDMASTER: 1500 })
    assert.deepEqual(
      second.lines.CHALLENGER.map((p) => p.lp),
      [1900, 1950]
    )
  })

  test('picks a baseline at least 20 hours old and dedupes a tier’s reads', ({ assert }) => {
    const p = (at: number, c: number, lp: number): HistoryPoint => ({
      at,
      reads: { CHALLENGER: c },
      cutoffs: { CHALLENGER: lp, GRANDMASTER: null },
    })
    const points = [
      p(NOW - H, NOW - H, 2100),
      p(NOW - 10 * H, NOW - 30 * H, 2000),
      p(NOW - 26 * H, NOW - 30 * H, 2000),
    ]
    assert.equal(baselineOf(points, NOW)?.at, NOW - 26 * H)
    assert.isNull(baselineOf(points.slice(0, 2), NOW))
    assert.deepEqual(cutoffLine(points, 'CHALLENGER', NOW), [
      { at: NOW - 30 * H, lp: 2000 },
      { at: NOW - H, lp: 2100 },
    ])
  })

  test('finds a place on the ladder by Riot ID, whatever the case', ({ assert }) => {
    const entries = [
      entry('a', 'CHALLENGER', 1500, NOW),
      entry('b', 'GRANDMASTER', 900, NOW),
      entry('c', 'MASTER', 300, NOW),
    ]
    const identities = {
      [puuid('a')]: { gameName: 'Briar Signal', tagLine: 'EUW' },
      [puuid('c')]: { gameName: 'Moss Lantern', tagLine: 'ZEN' },
    }
    assert.equal(placeOf(entries, identities, 'briar signal', 'euw'), 1)
    assert.equal(placeOf(entries, identities, 'Moss Lantern', 'ZEN'), 3)
    assert.isNull(placeOf(entries, identities, 'Moss Lantern', 'EUW'))
  })
})
