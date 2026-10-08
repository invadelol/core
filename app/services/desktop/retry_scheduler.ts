import logger from '@adonisjs/core/services/logger'

export type AttemptResult = 'done' | 'retry'

/**
 * In-process, best-effort retries for games Riot has not published yet
 * (docs/desktop-sync.md §4.2: "retried by core 2, 5 and 15 minutes later").
 *
 * Deliberately not a queue: a restart forgets pending retries, and that is
 * acceptable because the normal web sync picks every game up eventually.
 * Timers are unref'd so they never keep a process (or a test run) alive.
 */
export class RetryScheduler {
  private pending = new Map<string, NodeJS.Timeout>()

  /** Offsets from scheduling, in ms. */
  constructor(public offsets: number[] = [2, 5, 15].map((minutes) => minutes * 60_000)) {}

  /**
   * Runs `attempt` at each offset until it reports `done`; `giveUp` runs
   * after the last failed attempt. A key already scheduled is left alone.
   */
  schedule(
    key: string,
    attempt: (index: number) => Promise<AttemptResult>,
    giveUp?: () => Promise<void>
  ): boolean {
    if (this.pending.has(key)) return false

    const run = (index: number) => {
      const wait = this.offsets[index] - (index ? this.offsets[index - 1] : 0)
      const timer = setTimeout(
        async () => {
          let result: AttemptResult = 'retry'
          try {
            result = await attempt(index)
          } catch (error) {
            logger.warn({ err: error, key, attempt: index + 1 }, 'desktop retry failed')
          }
          if (result === 'done') return this.pending.delete(key)
          if (index + 1 < this.offsets.length) return run(index + 1)
          this.pending.delete(key)
          await giveUp?.().catch((error) =>
            logger.warn({ err: error, key }, 'desktop give-up failed')
          )
        },
        Math.max(0, wait)
      )
      timer.unref()
      this.pending.set(key, timer)
    }

    run(0)
    return true
  }

  has(key: string) {
    return this.pending.has(key)
  }

  get size() {
    return this.pending.size
  }

  clear() {
    for (const timer of this.pending.values()) clearTimeout(timer)
    this.pending.clear()
  }
}
