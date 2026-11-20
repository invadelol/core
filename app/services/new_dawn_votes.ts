import { createHmac, randomUUID } from 'node:crypto'
import redis from '@adonisjs/redis/services/main'
import logger from '@adonisjs/core/services/logger'
import { appKey } from '#config/app'
import { VOTABLE } from '../../inertia/lib/new_dawn.js'

/**
 * The New Dawn hub's rumour votes: a yes or a no, no stakes, kept in Redis (no table). Each rumour
 * is a hash of its two counts; a visitor is a random id in a first-party cookie, and the address
 * they vote from is kept only as a keyed hash, for a day. One vote per visitor and rumour, and at
 * most a few per address and rumour a day, so clearing cookies does not stuff the count.
 */

export type Choice = 'yes' | 'no'

export interface Tally {
  yes: number
  no: number
  /** The visitor's own vote, when they have one. */
  mine: Choice | null
}

export type VoteResult =
  | { outcome: 'counted'; tally: Tally }
  /** This visitor had already voted on it: their first vote stands. */
  | { outcome: 'already'; tally: Tally }
  /** Enough votes came from this address today; the counts are shown without one more. */
  | { outcome: 'address'; tally: Tally }

/** The subset of Redis the votes need, so tests can stand in for it. */
export interface VoteStore {
  counts(keys: string[]): Promise<{ yes: number; no: number }[]>
  get(keys: string[]): Promise<(string | null)[]>
  /** Sets `key` when it does not exist yet; false when it did. */
  claim(key: string, value: string, ttlSeconds: number): Promise<boolean>
  /** Counts one more against `key`, which expires `ttlSeconds` after its first count. */
  bump(key: string, ttlSeconds: number): Promise<number>
  add(key: string, field: Choice): Promise<void>
}

const redisStore: VoteStore = {
  async counts(keys) {
    if (!keys.length) return []
    const pipe = redis.pipeline()
    for (const key of keys) pipe.hmget(key, 'yes', 'no')
    const replies = (await pipe.exec()) ?? []
    return replies.map(([error, value]) => {
      if (error) throw error
      const [yes, no] = (value as (string | null)[]) ?? []
      return { yes: Number(yes ?? 0), no: Number(no ?? 0) }
    })
  },
  async get(keys) {
    return keys.length ? redis.mget(...keys) : []
  },
  async claim(key, value, ttlSeconds) {
    return (await redis.set(key, value, 'EX', ttlSeconds, 'NX')) === 'OK'
  },
  async bump(key, ttlSeconds) {
    // The key is made with its expiry on the first count only, so a busy address cannot keep it alive.
    const replies = await redis.multi().set(key, 0, 'EX', ttlSeconds, 'NX').incr(key).exec()
    const [error, count] = replies?.[1] ?? [new Error('empty Redis reply'), null]
    if (error) throw error
    return Number(count)
  },
  async add(key, field) {
    await redis.hincrby(key, field, 1)
  },
}

/** The visitor cookie's name and life (400 days, the most browsers keep a cookie). */
export const VOTER_COOKIE = 'nd_voter'
export const VOTER_DAYS = 400
/** Votes one address may add to one rumour in a day. */
export const VOTES_PER_ADDRESS = 3
const DAY = 86_400

const VOTER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** A visitor id from the cookie, when it is one this site handed out. */
export const voterId = (value: unknown) =>
  typeof value === 'string' && VOTER_ID.test(value) ? value : null
export const newVoterId = () => randomUUID()

export class NewDawnVotes {
  constructor(
    private store: VoteStore = redisStore,
    /** Keys the address hash: the app key, so the stored hash names no address. */
    private secret: () => string = () => appKey.release(),
    public prefix = 'nd:',
    private rumours: readonly string[] = VOTABLE
  ) {}

  private countKey = (rumour: string) => `${this.prefix}votes:${rumour}`
  private voterKey = (rumour: string, voter: string) => `${this.prefix}voter:${rumour}:${voter}`
  private addressKey = (rumour: string, ip: string) =>
    `${this.prefix}addr:${rumour}:${createHmac('sha256', this.secret()).update(ip).digest('hex').slice(0, 32)}`

  /** Whether `rumour` takes votes. */
  takes(rumour: string) {
    return this.rumours.includes(rumour)
  }

  /** Every open rumour's counts and the visitor's own votes; null when the store cannot answer. */
  async tallies(voter: string | null): Promise<Record<string, Tally> | null> {
    try {
      const ids = [...this.rumours]
      const [counts, mine] = await Promise.all([
        this.store.counts(ids.map(this.countKey)),
        voter ? this.store.get(ids.map((id) => this.voterKey(id, voter))) : [],
      ])
      return Object.fromEntries(
        ids.map((id, i) => [id, { ...counts[i], mine: asChoice(mine[i] ?? null) }])
      )
    } catch (error) {
      logger.warn({ err: error }, 'new dawn votes unavailable')
      return null
    }
  }

  /**
   * Counts `choice` on `rumour` for `voter`, voting from `ip`. A visitor who already voted keeps
   * their first vote; an address past its daily share is shown the counts without a new one.
   */
  async vote(rumour: string, choice: Choice, voter: string, ip: string): Promise<VoteResult> {
    const own = this.voterKey(rumour, voter)
    const [before] = await this.store.get([own])
    if (asChoice(before)) return { outcome: 'already', tally: await this.tally(rumour, voter) }

    if ((await this.store.bump(this.addressKey(rumour, ip), DAY)) > VOTES_PER_ADDRESS) {
      return { outcome: 'address', tally: await this.tally(rumour, null) }
    }
    // Two votes from one visitor at once: the first one to claim the key is the one counted.
    if (!(await this.store.claim(own, choice, VOTER_DAYS * DAY))) {
      return { outcome: 'already', tally: await this.tally(rumour, voter) }
    }
    await this.store.add(this.countKey(rumour), choice)
    return { outcome: 'counted', tally: await this.tally(rumour, voter) }
  }

  private async tally(rumour: string, voter: string | null): Promise<Tally> {
    const [[counts], mine] = await Promise.all([
      this.store.counts([this.countKey(rumour)]),
      voter ? this.store.get([this.voterKey(rumour, voter)]) : Promise.resolve([null]),
    ])
    return { ...counts, mine: asChoice(mine[0] ?? null) }
  }
}

const asChoice = (value: string | null | undefined): Choice | null =>
  value === 'yes' || value === 'no' ? value : null

export default new NewDawnVotes()
