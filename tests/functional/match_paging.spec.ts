import { test } from '@japa/runner'
import { randomBytes } from 'node:crypto'
import redis from '@adonisjs/redis/services/main'
import riotApiService from '#services/riot/api'
import summonerService from '#services/summoner_service'
import matchService from '#services/matches_service'
import matchRepository from '#services/analytics/match_repository'
import Summoner from '#models/summoner'

/** A Riot API puuid's shape (78 base64url characters), never a real one. */
const fakePuuid = () => randomBytes(64).toString('base64url').slice(0, 78)
const DAY = 86_400_000
const START = Date.UTC(2026, 9, 1)

/**
 * The player's games: `stored` in ClickHouse (newest first), `riot` older ones only Riot has.
 * Riot's ids page answers like match-v5: the newest `count` that started before `endTime` (s).
 */
function world(stored: number, riot: number) {
  const game = (i: number) => ({ matchId: `EUW1_${1000 - i}`, gameStartMs: START - i * DAY })
  const db = Array.from({ length: stored }, (_, i) => game(i))
  const all = Array.from({ length: stored + riot }, (_, i) => game(i))
  const calls = { ids: 0 }
  riotApiService.client = {
    matchV5: {
      getIdsByPuuid: async ({ params }: { params: { count: number; endTime: number } }) => {
        calls.ids++
        return all
          .filter((g) => g.gameStartMs < params.endTime * 1000)
          .slice(0, params.count)
          .map((g) => g.matchId)
      },
    },
  } as unknown as typeof riotApiService.client
  matchRepository.getExistingIds = async (ids) =>
    new Set(ids.filter((id) => db.some((g) => g.matchId === id)))
  matchService.fetchAndStoreMatch = async (matchId) => {
    const g = all.find((x) => x.matchId === matchId)!
    db.push(g)
    db.sort((a, b) => b.gameStartMs - a.gameStartMs)
    return { matchId, platform: 'EUW1', gameStartMs: g.gameStartMs }
  }
  summonerService.getMatches = (async (_puuid, filters) =>
    db
      .filter((g) => filters.before === undefined || g.gameStartMs < filters.before)
      .slice(
        filters.offset ?? 0,
        (filters.offset ?? 0) + (filters.count ?? 15)
      )) as typeof summonerService.getMatches
  Summoner.find = (async () => ({ platform: 'EUW1' })) as unknown as typeof Summoner.find
  return calls
}

test.group('Match history paging', (group) => {
  const client = riotApiService.client
  const existing = matchRepository.getExistingIds
  const store = matchService.fetchAndStoreMatch
  const getMatches = summonerService.getMatches
  const find = Summoner.find
  group.each.teardown(async () => {
    riotApiService.client = client
    matchRepository.getExistingIds = existing
    matchService.fetchAndStoreMatch = store
    summonerService.getMatches = getMatches
    Summoner.find = find
    const keys = await redis.keys('pages:*')
    if (keys.length) await redis.del(...keys)
  })

  const page = (puuid: string, query: string) =>
    `/api/summoners/puuid/${puuid}/matches?view=summary&count=15&${query}`

  test('stored pages never ask Riot', async ({ client: http, assert }) => {
    const calls = world(40, 30)
    const puuid = fakePuuid()
    const first = await http.get(page(puuid, `before=${START + 1}`))
    first.assertStatus(200)
    assert.lengthOf(first.body(), 15)
    const second = await http.get(page(puuid, `before=${START - 14 * DAY}`))
    assert.lengthOf(second.body(), 15)
    assert.equal(calls.ids, 0)
  })

  test('stored pages are never counted: a long stored history still leaves the Riot budget whole', async ({
    client: http,
    assert,
  }) => {
    const calls = world(150, 100)
    const puuid = fakePuuid()
    let oldest = START + 1
    for (let i = 0; i < 10; i++) {
      const response = await http.get(page(puuid, `before=${oldest}`))
      response.assertStatus(200)
      assert.isUndefined(response.header('retry-after'))
      const games = response.body() as Array<{ gameStartMs: number }>
      assert.lengthOf(games, 15, `stored page ${i + 1} is full`)
      oldest = games[games.length - 1].gameStartMs
    }
    assert.equal(calls.ids, 0, 'ten stored pages, no Riot call')
    for (let i = 0; i < 3; i++) {
      const response = await http.get(page(puuid, `before=${oldest}`))
      response.assertStatus(200)
      const games = response.body() as Array<{ gameStartMs: number }>
      assert.lengthOf(games, 15, `Riot page ${i + 1} is full`)
      oldest = games[games.length - 1].gameStartMs
    }
    assert.equal(calls.ids, 3, 'all three Riot pages were still there')
  })

  test('a short page is filled from Riot three times, then ends quietly with Retry-After', async ({
    client: http,
    assert,
  }) => {
    const calls = world(10, 100)
    const puuid = fakePuuid()
    let oldest = START + 1
    for (let i = 0; i < 3; i++) {
      const response = await http.get(page(puuid, `before=${oldest}`))
      response.assertStatus(200)
      const games = response.body() as Array<{ gameStartMs: number }>
      assert.lengthOf(games, 15, `page ${i + 1} is full`)
      oldest = games[games.length - 1].gameStartMs
    }
    assert.equal(calls.ids, 3)
    const held = await http.get(page(puuid, `before=${oldest}`))
    held.assertStatus(200)
    held.assertHeader('retry-after', '120')
    assert.deepEqual(held.body(), [], 'nothing more stored: an empty page, no error')
    assert.equal(calls.ids, 3, 'nothing asked from Riot while held')
  })

  test('a held page still carries the stored games before it', async ({ client: http, assert }) => {
    const calls = world(20, 100)
    const puuid = fakePuuid()
    // Spend the player's Riot budget on pages older than any game (Riot answers none of them).
    for (let i = 0; i < 3; i++) {
      const spent = await http.get(page(puuid, `before=${START - (500 + i) * DAY}`))
      assert.deepEqual(spent.body(), [])
      assert.isUndefined(spent.header('retry-after'), 'the end of the history, not a hold')
    }
    assert.equal(calls.ids, 3)
    const response = await http.get(page(puuid, `before=${START - 9 * DAY}`))
    response.assertStatus(200)
    assert.lengthOf(response.body(), 10, 'the ten stored games older than day 9')
    response.assertHeader('retry-after', '120')
    assert.equal(calls.ids, 3)
  })

  test("Riot's own rate limit ends the page as quietly", async ({ client: http, assert }) => {
    world(3, 100)
    riotApiService.client.matchV5.getIdsByPuuid = (async () => {
      throw { status: 429, retryAfter: 15_000 }
    }) as unknown as typeof riotApiService.client.matchV5.getIdsByPuuid
    const response = await http.get(page(fakePuuid(), `before=${START + 1}`))
    response.assertStatus(200)
    response.assertHeader('retry-after', '15')
    assert.lengthOf(response.body(), 3)
  })

  test('filtered and offset pages read the stored games only', async ({ client: http, assert }) => {
    const calls = world(5, 100)
    const puuid = fakePuuid()
    const ranked = await http.get(page(puuid, `before=${START + 1}&type=ranked`))
    ranked.assertStatus(200)
    const offset = await http.get(page(puuid, 'offset=0'))
    assert.lengthOf(offset.body(), 5)
    assert.equal(calls.ids, 0)
  })

  test('the end of the history is a short page', async ({ client: http, assert }) => {
    world(4, 6)
    const response = await http.get(page(fakePuuid(), `before=${START + 1}`))
    response.assertStatus(200)
    assert.lengthOf(response.body(), 10)
  })
})
