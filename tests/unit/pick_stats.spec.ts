import { test } from '@japa/runner'
import { PickStatsService, bracketList } from '#services/pick_stats_service'
import { pickQueryValidator } from '#validators/runes'
import type { Bracket } from '#services/ranked_stats'

/** A service that answers after `ms`, recording what it was asked. */
function source(kind: string, ms: number, asked: string[], empty: Bracket[] = []) {
  return {
    async forRole(champion: number, role: string, bracket: Bracket, patch?: string) {
      asked.push(`${kind}:${champion}:${role}:${bracket}:${patch ?? ''}`)
      await new Promise((resolve) => setTimeout(resolve, ms))
      return empty.includes(bracket) ? null : ({ kind, bracket } as any)
    },
  }
}

test.group('Pick stats', () => {
  test('every bracket and kind is asked at once and answered by bracket', async ({ assert }) => {
    const asked: string[] = []
    const service = new PickStatsService({
      runes: source('runes', 40, asked),
      builds: source('builds', 40, asked),
      summoners: source('summoners', 40, asked, ['master_plus']),
    })
    const started = Date.now()
    const answers = await service.forRole(147, 'mid', ['emerald_plus', 'master_plus', 'all'])
    // Nine answers of 40 ms each, at the same time: well under their sum.
    assert.isBelow(Date.now() - started, 200)
    assert.lengthOf(asked, 9)
    assert.include(asked, 'builds:147:mid:master_plus:')
    assert.deepEqual(Object.keys(answers), ['emerald_plus', 'master_plus', 'all'])
    assert.deepEqual(answers.emerald_plus.runes, { kind: 'runes', bracket: 'emerald_plus' })
    assert.deepEqual(answers.all.builds, { kind: 'builds', bracket: 'all' })
    assert.isNull(answers.master_plus.summoners)
  })

  test('the patch asked is passed on', async ({ assert }) => {
    const asked: string[] = []
    const one = source('x', 0, asked)
    await new PickStatsService({ runes: one, builds: one, summoners: one }).forRole(
      31,
      'support',
      ['all'],
      '16.20'
    )
    assert.deepEqual(asked, [
      'x:31:support:all:16.20',
      'x:31:support:all:16.20',
      'x:31:support:all:16.20',
    ])
  })

  test('brackets are read once each, in order, all ranks by default', ({ assert }) => {
    assert.deepEqual(bracketList('emerald_plus,emerald,emerald_plus,all'), [
      'emerald_plus',
      'emerald',
      'all',
    ])
    assert.deepEqual(bracketList(undefined), ['all'])
  })

  test('the query takes up to five known brackets', async ({ assert }) => {
    const ok = await pickQueryValidator.validate({
      brackets: 'master_plus,diamond_plus,diamond,emerald_plus,all',
    })
    assert.equal(ok.brackets, 'master_plus,diamond_plus,diamond,emerald_plus,all')
    assert.deepEqual(await pickQueryValidator.validate({}), {})
    for (const brackets of [
      '',
      'gold,',
      'unknown',
      'all;drop',
      'iron,bronze,silver,gold,platinum,emerald',
    ]) {
      const refused = await pickQueryValidator.validate({ brackets }).then(
        () => false,
        () => true
      )
      assert.isTrue(refused, brackets)
    }
  })
})
