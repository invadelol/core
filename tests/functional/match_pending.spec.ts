import { test } from '@japa/runner'
import { randomInt } from 'node:crypto'
import redis from '@adonisjs/redis/services/main'
import matchRepository from '#services/analytics/match_repository'
import matchSourceService from '#services/match_source_service'
import matchesService from '#services/matches_service'
import { invalidateResponseCache } from '#services/http_response_cache'
import memoryCache from '#services/response_memory_cache'
import pendingMatches from '#services/pending_matches'

const tick = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms))

/** A game id of this run only, so the in-process queue and the caches never mix runs. */
const fresh = () => `EUW1_${randomInt(1, 2 ** 47)}`

/**
 * ClickHouse and Riot stood in for: `db` holds the stored games; Riot gives a game once it is in
 * `riot` (a game that just ended is not, for a few minutes).
 */
function world() {
  const db = new Set<string>()
  const riot = new Set<string>()
  const asked: string[] = []
  matchRepository.getById = (async (id: string) =>
    db.has(id)
      ? {
          matchId: id,
          platform: 'EUW1',
          duration: 1800,
          participants: [],
          timeline: [{}],
          events: [{}],
          shop: [{}],
        }
      : null) as unknown as typeof matchRepository.getById
  matchRepository.getExistingIds = async (ids) => new Set(ids.filter((id) => db.has(id)))
  matchSourceService.decorate = (async (matches: Array<{ matchId: string }>) =>
    matches.map((m) =>
      Object.assign(m, { source: 'riot', verification: 'verified' })
    )) as unknown as typeof matchSourceService.decorate
  matchesService.fetchAndStoreMatch = async (matchId) => {
    asked.push(matchId)
    if (!riot.has(matchId)) {
      throw Object.assign(new Error('Summoner not found'), { status: 404 })
    }
    db.add(matchId)
    return { matchId, platform: 'EUW1', gameStartMs: 1 }
  }
  return { db, riot, asked }
}

test.group('A match that is not stored yet', (group) => {
  const getById = matchRepository.getById
  const existing = matchRepository.getExistingIds
  const decorate = matchSourceService.decorate
  const store = matchesService.fetchAndStoreMatch
  const ids: string[] = []
  const id = () => {
    const matchId = fresh()
    ids.push(matchId)
    return matchId
  }
  group.each.setup(() => memoryCache.clear())
  group.each.teardown(async () => {
    // No attempt may outlive the stand-ins and reach Riot.
    pendingMatches.clear()
    matchRepository.getById = getById
    matchRepository.getExistingIds = existing
    matchSourceService.decorate = decorate
    matchesService.fetchAndStoreMatch = store
    const keys = await redis.keys('pending:rl:*')
    if (keys.length) await redis.del(...keys)
  })
  group.teardown(async () => {
    await invalidateResponseCache(ids.map((matchId) => `match:${matchId}`))
  })

  test('is queued once, answers pending without being cached, then opens once stored', async ({
    client,
    assert,
  }) => {
    const { riot, asked } = world()
    const matchId = id()

    const first = await client.get(`/api/matches/${matchId}`)
    first.assertStatus(202)
    first.assertBody({ status: 'pending', matchId, retryAfter: 5 })
    assert.equal(first.header('retry-after'), '5')
    assert.equal(first.header('cache-control'), 'no-store')
    await tick()
    assert.deepEqual(asked, [matchId], 'asked of Riot in the background, once')

    // Riot has not published it: every reader is told to wait, nobody asks Riot again.
    const second = await client.get(`/api/matches/${matchId}`)
    second.assertStatus(202)
    assert.lengthOf(asked, 1)
    assert.isNull(await redis.get(`http_cache:v2:/api/matches/${matchId}`), 'never cached')

    // Riot publishes it; the next attempt stores it and the page's next poll opens it.
    riot.add(matchId)
    await matchesService.fetchAndStoreMatch(matchId, 'europe' as never)
    const stored = await client.get(`/api/matches/${matchId}`)
    stored.assertStatus(200)
    stored.assertBodyContains({ matchId, source: 'riot' })
  })

  test('a game stored but never shown, or of no known platform, is not found and never cached', async ({
    client,
    assert,
  }) => {
    const { db, asked } = world()
    const hidden = id()
    db.add(hidden)
    // Stored, yet the read finds nothing: a Brawl or League Classic game.
    matchRepository.getById = (async () => null) as unknown as typeof matchRepository.getById
    const brawl = await client.get(`/api/matches/${hidden}`)
    brawl.assertStatus(404)
    assert.equal(brawl.header('cache-control'), 'no-store')

    const nowhere = await client.get(`/api/matches/XX9_${randomInt(1, 2 ** 40)}`)
    nowhere.assertStatus(404)
    assert.equal(nowhere.header('cache-control'), 'no-store')
    await tick()
    assert.isEmpty(asked, 'Riot is never asked')
  })
})
