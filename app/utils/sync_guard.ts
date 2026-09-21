import { ByteCache } from '#utils/byte_cache'
import { RiotUpstreamException } from '#utils/riot_errors'

/** Coalesce concurrent refreshes and respect exhausted retry windows per player. */
export class SyncGuard {
  private inFlight = new Map<string, Promise<unknown>>()
  private cooldown = new ByteCache<number>(1024, 1024)

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const until = this.cooldown.get(key)
    if (until && until > Date.now()) {
      throw new RiotUpstreamException(
        'Riot is rate limiting requests, try again in a moment',
        'E_RIOT_RATE_LIMITED',
        429,
        Math.ceil((until - Date.now()) / 1000)
      )
    }
    const existing = this.inFlight.get(key)
    if (existing) return existing as Promise<T>
    const pending = Promise.resolve()
      .then(task)
      .catch((error) => {
        if (error instanceof RiotUpstreamException && error.upstreamStatus === 429) {
          const ttl = (error.retryAfter ?? 60) * 1000
          this.cooldown.set(key, Date.now() + ttl, 1, ttl)
        }
        throw error
      })
      .finally(() => this.inFlight.delete(key))
    this.inFlight.set(key, pending)
    return pending
  }
}
