import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { FAQ, NEW_DAWN, TEASER, UPDATED_DAY, plain } from '../../inertia/lib/new_dawn.js'

const overview = readFileSync('inertia/components/new_dawn/NdOverview.vue', 'utf8')

test.group('New Dawn hub links and dates', () => {
  test('no link points at a tier list that is put away or empty', ({ assert }) => {
    assert.notInclude(overview, 'href="/tier-list/aram"')
    for (const line of overview.split('\n'))
      if (line.includes('href="/tier-list/runes"')) assert.include(line, 'v-if="SHOW_RUNES"')
  })

  test('the updated line and the dates in the copy follow one date', ({ assert }) => {
    assert.include(NEW_DAWN.updated, UPDATED_DAY)
    assert.equal(NEW_DAWN.modified.slice(8, 10), UPDATED_DAY.split(' ')[0].padStart(2, '0'))
    const copy = [...FAQ.map((f) => plain(f.a)), JSON.stringify(TEASER)].join(' ')
    for (const m of copy.matchAll(/\bby (\d{1,2} [A-Z][a-z]{2})\b/g))
      assert.equal(m[1], UPDATED_DAY)
  })
})
