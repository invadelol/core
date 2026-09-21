import { test } from '@japa/runner'
import { EncodedPayloadCache } from '#services/encoded_payload'

test('an empty name lookup is retried and a recovered lookup is cached', async ({ assert }) => {
  const cache = new EncodedPayloadCache(60_000)
  let calls = 0
  const build = async () => (++calls === 1 ? {} : { 1: 'Annie' })
  const cacheable = (value: unknown) => Object.keys(value as object).length > 0
  const failed = await cache.get('champion', build, cacheable)
  const recovered = await cache.get('champion', build, cacheable)
  const cached = await cache.get('champion', build, cacheable)
  assert.equal(failed.identity.toString(), '{}')
  assert.equal(recovered.identity.toString(), '{"1":"Annie"}')
  assert.strictEqual(cached, recovered)
  assert.equal(calls, 2)
})
