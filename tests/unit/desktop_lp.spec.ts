import { test } from '@japa/runner'
import { ladder, validateLpChange, type GameFactsForLp } from '#services/desktop/lp'

const CREATION = Date.UTC(2026, 9, 8, 12)
const END = CREATION + 1810 * 1000
const game = (overrides: Partial<GameFactsForLp> = {}): GameFactsForLp => ({
  queueId: 420,
  gameCreation: CREATION,
  gameDuration: 1810,
  win: true,
  ...overrides,
})

function report(
  before: [tier: string, division: string | null, lp: number, wins: number, losses: number],
  after: [tier: string, division: string | null, lp: number, wins: number, losses: number],
  overrides: Record<string, unknown> = {}
) {
  const snapshot = ([tier, division, lp, wins, losses]: typeof before, at: number) => ({
    tier,
    division,
    lp,
    wins,
    losses,
    at,
  })
  return {
    queue: 'RANKED_SOLO_5x5',
    before: snapshot(before, CREATION - 60_000),
    after: snapshot(after, END + 90_000),
    ...overrides,
  }
}

test.group('Desktop LP ladder', (group) => {
  group.tap((t) => t.tags(['@desktop']))
  test('puts every rank on one ladder from Iron IV 0', ({ assert }) => {
    assert.equal(ladder({ tier: 'IRON', division: 'IV', lp: 0 }), 0)
    assert.equal(ladder({ tier: 'IRON', division: 'III', lp: 0 }), 100)
    assert.equal(ladder({ tier: 'GOLD', division: 'II', lp: 45 }), 1445)
    assert.equal(ladder({ tier: 'EMERALD', division: 'II', lp: 64 }), 2264)
    assert.equal(ladder({ tier: 'DIAMOND', division: 'I', lp: 99 }), 2799)
  })

  test('Master and above share one ladder from 2800, whatever the division says', ({ assert }) => {
    assert.equal(ladder({ tier: 'MASTER', division: 'I', lp: 0 }), 2800)
    assert.equal(ladder({ tier: 'GRANDMASTER', division: null, lp: 540 }), 3340)
    assert.equal(ladder({ tier: 'CHALLENGER', division: '', lp: 1200 }), 4000)
  })

  test('is null for anything that is not a rank', ({ assert }) => {
    assert.isNull(ladder({ tier: 'NONE', division: '', lp: 0 }))
    assert.isNull(ladder({ tier: 'GOLD', division: 'V', lp: 10 }))
    assert.isNull(ladder({ tier: 'GOLD', division: 'II', lp: 140 }))
    assert.isNull(ladder({ tier: 'GOLD', division: 'II', lp: -1 }))
  })
})

test.group('Desktop LP change validation (§4.4)', (group) => {
  group.tap((t) => t.tags(['@desktop']))
  test('accepts a win and a loss one game apart', ({ assert }) => {
    const win = validateLpChange(
      report(['EMERALD', 'II', 45, 60, 52], ['EMERALD', 'II', 64, 61, 52]),
      game()
    )
    assert.deepInclude(win, { ok: true })
    assert.equal(win.ok && win.change.delta, 19)

    const loss = validateLpChange(
      report(['EMERALD', 'II', 45, 60, 52], ['EMERALD', 'II', 27, 60, 53]),
      game({ win: false })
    )
    assert.equal(loss.ok && loss.change.delta, -18)
  })

  test('accepts promotions and demotions across divisions and tiers', ({ assert }) => {
    const division = validateLpChange(
      report(['GOLD', 'IV', 90, 10, 8], ['GOLD', 'III', 12, 11, 8]),
      game()
    )
    assert.equal(division.ok && division.change.delta, 22)

    const tier = validateLpChange(
      report(['GOLD', 'I', 95, 10, 8], ['PLATINUM', 'IV', 18, 11, 8]),
      game()
    )
    assert.equal(tier.ok && tier.change.delta, 23)

    const demotion = validateLpChange(
      report(['GOLD', 'IV', 0, 10, 8], ['SILVER', 'I', 75, 10, 9]),
      game({ win: false })
    )
    assert.equal(demotion.ok && demotion.change.delta, -25)

    // A loss at 0 LP under demotion protection costs nothing.
    const floor = validateLpChange(
      report(['IRON', 'IV', 0, 1, 8], ['IRON', 'IV', 0, 1, 9]),
      game({ win: false })
    )
    assert.equal(floor.ok && floor.change.delta, 0)
  })

  test('accepts apex tiers on their shared ladder', ({ assert }) => {
    const into = validateLpChange(
      report(['DIAMOND', 'I', 90, 120, 100], ['MASTER', 'I', 10, 121, 100]),
      game()
    )
    assert.equal(into.ok && into.change.delta, 20)

    const grandmaster = validateLpChange(
      report(['GRANDMASTER', 'I', 300, 200, 150], ['GRANDMASTER', 'I', 282, 200, 151]),
      game({ win: false })
    )
    assert.equal(grandmaster.ok && grandmaster.change.delta, -18)
  })

  test('rejects snapshots that are not exactly one game apart', ({ assert }) => {
    const verdict = validateLpChange(
      report(['EMERALD', 'II', 45, 60, 52], ['EMERALD', 'II', 82, 62, 52]),
      game()
    )
    assert.deepEqual(verdict, { ok: false, reason: 'snapshots are not exactly one game apart' })
  })

  test('rejects snapshots that disagree with the result', ({ assert }) => {
    const verdict = validateLpChange(
      report(['EMERALD', 'II', 45, 60, 52], ['EMERALD', 'II', 64, 61, 52]),
      game({ win: false })
    )
    assert.deepEqual(verdict, { ok: false, reason: 'snapshots disagree with the game result' })
  })

  test('rejects provisional and invalid ranks', ({ assert }) => {
    const placements = validateLpChange(
      report(['NONE', '', 0, 3, 2], ['GOLD', 'IV', 0, 4, 2]),
      game()
    )
    assert.isFalse(placements.ok)

    const flagged = report(['GOLD', 'IV', 10, 3, 2], ['GOLD', 'IV', 30, 4, 2])
    ;(flagged.after as any).provisional = true
    assert.deepEqual(validateLpChange(flagged, game()), {
      ok: false,
      reason: 'after snapshot is provisional',
    })
  })

  test('rejects the wrong queue and unranked games', ({ assert }) => {
    const flex = report(['GOLD', 'IV', 10, 3, 2], ['GOLD', 'IV', 30, 4, 2], {
      queue: 'RANKED_FLEX_SR',
    })
    assert.isFalse(validateLpChange(flex, game()).ok)
    assert.isTrue(validateLpChange(flex, game({ queueId: 440 })).ok)
    assert.isFalse(validateLpChange(flex, game({ queueId: 450 })).ok)
  })

  test('the before snapshot may trail game creation by the loading screen', ({ assert }) => {
    const loading = report(['GOLD', 'IV', 10, 3, 2], ['GOLD', 'IV', 30, 4, 2])
    loading.before.at = CREATION + 4 * 60_000
    assert.isTrue(validateLpChange(loading, game()).ok)
  })

  test('rejects snapshots taken at the wrong time', ({ assert }) => {
    const late = report(['GOLD', 'IV', 10, 3, 2], ['GOLD', 'IV', 30, 4, 2])
    late.before.at = END
    assert.deepEqual(validateLpChange(late, game()), {
      ok: false,
      reason: 'before snapshot taken after the game ended',
    })

    const early = report(['GOLD', 'IV', 10, 3, 2], ['GOLD', 'IV', 30, 4, 2])
    early.after.at = END - 1000
    assert.isFalse(validateLpChange(early, game()).ok)

    const stale = report(['GOLD', 'IV', 10, 3, 2], ['GOLD', 'IV', 30, 4, 2])
    stale.after.at = END + 31 * 60_000
    assert.isFalse(validateLpChange(stale, game()).ok)
  })

  test('rejects deltas with the wrong sign or out of range', ({ assert }) => {
    assert.isFalse(
      validateLpChange(report(['GOLD', 'IV', 30, 3, 2], ['GOLD', 'IV', 10, 4, 2]), game()).ok
    )
    assert.isFalse(
      validateLpChange(report(['GOLD', 'IV', 30, 3, 2], ['GOLD', 'IV', 30, 4, 2]), game()).ok
    )
    assert.isFalse(
      validateLpChange(
        report(['GOLD', 'IV', 30, 3, 2], ['GOLD', 'IV', 50, 3, 3]),
        game({ win: false })
      ).ok
    )
    assert.isFalse(
      validateLpChange(report(['GOLD', 'IV', 10, 3, 2], ['GOLD', 'II', 20, 4, 2]), game()).ok
    )
  })
})
