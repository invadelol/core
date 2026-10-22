import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import logger from '@adonisjs/core/services/logger'

/**
 * Keeps one bad write onto `Object.prototype` from taking the whole site down.
 *
 * Twice (2026-10-21 and 22) something set `Object.prototype.summoner` to a player's slug. Every
 * object then carried the key: Knex put a `summoner` column into every update (the desktop
 * uploads failed) and Vue's SSR option merge called it ("strat is not a function"), so every page
 * answered 500 until the process restarted.
 *
 * Two guards:
 * - a write of a key known to have done it ([`TRAPPED`]) onto `Object.prototype` is refused and
 *   logged with its stack, which names the code that does it;
 * - after every request, any other key found on `Object.prototype` is removed and logged with
 *   the request, so the next requests are served normally whatever the key.
 */
const TRAPPED = ['summoner']

for (const key of TRAPPED) {
  Object.defineProperty(Object.prototype, key, {
    configurable: true,
    // Not enumerable: `for…in` (lodash's keysIn in Knex, Vue's option merge) never sees it.
    enumerable: false,
    get() {
      return undefined
    },
    set(this: object, value: unknown) {
      if (this === Object.prototype) {
        logger.fatal(
          {
            key,
            value: String(value).slice(0, 80),
            stack: new Error('Object.prototype write').stack,
          },
          'refused a write onto Object.prototype'
        )
        return
      }
      // Any other object gets the plain own property an assignment would have made.
      Object.defineProperty(this, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      })
    },
  })
}

/** The enumerable keys `Object.prototype` gained: none on a healthy process. */
function pollution(): string[] {
  const keys: string[] = []
  for (const key in {}) keys.push(key)
  return keys
}

function clean(keys: string[]) {
  for (const key of keys) delete (Object.prototype as Record<string, unknown>)[key]
}

export default class PrototypeGuardMiddleware {
  async handle({ request }: HttpContext, next: NextFn) {
    const before = pollution()
    if (before.length) {
      // Written outside a request (a job, a timer): removed before this one runs.
      clean(before)
      logger.fatal({ keys: before }, 'removed keys written onto Object.prototype outside a request')
    }
    try {
      await next()
    } finally {
      const after = pollution()
      if (after.length) {
        clean(after)
        logger.fatal(
          { keys: after, method: request.method(), url: request.url() },
          'removed keys written onto Object.prototype during a request'
        )
      }
    }
  }
}
