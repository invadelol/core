import { createHmac } from 'node:crypto'
import { isIPv4, isIPv6 } from 'node:net'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import { currentMeter, metered, type RiotMeter } from '#services/riot/client'
import { TooManyRequestsException } from '#exceptions/too_many_requests_exception'
import { SlidingWindowLimiter, type Window } from '#services/quota/sliding_window'

/** `limit` in any `seconds`, sliding. */
export interface Rule {
  limit: number
  seconds: number
}

/**
 * What a client may make invade.lol ask of Riot. Only what really reaches Riot is counted: a
 * stored profile, a cached mastery or a kept live check costs nothing and is never refused.
 *
 * - `calls`: the Riot requests one address caused, whatever asked for them (a new player's
 *   Update is about forty, a mastery read one). The real cost of the key; past it, nothing more
 *   from that address reaches Riot until the window slides.
 * - per route, the requests of one address that reached Riot, and for a named player, the ones
 *   about that player from everyone (a script spreading over many addresses still meets them).
 *
 * Sized for people: a lobby of ten looked up and updated in a multi search fits in one window,
 * with room for a few profiles after it.
 */
export const RIOT_QUOTAS = {
  calls: [
    { limit: 300, seconds: 600 },
    { limit: 1200, seconds: 3600 },
  ],
  routes: {
    /** The Update button: the profile, the multi search, the desktop app. */
    sync: {
      address: [
        { limit: 15, seconds: 600 },
        { limit: 60, seconds: 3600 },
      ],
      player: [{ limit: 20, seconds: 3600 }],
    },
    /** A Riot ID invade.lol does not store yet. */
    lookup: {
      address: [
        { limit: 30, seconds: 600 },
        { limit: 120, seconds: 3600 },
      ],
      player: [{ limit: 3, seconds: 600 }],
    },
    /** champion-mastery-v4, once its hour of cache is over. */
    mastery: {
      address: [
        { limit: 30, seconds: 600 },
        { limit: 150, seconds: 3600 },
      ],
      player: [],
    },
    /** spectator-v5, once the kept answer is old enough. */
    live: { address: [{ limit: 30, seconds: 600 }], player: [] },
    /** A stored game's missing timeline, fetched once someone opens it. */
    timeline: { address: [{ limit: 20, seconds: 600 }], player: [] },
  },
} satisfies {
  calls: Rule[]
  routes: Record<string, { address: Rule[]; player: Rule[] }>
}

export type QuotaKind = keyof typeof RIOT_QUOTAS.routes

/** A player whose sync worked this recently is answered from what is stored. */
export const SYNCED_MS = 60_000

const PREFIX = 'quota:'

/**
 * The address a quota counts: an IPv4 address as is, an IPv6 one by its /64 (one home or phone
 * holds a whole /64 and can change address within it at will). A client that already hung up
 * has no address left; it is counted apart, nobody is waiting for its answer anyway.
 */
export function quotaAddress(ip: string | null | undefined): string {
  if (typeof ip !== 'string' || !ip) return 'gone'
  const address = ip.startsWith('::ffff:') && isIPv4(ip.slice(7)) ? ip.slice(7) : ip
  if (!isIPv6(address)) return address
  const [head, tail = ''] = address.split('%')[0].split('::')
  const left = head ? head.split(':') : []
  const right = address.includes('::') && tail ? tail.split(':') : []
  // An embedded IPv4 tail takes two groups; only the first four groups matter here.
  const groups = [
    ...left,
    ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'),
    ...right,
  ]
  return `${groups
    .slice(0, 4)
    .map((g) => Number.parseInt(g || '0', 16).toString(16))
    .join(':')}::/64`
}

/** What one HTTP request makes invade.lol ask of Riot: admitted once, counted as it goes. */
class QuotaMeter implements RiotMeter {
  calls = 0
  closed = false
  player: string | null = null
  private admission: Promise<void> | null = null

  constructor(
    private quota: RiotQuota,
    readonly address: string,
    readonly kind: QuotaKind | null
  ) {}

  gate() {
    // Work left behind after the answer went out (a timer) is no longer this client's.
    if (this.closed || !this.kind) return null
    this.admission ??= this.quota.admit(this)
    return this.admission
  }

  sent() {
    if (!this.closed) this.calls++
  }
}

/**
 * The quotas on everything that makes invade.lol ask Riot (`RIOT_QUOTAS`), in Redis sliding
 * windows. A route runs its handling in `run` (the `riotQuota` middleware); the first request
 * it makes to Riot is admitted or refused there (`TooManyRequestsException`, a 429 with
 * `Retry-After`), and once it answered, the Riot requests it really made are added to its
 * address's `calls`.
 */
export class RiotQuota {
  private refused = new Map<string, number>()
  private flush: NodeJS.Timeout | null = null

  constructor(
    private limiter = new SlidingWindowLimiter(),
    private secret = env.get('APP_KEY')
  ) {}

  /** Keys never hold an address or a Riot ID in clear. */
  private id(value: string) {
    return createHmac('sha256', this.secret).update(value).digest('base64url').slice(0, 22)
  }

  /** Runs one request's handling, `kind` saying which route quota its Riot requests take. */
  async run<T>(
    ip: string | null | undefined,
    kind: QuotaKind | null,
    task: () => Promise<T>
  ): Promise<T> {
    const meter = new QuotaMeter(this, this.id(quotaAddress(ip)), kind)
    try {
      return await metered(meter, task)
    } finally {
      meter.closed = true
      if (meter.calls) await this.charge(meter.address, meter.calls)
    }
  }

  /**
   * The player this request is about (`Name#TAG`, any case), so its Riot requests also take from
   * that player's quota. Called before the first one; does nothing outside `run`.
   */
  target(player: string) {
    const meter = currentMeter()
    if (meter instanceof QuotaMeter) meter.player = this.id(player.toLowerCase())
  }

  /** Whether `player`'s sync worked less than `SYNCED_MS` ago (`synced`). */
  async recentlySynced(player: string): Promise<boolean> {
    const result = await this.limiter.take([this.syncedWindow(player, 1, 0)])
    return result.waitMs > 0
  }

  /** Remembers that `player`'s sync just worked. */
  async synced(player: string) {
    await this.limiter.take([this.syncedWindow(player, 0, 1)])
  }

  private syncedWindow(player: string, need: number, add: number): Window {
    const key = `${PREFIX}synced:${this.id(player.toLowerCase())}`
    return { key, windowMs: SYNCED_MS, limit: 1, need, add }
  }

  /** The first Riot request of `meter`'s request: counted, or refused with a 429. */
  async admit(meter: QuotaMeter): Promise<void> {
    const kind = meter.kind!
    const rules = RIOT_QUOTAS.routes[kind]
    const windows: Window[] = []
    const scopes: Array<'address' | 'player'> = []
    const push = (window: Window, scope: 'address' | 'player') => {
      windows.push(window)
      scopes.push(scope)
    }
    // Room left in the address's Riot calls; they are counted once known (`charge`).
    for (const rule of RIOT_QUOTAS.calls)
      push(this.window('calls', meter.address, rule, 1, 0), 'address')
    for (const rule of rules.address) push(this.window(kind, meter.address, rule, 1, 1), 'address')
    if (meter.player) {
      for (const rule of rules.player)
        push(this.window(`${kind}:player`, meter.player, rule, 1, 1), 'player')
    }
    const { waitMs, blocked } = await this.limiter.take(windows)
    if (!waitMs) return
    const scope = scopes[blocked] ?? 'address'
    this.count(`${kind}:${scope}`)
    throw new TooManyRequestsException(Math.max(1, Math.ceil(waitMs / 1000)), scope)
  }

  /** Adds `calls` Riot requests to the address's windows, whatever room they had. */
  private async charge(address: string, calls: number) {
    await this.limiter.take(
      RIOT_QUOTAS.calls.map((rule) => this.window('calls', address, rule, 0, calls))
    )
  }

  private window(name: string, id: string, rule: Rule, need: number, add: number): Window {
    return {
      key: `${PREFIX}${name}:${rule.seconds}:${id}`,
      windowMs: rule.seconds * 1000,
      limit: rule.limit,
      need,
      add,
    }
  }

  /** Refusals are logged once a minute, summed per route and scope: a bot wave is one line. */
  private count(label: string) {
    this.refused.set(label, (this.refused.get(label) ?? 0) + 1)
    this.flush ??= setTimeout(() => {
      logger.warn({ refused: Object.fromEntries(this.refused) }, 'riot quota refused requests')
      this.refused.clear()
      this.flush = null
    }, 60_000).unref()
  }
}

export default new RiotQuota()
