import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import cache from '@adonisjs/cache/services/main'
import Summoner from '#models/summoner'
import PlayerInsightsController from '#controllers/player_insights_controller'

const puuid = 'P'.repeat(78)
const context = {
  params: { puuid },
  request: { validateUsing: async () => ({ puuid }) },
  response: { ok: (value: unknown) => value, header: () => {} },
} as unknown as HttpContext

async function withResponse(
  status: number,
  body: unknown,
  run: (controller: PlayerInsightsController, urls: string[]) => Promise<void>
) {
  const fetch = globalThis.fetch
  const find = Summoner.findBy
  const getOrSet = cache.getOrSet
  const urls: string[] = []
  Summoner.findBy = (async () => ({ platform: 'EUW1' })) as unknown as typeof Summoner.findBy
  cache.getOrSet = (async (options: { factory: () => Promise<unknown> }) =>
    options.factory()) as unknown as typeof cache.getOrSet
  globalThis.fetch = (async (url: string) => {
    urls.push(url)
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof globalThis.fetch
  try {
    await run(new PlayerInsightsController(), urls)
  } finally {
    globalThis.fetch = fetch
    Summoner.findBy = find
    cache.getOrSet = getOrSet
  }
}

test.group('Player insights', () => {
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
