import redis from '@adonisjs/redis/services/main'
import { brotliCompress, brotliDecompress, constants } from 'node:zlib'
import { promisify } from 'node:util'
import { CACHE_TTL_SECONDS } from '#config/constants'
import memoryCache, { RESPONSE_CACHE_CHANNEL } from '#services/response_memory_cache'

const compress = promisify(brotliCompress)
export const decompressResponse = promisify(brotliDecompress)

/** Store the wire representation: cache hits need no JSON parsing or serialization. */
export function compressResponse(body: unknown) {
  return compress(Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)), {
    params: { [constants.BROTLI_PARAM_QUALITY]: 4 },
  })
}

export function responseCacheKey(url: string) {
  const parsed = new URL(url, 'http://localhost')
  parsed.searchParams.sort()
  return `http_cache:v2:${parsed.pathname}${parsed.search}`
}

export function responseCacheResource(url: string) {
  const puuid = url.match(/^\/api\/summoners\/puuid\/([a-zA-Z0-9_-]+)\//)?.[1]
  if (puuid) return `summoner:${puuid}`
  const matchId = url.match(/^\/api\/matches\/([A-Z0-9]+_[0-9]+)(?:\?|$)/)?.[1]
  return matchId ? `match:${matchId}` : null
}

// Compare and publish atomically. A query started before an invalidation must
// never repopulate Redis with an old snapshot after the update completes.
export const SAVE_RESPONSE_SCRIPT = `
  if (redis.call('GET', KEYS[2]) or '0') ~= ARGV[1] then return 0 end
  redis.call('SETEX', KEYS[1], ARGV[2], ARGV[3])
  redis.call('SADD', KEYS[3], KEYS[1])
  redis.call('EXPIRE', KEYS[3], ARGV[2])
  return 1
`

export const INVALIDATE_RESPONSE_SCRIPT = `
  redis.call('INCR', KEYS[1])
  redis.call('EXPIRE', KEYS[1], ARGV[1])
  local keys = redis.call('SMEMBERS', KEYS[2])
  for _, key in ipairs(keys) do redis.call('DEL', key) end
  redis.call('DEL', KEYS[2])
  return #keys
`

export async function invalidateResponseCache(resources: string[]) {
  if (!resources.length) return
  const unique = new Set(resources)

  // Drop this process's copies first. Waiting for our own broadcast to come
  // back would leave a window where we serve what we just invalidated.
  for (const resource of unique) memoryCache.dropResource(resource)

  const pipeline = redis.pipeline()
  for (const resource of unique) {
    pipeline.eval(
      INVALIDATE_RESPONSE_SCRIPT,
      2,
      `${resource}:cache_generation`,
      `${resource}:cache_keys`,
      CACHE_TTL_SECONDS * 2
    )
    // Tells every other process to do the same.
    pipeline.publish(RESPONSE_CACHE_CHANNEL, resource)
  }
  const results = await pipeline.exec()
  const error = results?.find(([err]) => err)?.[0]
  if (error) throw error
}

export async function saveResponseCache(
  key: string,
  resource: string,
  generation: string,
  body: Buffer
) {
  return redis.eval(
    SAVE_RESPONSE_SCRIPT,
    3,
    key,
    `${resource}:cache_generation`,
    `${resource}:cache_keys`,
    generation,
    CACHE_TTL_SECONDS,
    body
  )
}
