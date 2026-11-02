import logger from '@adonisjs/core/services/logger'
import { DISCORD_URL } from '../../inertia/lib/links.js'

/**
 * How many people are on the community server, for `/contact`.
 *
 * Discord answers an invite's counts without a token. The answer is held for a few minutes and a
 * failed refresh keeps the last good one, so the page never waits on Discord for long and never
 * shows a made-up figure: no answer at all means no figures.
 */

const INVITE_CODE = DISCORD_URL.split('/').pop()!
const INVITE_URL = `https://discord.com/api/v10/invites/${INVITE_CODE}?with_counts=true`
const FRESH_MS = 10 * 60_000
/** A failed refresh keeps serving the last good answer for this long. */
const STALE_MS = 24 * 60 * 60_000
const TIMEOUT_MS = 3_000

export interface DiscordServer {
  members: number
  online: number
}

/** Reads the counts out of Discord's invite payload. Null when they are missing. */
export function parseInvite(payload: unknown): DiscordServer | null {
  const invite = payload as {
    approximate_member_count?: unknown
    approximate_presence_count?: unknown
  } | null
  const members = invite?.approximate_member_count
  const online = invite?.approximate_presence_count
  if (typeof members !== 'number' || typeof online !== 'number' || members <= 0) return null
  return { members, online: Math.min(online, members) }
}

class DiscordServers {
  #cached: { server: DiscordServer; at: number } | null = null
  #inflight: Promise<DiscordServer | null> | null = null

  /** The server's counts, from memory when they are recent. Null when none are known. */
  async counts(now = Date.now()): Promise<DiscordServer | null> {
    if (this.#cached && now - this.#cached.at < FRESH_MS) return this.#cached.server
    this.#inflight ??= this.#refresh(now).finally(() => (this.#inflight = null))
    const fresh = await this.#inflight
    if (fresh) return fresh
    return this.#cached && now - this.#cached.at < STALE_MS ? this.#cached.server : null
  }

  async #refresh(now: number): Promise<DiscordServer | null> {
    try {
      const response = await fetch(INVITE_URL, {
        headers: { 'user-agent': 'invade.lol' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`Discord answered ${response.status}`)
      const server = parseInvite(await response.json())
      if (server) this.#cached = { server, at: now }
      return server
    } catch (error) {
      logger.warn({ err: error }, 'could not read the Discord server counts')
      return null
    }
  }

  /** Sets what was read; for tests. */
  prime(server: DiscordServer | null, at = Date.now()) {
    this.#cached = server ? { server, at } : null
    this.#inflight = null
  }
}

export const discordServer = new DiscordServers()
