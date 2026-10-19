import { randomUUID } from 'node:crypto'
import { RiotAPI } from '@fightmegg/riot-api'
import { SyncGuard } from '#utils/sync_guard'
import { RiotUpstreamException, translateRiotError } from '#utils/riot_errors'

/**
 * Riot requests one method may have waiting in this process (queued in the SDK, or holding a
 * slot while it waits out a 429). Past it a new one is refused at once, as Riot itself would:
 * the SDK queues without bound, and while the key is spent faster than it refills every queued
 * request, and everything waiting on its answer, stays in memory until the process runs out.
 */
export const MAX_PENDING_PER_METHOD = 100

/** What a refused request tells its caller to wait, in seconds: about one window of the key. */
const BACKLOG_RETRY_AFTER = 60

/** Share identical reads before they enter the SDK's Bottleneck queues, and bound those queues. */
export class CoalescingRiotAPI extends RiotAPI {
  private requests = new SyncGuard()
  private pending = new Map<string, number>()

  /** Requests of one method (`europe:MATCH_V5.GET_MATCH_BY_ID`) waiting on Riot right now. */
  waiting(platform: string, method: string) {
    return this.pending.get(`${platform}:${method}`) ?? 0
  }

  override request<T>(...args: Parameters<RiotAPI['request']>): Promise<T> {
    const [platform, method, path, options] = args
    const slot = `${platform}:${method}`
    const request = () => {
      const waiting = this.pending.get(slot) ?? 0
      if (waiting >= MAX_PENDING_PER_METHOD) {
        return Promise.reject(
          new RiotUpstreamException(
            'Riot is rate limiting requests, try again in a moment',
            'E_RIOT_RATE_LIMITED',
            429,
            BACKLOG_RETRY_AFTER
          )
        )
      }
      this.pending.set(slot, waiting + 1)
      return super
        .request<T>(platform, method, path, { ...options, id: randomUUID() })
        .catch((error) => {
          throw translateRiotError(error)
        })
        .finally(() => {
          const left = (this.pending.get(slot) ?? 1) - 1
          if (left > 0) this.pending.set(slot, left)
          else this.pending.delete(slot)
        })
    }

    // Never merge writes. The SDK's fixed job IDs also omit query parameters,
    // so distinct requests need unique IDs even when they target the same player.
    if (options?.method && options.method !== 'GET') return request()
    const key = JSON.stringify([
      platform,
      method,
      path,
      options?.params,
      options?.headers,
      options?.body,
    ])
    return this.requests.run(key, request)
  }
}
