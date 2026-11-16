import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import redis from '@adonisjs/redis/services/main'
import SummonersController from '#controllers/summoners_controller'
import summonerService from '#services/summoner_service'
import homeService from '#services/home_service'
import { VIEW_WINDOW_SECONDS, firstViewInWindow } from '#services/profile_views'

const PUUID = 'P'.repeat(78)
const ME = { ip: '203.0.113.7', userAgent: 'Mozilla/5.0 (Macintosh)' }
const YOU = { ip: '198.51.100.20', userAgent: 'Mozilla/5.0 (Windows NT 10.0)' }

/** Redis `SET … NX` over a plain map, with the arguments of every call. */
function fakeRedis() {
  const store = new Map<string, string>()
  const calls: unknown[][] = []
  const original = redis.set
  redis.set = (async (...args: unknown[]) => {
    calls.push(args)
    const key = String(args[0])
    if (store.has(key)) return null
    store.set(key, String(args[1]))
    return 'OK'
  }) as unknown as typeof redis.set
  return {
    calls,
    restore: () => {
      redis.set = original
    },
  }
}

/** The controller with the view total in memory. */
async function withProfile(
  run: (view: (visitor: typeof ME) => Promise<Record<string, unknown>>) => Promise<void>
) {
  let total = 10n
  let trending = 0
  const increment = summonerService.incrementViewCount
  const read = summonerService.getViewCount
  const record = homeService.recordView
  summonerService.incrementViewCount = async () => ++total
  summonerService.getViewCount = async () => total
  homeService.recordView = async () => void trending++
  const set: string[] = []
  const view = async (visitor: typeof ME) => {
    const context = {
      params: { puuid: PUUID },
      request: {
        validateUsing: async () => ({ puuid: PUUID }),
        ip: () => visitor.ip,
        header: (name: string) => (name === 'user-agent' ? visitor.userAgent : undefined),
      },
      response: {
        ok: (value: unknown) => value,
        notFound: (value: unknown) => value,
        cookie: (_: string, value: string) => void set.push(value),
      },
    } as unknown as HttpContext
    const result = await new SummonersController().incrementViews(context)
    return { ...(result as unknown as object), trending, cookies: set.length }
  }
  try {
    await run(view)
  } finally {
    summonerService.incrementViewCount = increment
    summonerService.getViewCount = read
    homeService.recordView = record
  }
}

test.group('Profile views', (group) => {
  let redisFake: ReturnType<typeof fakeRedis>
  group.each.setup(() => {
    redisFake = fakeRedis()
    return () => redisFake.restore()
  })

  test('a visitor counts once per profile in the window, stored only as a hash', async ({
    assert,
  }) => {
    assert.isTrue(await firstViewInWindow(ME, PUUID))
    assert.isFalse(await firstViewInWindow(ME, PUUID))
    assert.isTrue(await firstViewInWindow(YOU, PUUID))
    assert.isTrue(await firstViewInWindow(ME, 'Q'.repeat(78)))
    assert.isTrue(await firstViewInWindow({ ...ME, userAgent: 'Other' }, PUUID))
    const [key, , ex, seconds, nx] = redisFake.calls[0]
    assert.notInclude(String(key), ME.ip)
    assert.notInclude(String(key), PUUID)
    assert.deepEqual([ex, seconds, nx], ['EX', VIEW_WINDOW_SECONDS, 'NX'])
  })

  test('reloading a profile does not move its count', async ({ assert }) => {
    await withProfile(async (view) => {
      assert.deepInclude(await view(ME), { viewCount: '11', trending: 1 })
      assert.deepInclude(await view(ME), { viewCount: '11', trending: 1 })
      assert.deepInclude(await view(ME), { viewCount: '11', trending: 1 })
      assert.deepInclude(await view(YOU), { viewCount: '12', trending: 2, cookies: 0 })
    })
  })

  test('Redis down still counts the view', async ({ assert }) => {
    redis.set = (async () => {
      throw new Error('down')
    }) as unknown as typeof redis.set
    assert.isTrue(await firstViewInWindow(ME, PUUID))
  })
})
