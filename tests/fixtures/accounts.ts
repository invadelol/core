import { randomUUID } from 'node:crypto'
import type { ApiClient, ApiRequest } from '@japa/api-client'
import db from '@adonisjs/lucid/services/db'
import sessionService, { accountOrigin } from '#services/accounts/session_service'
import type { DesktopSeed } from '#tests/fixtures/desktop_db'
import { desktopClient } from '#tests/fixtures/desktop_http'

/** A person signed in with Discord: their account, name, handle and session token. */
export interface Person {
  id: string
  name: string
  handle: string
  token: string
}

/**
 * Invade accounts the tests create, tracked so each test removes exactly what it added (their
 * follows, saved items, builds and devices go with them).
 */
export class AccountSeed {
  users: string[] = []

  constructor(private desktop: DesktopSeed) {}

  async person(name = 'Ember'): Promise<Person> {
    const id = await sessionService.signIn(randomUUID(), name)
    this.users.push(id)
    const token = await sessionService.create(id)
    const row = await db.from('invade_user').where('id', id).first()
    return { id, name, handle: row.handle, token }
  }

  /** A device connected to `person` through the browser link, as the app and the site do it. */
  async connected(http: ApiClient, person: Person) {
    const device = await this.desktop.device()
    const app = desktopClient(http, device)
    const pair = await app.post('/api/desktop/account/pair', {})
    pair.assertStatus(201)
    const code = new URL(pair.body().url).pathname.split('/').pop()!
    const approve = await site(http, person).post('/api/account/link').json({ code })
    approve.assertStatus(204)
    return { ...device, app }
  }

  /** A League account `person` plays on, the main when it is their first. */
  async owned(person: Person, puuid: string, options: { shown?: boolean } = {}) {
    await db.table('invade_owned_account').insert({
      puuid,
      user_id: person.id,
      shown: options.shown ?? true,
    })
    await db
      .from('invade_user')
      .where('id', person.id)
      .whereNull('main_puuid')
      .update({ main_puuid: puuid })
  }

  async cleanup() {
    if (this.users.length) {
      await db
        .from('invade_follow')
        .where('target_kind', 'user')
        .whereIn('target_id', this.users)
        .delete()
      await db.from('invade_user').whereIn('id', this.users).delete()
    }
  }
}

/** The site's own requests for `person`: their session cookie and the site's Origin. */
export function site(http: ApiClient, person: Person) {
  const as = (request: ApiRequest) =>
    request.withCookie('invade_session', person.token).header('Origin', accountOrigin())
  return {
    get: (path: string) => http.get(path).withCookie('invade_session', person.token),
    post: (path: string) => as(http.post(path)),
    put: (path: string) => as(http.put(path)),
    delete: (path: string) => as(http.delete(path)),
  }
}

/** The props an Inertia page was rendered with, read from its HTML. */
export function pageProps(html: string): Record<string, any> {
  const raw = /data-page="([^"]*)"/.exec(html)?.[1]
  if (!raw) throw new Error('not an Inertia page')
  const json = raw
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
  return JSON.parse(json).props
}
