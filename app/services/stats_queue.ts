import logger from '@adonisjs/core/services/logger'

/**
 * Heavy statistics computed in the background, one at a time: a tier list's read of a whole
 * patch takes tens of seconds, so a visitor never waits for one. A page that finds its answer
 * missing queues it here and shows that it is being computed; the warmer queues the common
 * filters the same way, so visitors and the warmer never run two reads at once in a process.
 *
 * A key already queued or running is not queued again. Past `max` waiting jobs, new ones are
 * refused (`add` gives null) and the page says so.
 */
export class StatsQueue {
  #jobs = new Map<
    string,
    { run: () => Promise<unknown>; done: Promise<void>; resolve: () => void }
  >()
  #running: string | null = null
  #max: number

  constructor(max = 64) {
    this.#max = max
  }

  /** Jobs waiting or running. */
  get size() {
    return this.#jobs.size
  }

  /** Whether `key` is waiting or running. */
  has(key: string) {
    return this.#jobs.has(key)
  }

  /** Where `key` stands: 0 running, 1 next…; null when it is not queued. */
  position(key: string) {
    const at = [...this.#jobs.keys()].indexOf(key)
    return at < 0 ? null : at
  }

  /**
   * Queues `run` under `key` (unless it is already there): a promise that settles once it ran,
   * whether it failed or not, or null when the queue is full.
   */
  add(key: string, run: () => Promise<unknown>): Promise<void> | null {
    const queued = this.#jobs.get(key)
    if (queued) return queued.done
    if (this.#jobs.size >= this.#max) return null
    let resolve!: () => void
    const done = new Promise<void>((r) => (resolve = r))
    this.#jobs.set(key, { run, done, resolve })
    void this.#drain()
    return done
  }

  async #drain() {
    if (this.#running) return
    for (let next = this.#jobs.keys().next(); !next.done; next = this.#jobs.keys().next()) {
      const key = next.value
      const job = this.#jobs.get(key)!
      this.#running = key
      try {
        await job.run()
      } catch (error) {
        logger.warn({ err: error, key }, 'background statistics failed')
      } finally {
        this.#jobs.delete(key)
        this.#running = null
        job.resolve()
      }
    }
  }
}

/** The process's queue of heavy statistics. */
export default new StatsQueue()
