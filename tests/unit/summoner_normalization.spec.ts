import { test } from '@japa/runner'
import summonerService from '#services/summoner_service'

test.group('Summoner Normalization', () => {
  test('normalizes simple name', ({ assert }) => {
    const result = summonerService.normalize('Name-Tag')
    assert.deepEqual(result, { gameName: 'Name', tagLine: 'Tag' })
  })

  test('normalizes name with spaces (encoded)', ({ assert }) => {
    const result = summonerService.normalize('MRS%20PauluX-KCWIN')
    assert.deepEqual(result, { gameName: 'MRS PauluX', tagLine: 'KCWIN' })
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
    const result = summonerService.normalize('MRS%20PauluX%2DKCWIN')
    assert.deepEqual(result, { gameName: 'MRS PauluX', tagLine: 'KCWIN' })
  })

  test('normalizes name with plus sign', ({ assert }) => {
    // decodeURIComponent does NOT handle +, but let's see current behavior
    // Input: MRS+PauluX-KCWIN. decodeURIComponent("MRS+PauluX") -> "MRS+PauluX".
    const result = summonerService.normalize('MRS+PauluX-KCWIN')
    assert.deepEqual(result, { gameName: 'MRS+PauluX', tagLine: 'KCWIN' })
  })

  test('returns null for invalid format', ({ assert }) => {
    assert.isNull(summonerService.normalize('Invalid'))
    assert.isNull(summonerService.normalize('NoSeparator'))
  })
})
