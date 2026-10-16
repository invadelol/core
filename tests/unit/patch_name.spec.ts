import { test } from '@japa/runner'
import { patchName } from '../../inertia/lib/patch.js'

test.group('Patch names', () => {
  test('2026 game versions read as the year’s patch, without the build', ({ assert }) => {
    assert.equal(patchName('16.20'), '26.20')
    assert.equal(patchName('16.20.734.5512'), '26.20')
    assert.equal(patchName('16.1.1'), '26.1')
  })

  test('other forms are left alone, and mapping twice changes nothing', ({ assert }) => {
    assert.equal(patchName('25.S1.1'), '25.S1.1')
    assert.equal(patchName('26.20'), '26.20')
    assert.equal(patchName(patchName('16.20')), '26.20')
    assert.equal(patchName('14.9'), '14.9')
    assert.equal(patchName(''), '')
    assert.equal(patchName(null), '')
    assert.equal(patchName(undefined), '')
  })
})
