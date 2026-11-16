import { test } from '@japa/runner'
import { headlineGame, homeCards, patchMoves } from '../../inertia/lib/home_cards.js'
import type { HomeLaneRow, HomeMover, HomeMoves } from '../../inertia/lib/home.js'
import type { ProMatch } from '../../inertia/lib/pro_matches.js'

/** Made-up champions and matches: every figure here is the test's own. */
const mover = (championId: number, position: string, from: number, to: number): HomeMover => ({
  championId,
  name: `Champion ${championId}`,
  slug: `champion-${championId}`,
  position,
  from,
  to,
  winRate: 0.5,
})

const moves = (rows: HomeMover[]): HomeMoves => ({
  previousPatch: '16.21',
  roles: ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'].map((position) => ({
    position,
    up: rows.filter((m) => m.position === position && m.to < m.from),
    down: rows.filter((m) => m.position === position && m.to > m.from),
  })),
})

const match = (id: number, status: ProMatch['status']): ProMatch => ({
  id,
  league: null,
  tournament: null,
  name: null,
  at: '2026-11-14T19:00:00.000Z',
  status,
  bestOf: 5,
  teams: [
    { id: null, slug: null, name: 'Blue', code: 'BLU', score: 1 },
    { id: null, slug: null, name: 'Red', code: 'RED', score: 0 },
  ],
  winner: null,
  stream: null,
})

const lane = (championId: number, value: number): HomeLaneRow => ({
  championId,
  name: `Champion ${championId}`,
  slug: `champion-${championId}`,
  position: 'MIDDLE',
  value,
})

test.group('Home cards | where the patch moved them', () => {
  test('puts the champions the notes changed first, climbs before falls', ({ assert }) => {
    const rows = patchMoves(
      moves([
        mover(1, 'TOP', 23, 6),
        mover(2, 'MIDDLE', 10, 37),
        mover(3, 'JUNGLE', 40, 10),
        mover(4, 'BOTTOM', 20, 12),
      ]),
      [
        { championId: 1, kind: 'up' },
        { championId: 2, kind: 'down' },
        { championId: 4, kind: 'up' },
      ],
      3
    )
    assert.deepEqual(
      rows.map((r) => [r.championId, r.kind]),
      [
        [1, 'up'],
        [4, 'up'],
        [2, 'down'],
      ]
    )
  })

  test('keeps one line per champion, in the role where it sits near the top', ({ assert }) => {
    const rows = patchMoves(moves([mover(1, 'TOP', 23, 6), mover(1, 'MIDDLE', 51, 24)]))
    assert.deepEqual(
      rows.map((r) => r.position),
      ['TOP']
    )
  })

  test('is empty without a patch to compare', ({ assert }) => {
    assert.deepEqual(patchMoves(null), [])
  })
})

test.group('Home cards | which cards show', () => {
  test('the game being played, else the next, else the last result', ({ assert }) => {
    const next = match(1, 'not_started')
    const live = match(2, 'running')
    const result = match(3, 'finished')
    assert.equal(headlineGame([next, live], result)?.id, 2)
    assert.equal(headlineGame([next], result)?.id, 1)
    assert.equal(headlineGame([], result)?.id, 3)
    assert.isNull(headlineGame([], null))
  })

  test('leaves a card out when its data is missing, the next takes its place', ({ assert }) => {
    const rows = [lane(1, 600), lane(2, 400), lane(3, 300)]
    const cards = homeCards({
      game: null,
      moves: [],
      previousPatch: null,
      lanes: { bullies: rows, firstBlood: rows },
    })
    assert.deepEqual(
      cards.map((c) => c.key),
      ['bullies', 'firstBlood']
    )
  })

  test('shows three cards at most', ({ assert }) => {
    const rows = [lane(1, 600), lane(2, 400), lane(3, 300)]
    const cards = homeCards({
      game: match(1, 'running'),
      moves: patchMoves(
        moves([mover(1, 'TOP', 23, 6), mover(2, 'TOP', 30, 9), mover(3, 'TOP', 4, 19)])
      ),
      previousPatch: '16.21',
      lanes: { bullies: rows, firstBlood: rows },
    })
    assert.deepEqual(
      cards.map((c) => c.key),
      ['game', 'moves', 'bullies']
    )
  })

  test('needs three lines for a list card', ({ assert }) => {
    const cards = homeCards({
      game: null,
      moves: [],
      previousPatch: '16.21',
      lanes: { bullies: [lane(1, 600)], firstBlood: [] },
    })
    assert.deepEqual(cards, [])
  })
})
