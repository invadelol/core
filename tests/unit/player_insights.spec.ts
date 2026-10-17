import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import cache from '@adonisjs/cache/services/main'
import clickhouse from 'adonisjs-clickhouse/services/main'
import { DateTime } from 'luxon'
import Summoner from '#models/summoner'
import PlayerMastery from '#models/player_mastery'
import PlayerInsightsController from '#controllers/player_insights_controller'
import Rank from '#models/rank'
import riotApiService from '#services/riot/api'

let puuid = 'P'.repeat(78)
let responseId = 0
const context = {
  get params() {
    return { puuid }
  },
  request: { validateUsing: async () => ({ puuid }), qs: () => ({}) },
  response: { ok: (value: unknown) => value, header: () => {} },
} as unknown as HttpContext

async function withResponse(
  status: number,
  body: unknown,
  run: (controller: PlayerInsightsController, urls: string[]) => Promise<void>
) {
  puuid = String(++responseId).padStart(78, 'P')
  const fetch = globalThis.fetch
  const find = Summoner.findBy
  const getOrSet = cache.getOrSet
  const rankQuery = Rank.query
  const execute = riotApiService.client.riotRateLimiter.execute
  const qs = context.request.qs
  const urls: string[] = []
  Summoner.findBy = (async () => ({ platform: 'EUW1' })) as unknown as typeof Summoner.findBy
  cache.getOrSet = (async (options: { factory: () => Promise<unknown> }) =>
    options.factory()) as unknown as typeof cache.getOrSet
  const query = {
    whereIn: () => query,
    where: () => query,
    distinctOn: () => query,
    orderBy: () => query,
    catch: async () => [],
  }
  Rank.query = (() => query) as unknown as typeof Rank.query
  riotApiService.client.riotRateLimiter.execute = async () => []
  globalThis.fetch = (async (url: string) => {
    urls.push(url)
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '19' },
    })
  }) as typeof globalThis.fetch
  try {
    await run(new PlayerInsightsController(), urls)
  } finally {
    globalThis.fetch = fetch
    Summoner.findBy = find
    cache.getOrSet = getOrSet
    Rank.query = rankQuery
    riotApiService.client.riotRateLimiter.execute = execute
    context.request.qs = qs
  }
}

test.group('Player insights', () => {
  test('the first live response includes ranks for all ten players, skipping bots and duplicate IDs', async ({
    assert,
  }) => {
    const ids = Array.from({ length: 10 }, (_, i) => `live-first-${i}`.padEnd(78, 'p'))
    await withResponse(
      200,
      {
        gameId: 900,
        mapId: 12,
        participants: [
          ...ids.map((id, i) => ({ puuid: id, championId: 45, teamId: i < 5 ? 100 : 200 })),
          { puuid: ids[0], championId: 12, teamId: 100 },
          { puuid: 'bot'.padEnd(78, 'p'), championId: 12, teamId: 200, bot: true },
          { championId: 12, teamId: 200 },
        ],
      },
      async (controller) => {
        const calls: string[] = []
        riotApiService.client.riotRateLimiter.execute = async (request) => {
          calls.push(request.url)
          return [
            {
              queueType: 'RANKED_SOLO_5x5',
              tier: 'DIAMOND',
              rank: 'IV',
              leaguePoints: 60,
              wins: 20,
              losses: 10,
            },
          ]
        }
        const result = (await controller.live(context)) as any
        assert.lengthOf(calls, 10)
        assert.isTrue(
          ids.every((id) => calls.some((url) => url.endsWith(`/league/v4/entries/by-puuid/${id}`)))
        )
        assert.isTrue(
          result.game.participants
            .filter((p: any) => ids.includes(p.puuid))
            .every((p: any) => p.rank.tier === 'DIAMOND' && p.rankStatus === 'ranked')
        )
        assert.isNull(result.game.participants.find((p: any) => p.bot).rank)
      }
    )
  })

  test('manual Live refresh bypasses both the game cache and the ranks cache', async ({
    assert,
  }) => {
    const id = 'live-manual'.padEnd(78, 'p')
    await withResponse(
      200,
      { gameId: 901, participants: [{ puuid: id, championId: 45, teamId: 100 }] },
      async (controller, urls) => {
        let calls = 0
        const modes: boolean[] = []
        riotApiService.client.riotRateLimiter.execute = async () => [
          {
            queueType: 'RANKED_SOLO_5x5',
            tier: 'GOLD',
            rank: 'I',
            leaguePoints: ++calls,
            wins: 20,
            losses: 10,
          },
        ]
        cache.getOrSet = (async (options: {
          factory: () => Promise<unknown>
          forceFresh?: boolean
        }) => {
          modes.push(Boolean(options.forceFresh))
          return options.factory()
        }) as unknown as typeof cache.getOrSet
        const first = (await controller.live(context)) as any
        assert.equal(first.game.participants[0].rank.leaguePoints, 1)
        await controller.live(context)
        assert.equal(calls, 1, 'a background poll reuses a recent rank')
        context.request.qs = () => ({ refresh: '1' })
        const refreshed = (await controller.live(context)) as any
        assert.equal(refreshed.game.participants[0].rank.leaguePoints, 2)
        assert.deepEqual(modes, [false, false, true])
        assert.lengthOf(urls, 3)
      }
    )
  })

  test('unranked and unavailable participants remain distinct and a failed rank keeps the lobby visible', async ({
    assert,
  }) => {
    const ids = ['live-unranked', 'live-unavailable', 'live-ranked'].map((id) => id.padEnd(78, 'p'))
    await withResponse(
      200,
      {
        gameId: 902,
        mapId: 12,
        participants: ids.map((id) => ({ puuid: id, championId: 45, teamId: 100 })),
      },
      async (controller) => {
        riotApiService.client.riotRateLimiter.execute = async (request) => {
          if (request.url.endsWith(ids[0])) return []
          if (request.url.endsWith(ids[1])) throw { status: 500 }
          return [
            {
              queueType: 'RANKED_SOLO_5x5',
              tier: 'SILVER',
              rank: 'II',
              leaguePoints: 10,
              wins: 20,
              losses: 10,
            },
          ]
        }
        const result = (await controller.live(context)) as any
        assert.deepEqual(
          result.game.participants.map((p: any) => p.rankStatus),
          ['unranked', 'unavailable', 'ranked']
        )
        assert.isNull(result.game.participants[0].rank)
        assert.isNull(result.game.participants[1].rank)
        assert.equal(result.game.participants[2].rank.tier, 'SILVER')
      }
    )
  })

  test('a confirmed unranked answer overrides stored ranks, while a failed lookup keeps them', async ({
    assert,
  }) => {
    const ids = ['live-now-unranked', 'live-stored-fallback'].map((id) => id.padEnd(78, 'p'))
    await withResponse(
      200,
      {
        gameId: 903,
        mapId: 12,
        participants: ids.map((id) => ({ puuid: id, championId: 45, teamId: 100 })),
      },
      async (controller) => {
        const stored = ids.map((id) => ({
          puuid: id,
          tier: 'GOLD',
          division: 'III',
          leaguePoints: 40,
          wins: 20,
          losses: 10,
        }))
        const query = {
          whereIn: () => query,
          where: () => query,
          distinctOn: () => query,
          orderBy: () => query,
          catch: async () => stored,
        }
        Rank.query = (() => query) as unknown as typeof Rank.query
        riotApiService.client.riotRateLimiter.execute = async (request) => {
          if (request.url.endsWith(ids[0])) return []
          throw { status: 500 }
        }
        const result = (await controller.live(context)) as any
        assert.isNull(result.game.participants[0].rank)
        assert.equal(result.game.participants[0].rankStatus, 'unranked')
        assert.equal(result.game.participants[1].rank.tier, 'GOLD')
        assert.equal(result.game.participants[1].rankStatus, 'unavailable')
      }
    )
  })

  test('backs off repeated mastery reads using Riot Retry-After', async ({ assert }) => {
    await withResponse(429, {}, async (controller, urls) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const [result] = await Promise.allSettled([controller.mastery(context)])
        assert.equal(result.status, 'rejected')
        if (result.status === 'rejected') {
          assert.equal(result.reason.code, 'E_RIOT_RATE_LIMITED')
          assert.equal(result.reason.retryAfter, 19)
        }
      }
      assert.equal(urls.length, 1)
    })
  })

  test('only a spectator 404 means the player is between games', async ({ assert }) => {
    await withResponse(404, {}, async (controller, urls) => {
      assert.deepEqual(await controller.live(context), { game: null })
      assert.equal(
        urls[0],
        `https://euw1.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`
      )
    })
    for (const status of [403, 429, 500]) {
      await withResponse(status, {}, async (controller) => {
        await assert.rejects(() => controller.live(context))
      })
    }
  })

  test('uses PUUID mastery and only returns fields needed by the collection', async ({
    assert,
  }) => {
    await withResponse(
      200,
      [
        {
          championId: 45,
          championLevel: 10,
          championPoints: 79000,
          lastPlayTime: 123,
          championPointsUntilNextLevel: 0,
          tokensEarned: 0,
          puuid,
        },
      ],
      async (controller, urls) => {
        const result = (await controller.mastery(context)) as unknown as Array<
          Record<string, unknown>
        >
        assert.equal(result[0].championId, 45)
        assert.equal(result[0].championPoints, 79000)
        assert.notProperty(result[0], 'puuid')
        assert.include(urls[0], `champion-masteries/by-puuid/${puuid}`)
      }
    )
  })

  test('serves the stored snapshot when Riot cannot answer for mastery', async ({ assert }) => {
    const find = PlayerMastery.find
    const observedAt = DateTime.fromMillis(1_790_000_000_000)
    PlayerMastery.find = (async () => ({
      source: 'desktop',
      observedAt,
      entries: [
        { championId: 12, championLevel: 6, championPoints: 9800, lastPlayTime: 1 },
        { championId: 45, championLevel: 31, championPoints: 254000, lastPlayTime: 2 },
      ],
    })) as unknown as typeof PlayerMastery.find
    try {
      await withResponse(503, {}, async (controller) => {
        const result = (await controller.mastery(context)) as unknown as Array<
          Record<string, unknown>
        >
        assert.deepEqual(
          result.map((entry) => entry.championId),
          [45, 12]
        )
        assert.equal(result[0].source, 'desktop')
        assert.equal(result[0].observedAt, observedAt.toMillis())
      })
    } finally {
      PlayerMastery.find = find
    }
  })

  test('reads the stored games of a whole lobby in one query', async ({ assert }) => {
    const [first, second] = ['A', 'B'].map((letter) => letter.repeat(78))
    const query = clickhouse.query
    const sql: string[] = []
    clickhouse.query = (async (options: { query: string }) => {
      sql.push(options.query)
      return {
        json: async () => [
          [first, '45', 'MIDDLE', 1],
          [first, '45', 'MIDDLE', 0],
          [first, '12', 'UTILITY', 1],
        ],
      }
    }) as unknown as typeof clickhouse.query
    try {
      await withResponse(
        200,
        {
          gameId: 1,
          participants: [
            { puuid: first, championId: 45, teamId: 100 },
            { puuid: second, championId: 12, teamId: 200 },
            { championId: 99, teamId: 200 },
          ],
        },
        async (controller) => {
          const result = (await controller.live(context)) as unknown as {
            game: Record<string, any>
          }
          assert.deepEqual(
            result.game.participants.map((p: { championStats: unknown }) => p.championStats),
            [{ games: 2, winrate: 0.5 }, null, null]
          )
          assert.deepEqual(result.game.participants[0].recent, { games: 3, wins: 2 })
        }
      )
      assert.lengthOf(sql, 1)
      assert.include(sql[0], `'${first}'`)
      assert.include(sql[0], `'${second}'`)
      assert.include(sql[0], 'LIMIT 100 BY puuid')
    } finally {
      clickhouse.query = query
    }
  })

  test('preserves hidden live identities and excludes observer credentials', async ({ assert }) => {
    await withResponse(
      200,
      {
        gameId: 123,
        gameStartTime: 100,
        gameLength: 40,
        gameQueueConfigId: 420,
        bannedChampions: [],
        observers: { encryptionKey: 'private-observer-value' },
        participants: [
          {
            championId: 45,
            teamId: 100,
            spell1Id: 4,
            spell2Id: 12,
            perks: { perkIds: [8005], perkStyle: 8000, perkSubStyle: 8100 },
          },
        ],
      },
      async (controller) => {
        const result = (await controller.live(context)) as unknown as { game: Record<string, any> }
        assert.equal(result.game.participants[0].championId, 45)
        assert.isUndefined(result.game.participants[0].riotId)
        assert.isNull(result.game.participants[0].championStats)
        assert.notProperty(result.game, 'observers')
        assert.notInclude(JSON.stringify(result), 'private-observer-value')
      }
    )
  })
})
