import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import cache from '@adonisjs/cache/services/main'
import { DateTime } from 'luxon'
import Summoner from '#models/summoner'
import PlayerMastery from '#models/player_mastery'
import PlayerInsightsController from '#controllers/player_insights_controller'

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
  const qs = context.request.qs
  const urls: string[] = []
  Summoner.findBy = (async () => ({ platform: 'EUW1' })) as unknown as typeof Summoner.findBy
  cache.getOrSet = (async (options: { factory: () => Promise<unknown> }) =>
    options.factory()) as unknown as typeof cache.getOrSet
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
    context.request.qs = qs
  }
}

test.group('Player insights', () => {
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
})
