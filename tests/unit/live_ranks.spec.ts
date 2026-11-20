import { test } from '@japa/runner'
import { LiveRanks } from '#services/live/ranks'
import { RiotUpstreamException } from '#utils/riot_errors'

const entry = (lp = 50) => ({
  queueType: 'RANKED_SOLO_5x5',
  tier: 'GOLD',
  rank: 'II',
  leaguePoints: lp,
  wins: 12,
  losses: 8,
})

test.group('Live ranks', () => {
  test('fetches every player without needing stored profiles and shares overlapping lobbies', async ({
    assert,
  }) => {
    const calls: string[] = []
    const ranks = new LiveRanks(async (id, platform) => {
      calls.push(`${platform}:${id}`)
      await Promise.resolve()
      return [entry()]
    })
    const players = Array.from({ length: 10 }, (_, i) => String(i).repeat(78))
    const [first, second] = await Promise.all([
      Promise.all(players.map((id) => ranks.get(id, 'euw1'))),
      Promise.all(players.map((id) => ranks.get(id, 'euw1'))),
    ])
    assert.lengthOf(calls, 10)
    assert.deepEqual(first, second)
    assert.isTrue(
      first.every((result) => result.status === 'ranked' && result.rank?.tier === 'GOLD')
    )
  })

  test('polls reuse recent ranks, explicit refresh bypasses them, and platforms stay separate', async ({
    assert,
  }) => {
    let now = 1000
    let calls = 0
    const ranks = new LiveRanks(
      async () => [entry(++calls)],
      () => now
    )
    let result = await ranks.get('player', 'euw1')
    assert.equal(result.rank?.leaguePoints, 1)
    result = await ranks.get('player', 'euw1')
    assert.equal(result.rank?.leaguePoints, 1)
    result = await ranks.get('player', 'euw1', true)
    assert.equal(result.rank?.leaguePoints, 2)
    result = await ranks.get('player', 'euw1')
    assert.equal(result.rank?.leaguePoints, 2)
    result = await ranks.get('player', 'na1')
    assert.equal(result.rank?.leaguePoints, 3)
    now += 60_001
    result = await ranks.get('player', 'euw1')
    assert.equal(result.rank?.leaguePoints, 4)
  })

  test('caches confirmed unranked answers, including players who only have a Flex rank', async ({
    assert,
  }) => {
    let calls = 0
    const ranks = new LiveRanks(async () => {
      calls++
      return [{ ...entry(), queueType: 'RANKED_FLEX_SR' }]
    })
    assert.deepEqual(await ranks.get('player', 'euw1'), { rank: null, status: 'unranked' })
    assert.deepEqual(await ranks.get('player', 'euw1'), { rank: null, status: 'unranked' })
    assert.equal(calls, 1)
  })

  test('a failed lookup is unavailable, not unranked, and does not block other players', async ({
    assert,
  }) => {
    const ranks = new LiveRanks(async (id) => {
      if (id === 'bad') throw new Error('Riot unavailable')
      return [entry()]
    })
    const [bad, good] = await Promise.all([ranks.get('bad', 'euw1'), ranks.get('good', 'euw1')])
    assert.deepEqual(bad, { rank: undefined, status: 'unavailable' })
    assert.equal(good.status, 'ranked')
  })

  test('failed manual refresh keeps the last rank, while later retries can succeed', async ({
    assert,
  }) => {
    let calls = 0
    const ranks = new LiveRanks(async () => {
      if (++calls === 2) throw new Error('Riot unavailable')
      return [entry(calls)]
    })
    const first = await ranks.get('player', 'euw1')
    const failed = await ranks.get('player', 'euw1', true)
    assert.deepEqual(failed.rank, first.rank)
    assert.equal(failed.status, 'unavailable')
    const retried = await ranks.get('player', 'euw1', true)
    assert.equal(retried.rank?.leaguePoints, 3)
  })

  test('explicit refresh still honors Riot Retry-After', async ({ assert }) => {
    let calls = 0
    const ranks = new LiveRanks(async () => {
      calls++
      throw new RiotUpstreamException('rate limited', 'E_RIOT_RATE_LIMITED', 429, 30)
    })
    const first = await ranks.get('player', 'euw1', true)
    const second = await ranks.get('player', 'euw1', true)
    assert.equal(first.status, 'unavailable')
    assert.equal(second.status, 'unavailable')
    assert.equal(calls, 1)
  })
})
