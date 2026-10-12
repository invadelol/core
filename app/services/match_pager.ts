import redis from '@adonisjs/redis/services/main'
import logger from '@adonisjs/core/services/logger'
import { PAGE_BURST, PAGE_EVERY_MS } from '@invadelol/ui/logic'

/** A pace: `burst` pages right away, then one every `everyMs`. */
export interface Pace {
  burst: number
  everyMs: number
}

/**
 * How fast pages of older games may be asked from Riot (a match-v5 ids page, then each game it
 * names): one player's from one address at the profiles' own rule (@invadelol/ui `logic/pager`:
 * three pages right away, then one every two minutes), and every player's from one address at a
 * few profiles' worth, so nobody drains the Riot key by scrolling. Pages already stored cost
 * nothing and are never counted.
 */
export const OLDER_PAGES = {
  player: { burst: PAGE_BURST, everyMs: PAGE_EVERY_MS },
  address: { burst: 4 * PAGE_BURST, everyMs: PAGE_EVERY_MS / 4 },
} satisfies Record<string, Pace>

/** The subset of Redis the pager needs, so tests can stand in for it. */
export interface PagerStore {
  /**
   * Takes one page from every bucket, or from none: 0 when taken, else the longest wait (ms).
   */
  take(buckets: Array<Pace & { key: string }>, now: number): Promise<number>
}

/**
 * The paging rule (a GCRA) over several buckets at once, atomically: each key holds the time its
 * bucket is full again (`tat`), which moves one interval per page and may run at most `burst`
 * intervals ahead of now; it expires once the bucket is full.
 */
const TAKE = `
local now = tonumber(ARGV[1])
local wait, tats = 0, {}
for i, key in ipairs(KEYS) do
  local every, burst = tonumber(ARGV[i * 2]), tonumber(ARGV[i * 2 + 1])
  tats[i] = math.max(tonumber(redis.call('GET', key) or 0), now) + every
  wait = math.max(wait, tats[i] - now - burst * every)
end
if wait > 0 then return wait end
for i, key in ipairs(KEYS) do
  redis.call('SET', key, string.format('%d', tats[i]), 'PX', string.format('%d', tats[i] - now))
end
return 0
`

const redisStore: PagerStore = {
  async take(buckets, now) {
    const args = buckets.flatMap((b) => [b.everyMs, b.burst])
    const wait = await redis.eval(TAKE, buckets.length, ...buckets.map((b) => b.key), now, ...args)
    return Number(wait)
  },
}

/** Paces the older pages of the match history that need Riot, per player and address. */
export class MatchPager {
  constructor(
    public prefix = 'pages:',
    private store: PagerStore = redisStore,
    private clock: () => number = Date.now
  ) {}

  /**
   * Counts a page of `puuid`'s older games asked from `ip`. Returns 0 when it may go to Riot,
   * else the seconds to wait (what a 429 sends as `Retry-After`); nothing is counted then.
   */
  async take(puuid: string, ip: string): Promise<number> {
    try {
      const wait = await this.store.take(
        [
          { key: `${this.prefix}player:${puuid}:${ip}`, ...OLDER_PAGES.player },
          { key: `${this.prefix}ip:${ip}`, ...OLDER_PAGES.address },
        ],
        this.clock()
      )
      return wait > 0 ? Math.ceil(wait / 1000) : 0
    } catch (error) {
      // Redis is down: Riot's own limiter still stands behind these pages.
      logger.warn({ err: error }, 'match pager unavailable, allowing page')
      return 0
    }
  }
}

export default new MatchPager()
