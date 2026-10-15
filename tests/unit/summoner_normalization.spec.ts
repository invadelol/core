import { test } from '@japa/runner'
import summonerService from '#services/summoner_service'

test.group('Summoner Normalization', () => {
  test('normalizes simple name', ({ assert }) => {
    const result = summonerService.normalize('Name-Tag')
    assert.deepEqual(result, { gameName: 'Name', tagLine: 'Tag' })
  })

  test('normalizes name with spaces (encoded)', ({ assert }) => {
    const result = summonerService.normalize('Sable%20Fox-SLY')
    assert.deepEqual(result, { gameName: 'Sable Fox', tagLine: 'SLY' })
  })

  test('normalizes name with hyphens (encoded)', ({ assert }) => {
    const result = summonerService.normalize('My%2DName-Tag')
    assert.deepEqual(result, { gameName: 'My-Name', tagLine: 'Tag' })
  })

  test('normalizes name with hyphens (not encoded)', ({ assert }) => {
    // This previously failed (gave gameName="My", tagLine="Name")
    // Now it should work if we split by last hyphen
    const result = summonerService.normalize('My-Name-Tag')
    assert.deepEqual(result, { gameName: 'My-Name', tagLine: 'Tag' })
  })

  test('normalizes name with fully encoded separator', ({ assert }) => {
    // This previously failed
    const result = summonerService.normalize('Sable%20Fox%2DSLY')
    assert.deepEqual(result, { gameName: 'Sable Fox', tagLine: 'SLY' })
  })

  test('normalizes name with plus sign', ({ assert }) => {
    // decodeURIComponent does NOT handle +, but let's see current behavior
    // Input: Sable+Fox-SLY. decodeURIComponent("Sable+Fox") -> "Sable+Fox".
    const result = summonerService.normalize('Sable+Fox-SLY')
    assert.deepEqual(result, { gameName: 'Sable+Fox', tagLine: 'SLY' })
  })

  test('returns null for invalid format', ({ assert }) => {
    assert.isNull(summonerService.normalize('Invalid'))
    assert.isNull(summonerService.normalize('NoSeparator'))
  })
})
