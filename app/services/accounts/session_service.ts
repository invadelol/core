import { createHash, randomBytes } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import { SITE_ORIGIN } from '#services/sitemap'
import { freeHandle } from '#services/accounts/handles'

/** The person behind a request, once their session cookie checks out. */
export interface SignedIn {
  id: string
  name: string
}

export const SESSION_COOKIE = 'invade_session'
/** How long a session lasts without a visit; each visit past half of it starts it again. */
const SESSION_DAYS = 60
const DAY_MS = 86_400_000

export const digest = (token: string) => createHash('sha256').update(token).digest('hex')

/**
 * The site's own origin, the only one browser account requests may come from. `ACCOUNT_ORIGIN`
 * per deployment (`https://pp.invade.lol`, `http://localhost:3333`); OAuth callbacks are built on
 * it too, so it must match the redirect URL registered with Discord.
 */
export function accountOrigin() {
  return (env.get('ACCOUNT_ORIGIN') || SITE_ORIGIN).replace(/\/+$/, '')
}

/** Whether cookies need `Secure`: everywhere but a plain-http local server. */
export const secureCookies = () => accountOrigin().startsWith('https:')

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  }
}

class SessionService {
  /** The signed-in person for a session token, or null (unknown, expired, malformed). */
  async authenticate(token: unknown): Promise<SignedIn | null> {
    if (typeof token !== 'string' || token.length < 20 || token.length > 128) return null
    const hash = digest(token)
    const row = await db
      .from('invade_session as s')
      .join('invade_user as u', 'u.id', 's.user_id')
      .where('s.token_hash', hash)
      .where('s.expires_at', '>', new Date())
      .select('u.id', 'u.display_name', 's.expires_at', 'u.last_seen_at')
      .first()
    if (!row) return null

    // Sliding expiry and a coarse "last seen", at most one write a day per session.
    const now = Date.now()
    if (new Date(row.expires_at).getTime() - now < (SESSION_DAYS - 1) * DAY_MS) {
      await db
        .from('invade_session')
        .where('token_hash', hash)
        .update({ expires_at: new Date(now + SESSION_DAYS * DAY_MS) })
      await db
        .from('invade_user')
        .where('id', row.id)
        .update({ last_seen_at: new Date(now) })
    }
    return { id: row.id, name: row.display_name }
  }

  /** A new session for a person; the token goes into the cookie, only its hash is stored. */
  async create(userId: string) {
    const token = randomBytes(32).toString('base64url')
    await db.table('invade_session').insert({
      token_hash: digest(token),
      user_id: userId,
      expires_at: new Date(Date.now() + SESSION_DAYS * DAY_MS),
    })
    // Old sessions of this person that ran out go with each new sign-in.
    await db
      .from('invade_session')
      .where('user_id', userId)
      .where('expires_at', '<', new Date())
      .delete()
    await db.from('invade_user').where('id', userId).update({ last_seen_at: new Date() })
    return token
  }

  async destroy(token: unknown) {
    if (typeof token !== 'string' || token.length > 128) return
    await db.from('invade_session').where('token_hash', digest(token)).delete()
  }

  /**
   * The Invade account a Discord identity belongs to, created with its handle on the first
   * sign-in. Later sign-ins keep the account as it is and only note the name Discord gives now.
   */
  async signIn(subject: string, name: string): Promise<string> {
    const discordName = name.slice(0, 100)
    return db.transaction(async (trx) => {
      const existing = await trx
        .from('invade_identity')
        .where({ provider: 'discord', subject })
        .forUpdate()
        .first()
      if (existing) {
        await trx
          .from('invade_identity')
          .where({ provider: 'discord', subject })
          .update({ display_name: discordName })
        return existing.user_id as string
      }
      const displayName = name.replace(/\s+/g, ' ').trim().slice(0, 32) || 'Player'
      const [user] = await trx
        .table('invade_user')
        .insert({ display_name: displayName, handle: await freeHandle(trx, displayName) })
        .returning('id')
      const userId: string = typeof user === 'object' ? user.id : user
      await trx.table('invade_identity').insert({
        provider: 'discord',
        subject,
        user_id: userId,
        display_name: discordName,
      })
      return userId
    })
  }
}

export default new SessionService()
