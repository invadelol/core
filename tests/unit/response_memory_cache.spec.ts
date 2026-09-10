import { test } from '@japa/runner'
import { ResponseMemoryCache, contentHash } from '#services/response_memory_cache'

function clock(start = 1_000_000) {
  let now = start
  return {
    now: () => now,
    advance: (ms: number) => (now += ms),
  }
}

test.group('Response memory cache', () => {
  test('serves a stored body and reuses one hash for it', ({ assert }) => {
    const cache = new ResponseMemoryCache()
    const body = Buffer.from('cached-analytics')

    const stored = cache.set('key', 'summoner:abc', body)
    const found = cache.get('key')

    assert.equal(found?.body, body)
    assert.equal(found?.hash, stored.hash)
    assert.equal(stored.hash, contentHash(body))
  })

  test('an entry expires on its own if the broadcast never arrives', ({ assert }) => {
    const time = clock()
    const cache = new ResponseMemoryCache(15_000, 512, time.now)
    cache.set('key', 'summoner:abc', Buffer.from('x'))

    time.advance(14_999)
    assert.isNotNull(cache.get('key'), 'dropped an entry that was still fresh')

    time.advance(2)
    assert.isNull(cache.get('key'), 'served an entry past its ttl')
  })

  test('invalidating a resource drops every response derived from it', ({ assert }) => {
    const cache = new ResponseMemoryCache()
    cache.set('matches', 'summoner:abc', Buffer.from('1'))
    cache.set('stats', 'summoner:abc', Buffer.from('2'))
    cache.set('other', 'summoner:zzz', Buffer.from('3'))

    cache.dropResource('summoner:abc')

    assert.isNull(cache.get('matches'))
    assert.isNull(cache.get('stats'))
    assert.isNotNull(cache.get('other'), 'dropped an unrelated player')
  })

  test('stays bounded, evicting whatever was used longest ago', ({ assert }) => {
    const cache = new ResponseMemoryCache(15_000, 3)
    for (const key of ['a', 'b', 'c']) cache.set(key, 'summoner:abc', Buffer.from(key))

    // Touching 'a' makes 'b' the least recently used.
    cache.get('a')
    cache.set('d', 'summoner:abc', Buffer.from('d'))

    assert.equal(cache.size, 3)
    assert.isNull(cache.get('b'))
    assert.isNotNull(cache.get('a'))
    assert.isNotNull(cache.get('d'))
  })

  test('a different body never reuses a validator', ({ assert }) => {
    assert.notEqual(
      contentHash(Buffer.from('{"total":1}')),
      contentHash(Buffer.from('{"total":2}'))
    )
    assert.equal(contentHash(Buffer.from('{"total":1}')), contentHash(Buffer.from('{"total":1}')))
  })
})
