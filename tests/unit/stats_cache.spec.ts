import { test } from '@japa/runner'
import { StatsCache, type StatsStore } from '#services/stats_cache'

/** Redis as a map, with expiries on the given clock. */
function memoryStore(time: { now: () => number }) {
  const data = new Map<string, { value: string; until: number }>()
  const store: StatsStore & { data: typeof data } = {
    data,
    async get(key) {
      const hit = data.get(key)
      return hit && hit.until > time.now() ? hit.value : null
    },
    async set(key, value, ttlMs, nx = false) {
      if (nx && (await store.get(key)) !== null) return false
      data.set(key, { value, until: time.now() + ttlMs })
      return true
    },
    async del(key) {
      data.delete(key)
    },
  }
  return store
}

function clock(start = 1_000_000) {
  let now = start
  return { now: () => now, advance: (ms: number) => (now += ms) }
}

const HOUR = 3600_000
const settle = () => new Promise((resolve) => setTimeout(resolve, 5))

test.group('Stats cache', () => {
  test('loads once, then answers from this process', async ({ assert }) => {
    const time = clock()
    const cache = new StatsCache('t', { store: memoryStore(time), now: time.now })
    let loads = 0
    const load = async () => ++loads
    assert.equal(await cache.get('k', load), 1)
    assert.equal(await cache.get('k', load), 1)
    assert.equal(loads, 1)
  })

  test('a burst of requests for a missing answer costs one load', async ({ assert }) => {
    const time = clock()
    const cache = new StatsCache('t', { store: memoryStore(time), now: time.now })
    let loads = 0
    const load = async () => {
      loads++
      await settle()
      return 'v'
    }
    const answers = await Promise.all(Array.from({ length: 20 }, () => cache.get('k', load)))
    assert.deepEqual(new Set(answers), new Set(['v']))
    assert.equal(loads, 1)
  })

  test('another process reads the answer from the store instead of loading it', async ({
    assert,
  }) => {
    const time = clock()
    const store = memoryStore(time)
    const a = new StatsCache('t', { store, now: time.now })
    const b = new StatsCache('t', { store, now: time.now })
    await a.get('k', async () => ({ games: 3 }))
    let loaded = false
    const answer = await b.get('k', async () => {
      loaded = true
      return { games: 4 }
    })
    assert.deepEqual(answer, { games: 3 })
    assert.isFalse(loaded)
  })

  test('a stale answer is served at once while it is refreshed in the background', async ({
    assert,
  }) => {
    const time = clock()
    const cache = new StatsCache('t', {
      store: memoryStore(time),
      now: time.now,
      freshMs: 24 * HOUR,
      keepMs: 48 * HOUR,
    })
    await cache.get('k', async () => 'old')
    time.advance(25 * HOUR)
    assert.equal(await cache.get('k', async () => 'new'), 'old')
    await settle()
    assert.equal(await cache.get('k', async () => 'newer'), 'new')
  })

  test('an answer past keepMs is never served', async ({ assert }) => {
    const time = clock()
    const cache = new StatsCache('t', {
      store: memoryStore(time),
      now: time.now,
      freshMs: HOUR,
      keepMs: 2 * HOUR,
    })
    await cache.get('k', async () => 'old')
    time.advance(3 * HOUR)
    assert.equal(await cache.get('k', async () => 'new'), 'new')
  })

  test('a new generation starts over', async ({ assert }) => {
    const time = clock()
    let patch = '16.20'
    const cache = new StatsCache('t', {
      store: memoryStore(time),
      now: time.now,
      generation: async () => patch,
    })
    assert.equal(await cache.get('k', async () => 'a'), 'a')
    patch = '16.21'
    assert.equal(await cache.get('k', async () => 'b'), 'b')
  })

  test('a failed load is not kept, and a failed refresh keeps the stale answer', async ({
    assert,
  }) => {
    const time = clock()
    const cache = new StatsCache('t', {
      store: memoryStore(time),
      now: time.now,
      freshMs: HOUR,
      keepMs: 4 * HOUR,
    })
    await assert.rejects(() => cache.get('k', async () => Promise.reject(new Error('down'))))
    assert.equal(await cache.get('k', async () => 'v'), 'v')

    time.advance(2 * HOUR)
    assert.equal(await cache.get('k', async () => Promise.reject(new Error('down'))), 'v')
    await settle()
    assert.equal(await cache.get('k', async () => 'w'), 'v')
  })

  test('works without the store', async ({ assert }) => {
    const time = clock()
    const broken: StatsStore = {
      get: async () => Promise.reject(new Error('redis down')),
      set: async () => Promise.reject(new Error('redis down')),
      del: async () => Promise.reject(new Error('redis down')),
    }
    const cache = new StatsCache('t', { store: broken, now: time.now })
    let loads = 0
    assert.equal(await cache.get('k', async () => ++loads), 1)
    assert.equal(await cache.get('k', async () => ++loads), 1)
  })
})
