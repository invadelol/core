import { test } from '@japa/runner'
import { headlineGame, homeCards, patchChanges } from '../../inertia/lib/home_cards.js'
import type { HomeLaneRow, HomePatchChange } from '../../inertia/lib/home.js'
import type { ProMatch } from '../../inertia/lib/pro_matches.js'

/** Made-up champions and matches: every figure here is the test's own. */
const change = (
  championId: number,
  kind: HomePatchChange['kind'],
  prevRank: number | null = null,
  rank: number | null = null
): HomePatchChange => ({
  championId,
  kind,
  name: `Champion ${championId}`,
  keys: ['Q'],
  position: 'MIDDLE',
  rank,
  prevRank,
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

test.group('Home cards | the patch changes', () => {
  test('buffs then nerfs, both sides kept, the biggest moves first', ({ assert }) => {
    const c = patchChanges([
      change(1, 'up', 30, 28),
      change(2, 'up', 40, 10),
      change(3, 'up', 12, 9),
      change(4, 'down', 5, 9),
      change(5, 'down', 3, 30),
      change(6, 'down', 8, 12),
      change(7, 'mix', 20, 18),
    ])
    assert.deepEqual(
      c.up.map((r) => r.championId),
      [2, 3]
    )
    assert.deepEqual(
      c.down.map((r) => r.championId),
      [5, 4]
    )
    assert.deepEqual(c.mix, [])
  })

  test('fills the room with one side or the adjusted ones when the other is short', ({
    assert,
  }) => {
    const onlyBuffs = patchChanges([change(1, 'up'), change(2, 'up'), change(3, 'mix')])
    assert.deepEqual([onlyBuffs.up.length, onlyBuffs.down.length, onlyBuffs.mix.length], [2, 0, 1])
    const oneBuff = patchChanges([
      change(1, 'up'),
      change(2, 'down'),
      change(3, 'down'),
      change(4, 'down'),
      change(5, 'down'),
    ])
    assert.deepEqual([oneBuff.up.length, oneBuff.down.length], [1, 3])
  })

  test('keeps the notes order for champions without a place in their role', ({ assert }) => {
    const c = patchChanges([change(1, 'up'), change(2, 'up', 20, 10), change(3, 'up')])
    assert.deepEqual(
      c.up.map((r) => r.championId),
      [2, 1, 3]
    )
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
      changes: null,
      patch: null,
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
      changes: patchChanges([change(1, 'up'), change(2, 'up'), change(3, 'down')]),
      patch: '26.22',
      lanes: { bullies: rows, firstBlood: rows },
    })
    assert.deepEqual(
      cards.map((c) => c.key),
      ['game', 'changes', 'bullies']
    )
  })

  test('needs three lines for a list card', ({ assert }) => {
    const cards = homeCards({
      game: null,
      changes: patchChanges([change(1, 'up'), change(2, 'down')]),
      patch: '26.22',
      lanes: { bullies: [lane(1, 600)], firstBlood: [] },
    })
    assert.deepEqual(cards, [])
  })
})
