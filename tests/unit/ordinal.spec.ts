import { test } from '@japa/runner'
import { ordinal, ordinalSuffix } from '../../inertia/lib/format.js'

test.group('ordinal', () => {
  test('English suffixes, including the teens and 100s', ({ assert }) => {
    const cases: Record<number, string> = {
      1: '1st',
      2: '2nd',
      3: '3rd',
      4: '4th',
      10: '10th',
      11: '11th',
      12: '12th',
      13: '13th',
      21: '21st',
      22: '22nd',
      23: '23rd',
      32: '32nd',
      101: '101st',
      111: '111th',
      112: '112th',
    }
    for (const [n, text] of Object.entries(cases)) assert.equal(ordinal(Number(n)), text)
  })

  test('suffix alone', ({ assert }) => {
    assert.equal(ordinalSuffix(1), 'st')
    assert.equal(ordinalSuffix(113), 'th')
    assert.equal(ordinalSuffix(1002), 'nd')
  })
})
