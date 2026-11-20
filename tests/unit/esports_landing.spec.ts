import { test } from '@japa/runner'
import { eventYear, isFinal } from '#services/esports_landing_service'
import { dayMonth, names, slots } from '../../inertia/lib/esports_landing.js'

test.group('Esports landing', () => {
  test('finds an event final and its year from the stored names', ({ assert }) => {
    assert.isTrue(isFinal('Grand Final: BLG vs GEN'))
    assert.isTrue(isFinal('Grand final: DFM vs SGW'))
    assert.isTrue(isFinal('Final'))
    assert.isFalse(isFinal('Semifinal 1: BLG vs T1'))
    assert.isFalse(isFinal('Quarterfinal 2: KC vs T1'))
    assert.isFalse(isFinal(null))
    assert.equal(eventYear('2026, Playoffs'), 2026)
    assert.isNull(eventYear('Playoffs'))
  })

  test('names a move and its day the same on the server and in the browser', ({ assert }) => {
    assert.equal(dayMonth('2026-11-14T23:30:00.000Z'), '14 Nov')
    const p = (name: string) => ({ name })
    assert.equal(names([p('Badlulu')]), 'Badlulu')
    assert.equal(names([p('a'), p('b')]), 'a and b')
    assert.equal(names([p('a'), p('b'), p('c')]), 'a, b and c')
    assert.equal(names([p('a'), p('b'), p('c'), p('d'), p('e')]), 'a, b and 3 more')
  })

  test("puts a team's starters in role order, an empty place where none is stored", ({
    assert,
  }) => {
    const starter = (slug: string, role: string) => ({ slug, name: slug, role, fresh: false })
    const team = { five: [starter('mid', 'MID'), starter('top', 'TOP'), starter('sup', 'SUPPORT')] }
    assert.deepEqual(
      slots(team).map((s) => s.p?.slug ?? null),
      ['top', null, 'mid', null, 'sup']
    )
  })
})
