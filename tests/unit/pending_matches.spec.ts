import { test } from '@japa/runner'
import { Exception } from '@adonisjs/core/exceptions'
import { FixedWindowLimiter } from '#services/desktop/rate_limiter'
import { RetryScheduler } from '#services/desktop/retry_scheduler'
import { RiotBudget } from '#services/desktop/riot_budget'
import {
  MISSING_MS,
  PENDING_PER_ADDRESS,
  PendingMatches,
  clusterOf,
} from '#services/pending_matches'
import { RiotUpstreamException } from '#utils/riot_errors'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** What match-v5 answers for a game that has not been published yet. */
const notYet = () =>
  new Exception('Summoner not found', { status: 404, code: 'E_SUMMONER_NOT_FOUND' })

/**
 * A queue whose attempts run 0, 10 and 20 ms after a game is queued, over a fake store: `riot`
 * answers each attempt in turn (a value is the stored game, an error is thrown), the last answer
 * repeating.
 */
function queue(riot: unknown[], options: { stored?: () => boolean; hits?: () => number } = {}) {
  const calls: string[] = []
  let i = 0
  const q = new PendingMatches({
    stored: async () => options.stored?.() ?? false,
    fetch: async (matchId) => {
      calls.push(matchId)
      const answer = riot[Math.min(i++, riot.length - 1)]
      if (answer instanceof Error) throw answer
      return answer
    },
  })
  q.retries = new RetryScheduler([0, 10, 20])
  let count = 0
  q.limiter = new FixedWindowLimiter('test:', {
    incrementWindow: async () => options.hits?.() ?? ++count,
  })
  return { q, calls }
}

const stored = { matchId: 'EUW1_1', platform: 'EUW1', gameStartMs: 1 }

test.group('Pending matches', () => {
  test('a game that is not stored yet is queued once, however many readers ask', async ({
    assert,
  }) => {
    const { q, calls } = queue([stored])
    const answers = await Promise.all([q.request('EUW1_1', 'a'), q.request('EUW1_1', 'b')])
    assert.deepEqual(answers, [
      { status: 'pending', retryAfter: 5 },
      { status: 'pending', retryAfter: 5 },
    ])
    assert.isTrue(q.has('EUW1_1'))
    await sleep(15)
    assert.deepEqual(calls, ['EUW1_1'])
    assert.isFalse(q.has('EUW1_1'), 'stored: out of the queue')
  })

  test('a game Riot publishes a little later is asked for again until it is stored', async ({
    assert,
  }) => {
    const { q, calls } = queue([
      notYet(),
      new RiotUpstreamException('busy', 'E_RIOT_RATE_LIMITED', 429),
      stored,
    ])
    await q.request('EUW1_2', 'a')
    await sleep(40)
    assert.lengthOf(calls, 3)
    assert.isFalse(q.has('EUW1_2'), 'stored: out of the queue')
  })

  test('a game Riot never gives answers not found for a while, then is asked for again', async ({
    assert,
  }) => {
    const { q, calls } = queue([notYet()])
    await q.request('EUW1_3', 'a')
    await sleep(40)
    assert.lengthOf(calls, 3, 'every attempt')
    assert.deepEqual(await q.request('EUW1_3', 'a'), { status: 'missing' })
    assert.lengthOf(calls, 3, 'not queued again')

    const start = Date.now()
    q.now = () => start + MISSING_MS + 1
    const again = await q.request('EUW1_3', 'a')
    assert.equal(again.status, 'pending')
    q.retries.clear()
  })

  test('a game of a queue never stored, or that Riot refuses, is not found at once', async ({
    assert,
  }) => {
    const brawl = queue([null])
    await brawl.q.request('EUW1_4', 'a')
    await sleep(5)
    assert.deepEqual(await brawl.q.request('EUW1_4', 'a'), { status: 'missing' })
    assert.lengthOf(brawl.calls, 1)

    const refused = queue([Object.assign(new Error('Bad Request'), { status: 400 })])
    await refused.q.request('EUW1_5', 'a')
    await sleep(5)
    assert.deepEqual(await refused.q.request('EUW1_5', 'a'), { status: 'missing' })
    assert.lengthOf(refused.calls, 1)
  })

  test('an unknown platform is never queued', async ({ assert }) => {
    const { q, calls } = queue([stored])
    assert.isNull(clusterOf('XX9_1'))
    assert.equal(clusterOf('KR_7'), 'asia')
    assert.deepEqual(await q.request('XX9_1', 'a'), { status: 'missing' })
    await sleep(5)
    assert.isEmpty(calls)
  })

  test('a game stored meanwhile costs no Riot call', async ({ assert }) => {
    const { q, calls } = queue([stored], { stored: () => true })
    await q.request('EUW1_6', 'a')
    await sleep(5)
    assert.isEmpty(calls)
    assert.isFalse(q.has('EUW1_6'))
  })

  test('a spent budget waits for the next attempt', async ({ assert }) => {
    const { q, calls } = queue([stored])
    q.budget = new RiotBudget(1)
    await q.request('EUW1_7', 'a')
    await q.request('EUW1_8', 'a')
    await sleep(5)
    assert.deepEqual(calls, ['EUW1_7'], 'one call in the window')
    assert.isTrue(q.has('EUW1_8'), 'still queued')
    q.retries.clear()
  })

  test('one address queues a bounded number of games; readers of queued ones ask freely', async ({
    assert,
  }) => {
    let hits = 0
    const { q } = queue([notYet()], { hits: () => ++hits })
    q.retries = new RetryScheduler([60_000])
    for (let i = 0; i < PENDING_PER_ADDRESS.limit; i++) await q.request(`EUW1_10${i}`, 'a')
    const over = await q.request('EUW1_999', 'a')
    assert.equal(over.status, 'pending', 'asked again later')
    assert.isFalse(q.has('EUW1_999'), 'not queued')
    // A game already queued never counts again.
    const before = hits
    const queued = await q.request('EUW1_100', 'a')
    assert.equal(queued.status, 'pending')
    assert.equal(hits, before)
    // A game Riot itself named (a profile sync) is queued without an address.
    assert.isTrue(q.enqueue('EUW1_998'))
    assert.isFalse(q.enqueue('EUW1_998'), 'once')
    q.retries.clear()
  })

  test('readers are told to ask again less often as the wait grows', async ({ assert }) => {
    const { q } = queue([notYet()])
    q.retries = new RetryScheduler([60 * 60_000])
    const start = Date.now()
    q.now = () => start
    await q.request('EUW1_11', 'a')
    q.now = () => start + 3 * 60_000
    assert.deepEqual(await q.request('EUW1_11', 'a'), { status: 'pending', retryAfter: 15 })
    q.now = () => start + 12 * 60_000
    assert.deepEqual(await q.request('EUW1_11', 'a'), { status: 'pending', retryAfter: 30 })
    q.retries.clear()
  })
})
