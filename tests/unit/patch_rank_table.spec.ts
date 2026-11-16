import { test } from '@japa/runner'
import { rankTable } from '../../inertia/lib/patch_notes.js'

test.group('Patch notes rank tables', () => {
  test('a value per rank on both sides becomes a table, the rest kept apart', ({ assert }) => {
    assert.deepEqual(rankTable('12 / 11 / 10 / 9 / 8s', '10 / 9.5 / 9 / 8.5 / 8s'), {
      old: ['12', '11', '10', '9', '8'],
      new: ['10', '9.5', '9', '8.5', '8'],
      unit: 's',
      restOld: '',
      restNew: '',
    })
    const t = rankTable('90 / 170 / 250 (+85% bonus AD)', '100 / 190 / 280 (+90% bonus AD)')
    assert.equal(t?.restOld, '(+85% bonus AD)')
    assert.equal(t?.restNew, '(+90% bonus AD)')
    assert.equal(rankTable('120 / 100 / 80 seconds', '120 / 90 / 60 seconds')?.unit, 's')
  })

  test('anything else stays a line', ({ assert }) => {
    assert.isNull(rankTable('6s', '5s'))
    assert.isNull(rankTable('30%', '20 / 25 / 30 / 35 / 40%'))
    assert.isNull(rankTable('640 + 99/Level', '590 + 107/Level'))
    assert.isNull(rankTable('60 / 85 / 110 / 135 / 160 (+55% AP)', '60 (+25% AP)'))
  })
})
