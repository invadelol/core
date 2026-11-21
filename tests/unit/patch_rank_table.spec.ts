import { test } from '@japa/runner'
import { rankTable, valueRuns } from '../../inertia/lib/patch_notes.js'

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

test.group('Patch notes ratios', () => {
  const text = (runs: ReturnType<typeof valueRuns>) =>
    runs.map((r) => ({
      ratio: r.ratio,
      text: r.parts.map((p) => (p.kind === 'stat' ? p.stat.toUpperCase() : p.text)).join(''),
    }))

  test('each bracketed ratio is a run of its own', ({ assert }) => {
    assert.deepEqual(text(valueRuns('(+110% AD) (+100% AP)')), [
      { ratio: true, text: '(+110% AD)' },
      { ratio: false, text: ' ' },
      { ratio: true, text: '(+100% AP)' },
    ])
    assert.deepEqual(text(valueRuns('of his Max Health')), [
      { ratio: false, text: 'of his Max Health' },
    ])
    assert.deepEqual(text(valueRuns('1275 - 4000 (Scaling with Champion Level) (+50% AP)')), [
      { ratio: false, text: '1275 - 4000 ' },
      { ratio: true, text: '(Scaling with Champion Level)' },
      { ratio: false, text: ' ' },
      { ratio: true, text: '(+50% AP)' },
    ])
  })

  test('keeps the changed numbers marked', ({ assert }) => {
    const runs = valueRuns('(+115% bonus AD) (+100% AP)', '(+100% bonus AD) (+90% AP)')
    const changed = runs.flatMap((r) =>
      r.parts.flatMap((p) => (p.kind === 'num' && p.changed ? [p.text] : []))
    )
    assert.deepEqual(changed, ['115%', '100%'])
  })
})
