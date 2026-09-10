import { test } from '@japa/runner'
import { ByteCache } from '#utils/byte_cache'

test.group('Binary asset cache', () => {
  test('evicts by bytes using least recently used order', ({ assert }) => {
    const cache = new ByteCache<string>(10, 5)
    cache.set('a', 'a', 4, 1000)
    cache.set('b', 'b', 4, 1000)
    assert.equal(cache.get('a'), 'a')
    cache.set('c', 'c', 4, 1000)
    assert.isUndefined(cache.get('b'))
    assert.equal(cache.get('a'), 'a')
    assert.equal(cache.get('c'), 'c')
  })

  test('expires placeholders without extending their lifetime on reads', ({ assert }) => {
    let now = 0
    const cache = new ByteCache<string>(10, 5, () => now)
    cache.set('icon', 'placeholder', 3, 30)
    now = 29
    assert.equal(cache.get('icon'), 'placeholder')
    now = 30
    assert.isUndefined(cache.get('icon'))
  })

  test('caps entry count, rejects oversized assets, and accounts for replacement', ({ assert }) => {
    const cache = new ByteCache<string>(10, 2)
    cache.set('a', 'a', 2, 1000)
    cache.set('b', 'b', 2, 1000)
    cache.set('c', 'c', 2, 1000)
    assert.isUndefined(cache.get('a'))
    cache.set('huge', 'huge', 11, 1000)
    assert.isUndefined(cache.get('huge'))
    cache.set('b', 'replacement', 8, 1000)
    assert.equal(cache.get('c'), 'c')
    assert.equal(cache.get('b'), 'replacement')
  })
})
