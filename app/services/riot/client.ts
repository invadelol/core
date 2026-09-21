import { randomUUID } from 'node:crypto'
import { RiotAPI } from '@fightmegg/riot-api'
import { SyncGuard } from '#utils/sync_guard'
import { translateRiotError } from '#utils/riot_errors'

/** Share identical reads before they enter the SDK's Bottleneck queues. */
export class CoalescingRiotAPI extends RiotAPI {
  private requests = new SyncGuard()

  override request<T>(...args: Parameters<RiotAPI['request']>): Promise<T> {
    const [platform, method, path, options] = args
    const request = () =>
      super.request<T>(platform, method, path, { ...options, id: randomUUID() }).catch((error) => {
        throw translateRiotError(error)
      })

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
