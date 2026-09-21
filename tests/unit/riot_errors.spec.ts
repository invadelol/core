import { test } from '@japa/runner'
import cache from '@adonisjs/cache/services/main'
import type { HttpContext } from '@adonisjs/core/http'
import HttpExceptionHandler from '#exceptions/handler'
import { translateRiotError, unwrapCacheFactoryError } from '#utils/riot_errors'

test.group('Cached Riot failures', () => {
  test('real cache wrapping preserves rate-limit responses and warning logs', async ({
    assert,
  }) => {
    const upstream = translateRiotError(
      new Response(null, { status: 429, headers: { 'Retry-After': '17' } })
    )
    const [result] = await Promise.allSettled([
      cache.use('memoryOnly').getOrSet({
        key: 'test:riot-rate-limit',
        factory: async () => {
          throw upstream
        },
      }),
    ])
    assert.equal(result.status, 'rejected')
    if (result.status !== 'rejected') return
    assert.equal(result.reason.code, 'E_FACTORY_ERROR')
    assert.strictEqual(unwrapCacheFactoryError(result.reason), upstream)

    const headers: Record<string, string> = {}
    let status = 0
    let body: any
    let warnings = 0
    const response = {
      header: (key: string, value: string) => {
        headers[key] = value
      },
      status: (value: number) => {
        status = value
        return response
      },
      send: (value: unknown) => {
        body = value
      },
    }
    const ctx = {
      response,
      request: { method: () => 'GET', url: () => '/mastery' },
      logger: { warn: () => warnings++ },
    } as unknown as HttpContext
    const handler = new HttpExceptionHandler()
    await handler.handle(result.reason, ctx)
    await handler.report(result.reason, ctx)
    assert.equal(status, 503)
    assert.equal(headers['Retry-After'], '17')
    assert.equal(body.errors[0].code, 'E_RIOT_RATE_LIMITED')
    assert.equal(body.retryAfter, 17)
    assert.equal(warnings, 1)
  })

  test('does not unwrap unrelated errors or loop on malformed causes', ({ assert }) => {
    const error = new Error('Local failure', { cause: new Error('Internal detail') })
    assert.strictEqual(unwrapCacheFactoryError(error), error)
    const cyclic: any = { code: 'E_FACTORY_ERROR' }
    cyclic.cause = cyclic
    assert.strictEqual(unwrapCacheFactoryError(cyclic), cyclic)
  })
})
