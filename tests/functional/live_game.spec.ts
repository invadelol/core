import { test } from '@japa/runner'
import { randomBytes } from 'node:crypto'
import redis from '@adonisjs/redis/services/main'
import riotApiService from '#services/riot/api'
import { CoalescingRiotAPI } from '#services/riot/client'
import { RIOT_QUOTAS } from '#services/quota/riot_quota'
import Summoner from '#models/summoner'

/** A Riot API puuid's shape (78 base64url characters), never a real one. */
const fakePuuid = () => randomBytes(64).toString('base64url').slice(0, 78)

/** A Summoner's Rift game of ten made-up players, Riot's own fields included. */
function spectatorGame(players: string[]) {
  return {
    gameId: 7,
    gameStartTime: Date.now() - 600_000,
    gameLength: 600,
    gameQueueConfigId: 420,
    mapId: 11,
    gameMode: 'CLASSIC',
    observers: { encryptionKey: 'secret' },
    bannedChampions: [{ championId: 157, teamId: 100, pickTurn: 1 }],
    participants: players.map((puuid, i) => ({
      puuid,
      riotId: `Test ${i}#TEST`,
      championId: [266, 64, 103, 222, 412][i % 5],
      teamId: i < 5 ? 100 : 200,
      spell1Id: i % 5 === 1 ? 11 : 4,
      spell2Id: [12, 4, 14, 7, 3][i % 5],
      bot: false,
      perks: { perkIds: [8010], perkStyle: 8000, perkSubStyle: 8400 },
    })),
  }
}

/** Riot as the live check sees it: the spectator answer and the league reads, counted. */
function riot(game: ReturnType<typeof spectatorGame> | null) {
  const calls = { spectator: 0, league: 0 }
  riotApiService.client = {
    spectator: {
      getBySummonerId: async () => {
        calls.spectator++
        if (!game) throw { status: 404 }
        return game
      },
    },
    league: {
      getEntriesByPUUID: async () => {
        calls.league++
        return [
          {
            queueType: 'RANKED_SOLO_5x5',
            tier: 'GOLD',
            rank: 'II',
            leaguePoints: 40,
            wins: 10,
            losses: 9,
          },
        ]
      },
    },
  } as unknown as typeof riotApiService.client
  return calls
}

test.group('Live game', (group) => {
  const client = riotApiService.client
  const findBy = Summoner.findBy
  const stored = new Set<string>()
  group.each.setup(async () => {
    stored.clear()
    Summoner.findBy = (async (_key: string, puuid: string) =>
      stored.has(puuid) ? { puuid, platform: 'EUW1' } : null) as unknown as typeof Summoner.findBy
    const keys = await redis.keys('quota:*')
    if (keys.length) await redis.del(...keys)
  })
  group.each.teardown(() => {
    riotApiService.client = client
    Summoner.findBy = findBy
  })

  const live = (puuid: string, again = false) =>
    `/api/summoners/puuid/${puuid}/live${again ? '?again=1' : ''}`

  test('a player Invade does not know is never looked up', async ({ client: http, assert }) => {
    const calls = riot(null)
    const response = await http.get(live(fakePuuid()))
    response.assertStatus(404)
    assert.equal(calls.spectator, 0)
  })

  test('between games, one request answers every visitor for a while', async ({
    client: http,
    assert,
  }) => {
    const calls = riot(null)
    const puuid = fakePuuid()
    stored.add(puuid)
    const first = await http.get(live(puuid))
    first.assertStatus(200)
    assert.isNull(first.body().game)
    assert.isNumber(first.body().checkedAt)
    first.assertHeader('cache-control', 'no-store')
    // Opened again, and checked again at once: the kept answer, no new request.
    await http.get(live(puuid))
    await http.get(live(puuid, true))
    assert.equal(calls.spectator, 1)
  })

  test('in a game, both teams are seated with their ranks, and Riot’s own fields stay out', async ({
    client: http,
    assert,
  }) => {
    const players = Array.from({ length: 10 }, fakePuuid)
    const calls = riot(spectatorGame(players))
    stored.add(players[0])
    const response = await http.get(live(players[0]))
    response.assertStatus(200)
    const { game } = response.body()
    assert.equal(game.gameQueueConfigId, 420)
    assert.lengthOf(game.participants, 10)
    assert.deepEqual(
      game.participants.slice(0, 5).map((p: any) => p.position),
      ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT']
    )
    assert.equal(game.participants[0].rank.tier, 'GOLD')
    assert.equal(calls.league, 10)
    assert.notInclude(JSON.stringify(response.body()), 'secret')
  })

  test('an address asking Riot too often is refused until the window ends', async ({
    client: http,
    assert,
  }) => {
    // The application's own client (the quota sits in front of its queue), Riot saying "no game".
    const api = new CoalescingRiotAPI('RGAPI-00000000-0000-0000-0000-000000000000')
    let spectator = 0
    ;(api as any).riotRateLimiter.execute = async () => {
      spectator++
      throw { status: 404 }
    }
    riotApiService.client = api
    const { limit } = RIOT_QUOTAS.routes.live.address[0]
    let last = 200
    for (let i = 0; i <= limit; i++) {
      const puuid = fakePuuid()
      stored.add(puuid)
      last = (await http.get(live(puuid))).status()
    }
    assert.equal(last, 429)
    assert.equal(spectator, limit)
  })
})
