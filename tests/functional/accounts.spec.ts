import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import rateLimiter from '#services/desktop/rate_limiter'
import replayGuard from '#services/desktop/signing'
import sessionService, { accountOrigin } from '#services/accounts/session_service'
import accountService from '#services/accounts/account_service'
import { DesktopSeed } from '#tests/fixtures/desktop_db'
import { desktopClient } from '#tests/fixtures/desktop_http'

/**
 * Invade accounts end to end (docs/desktop-sync.md §10): the browser session and its Origin
 * check, favorites and folders, a desktop app connected through its browser link, and the proof
 * of a League account, which only a client link of the same device gives.
 */
/** The change is refused with a message matching `message`. */
async function refused(change: Promise<unknown>, message: RegExp) {
  try {
    await change
  } catch (error) {
    if (!message.test((error as Error).message)) throw error
    return
  }
  throw new Error(`expected a refusal matching ${message}`)
}

test.group('Invade accounts', (group) => {
  group.tap((t) => t.tags(['@accounts']))
  const prefixes = { limiter: rateLimiter.prefix, replay: replayGuard.prefix }
  const fetch = globalThis.fetch
  let seed: DesktopSeed
  let users: string[] = []

  group.each.setup(() => {
    seed = new DesktopSeed()
    users = []
    rateLimiter.prefix = `desktop:rl:test:${randomUUID()}:`
    replayGuard.prefix = `desktop:sig:test:${randomUUID()}:`
  })
  group.each.teardown(async () => {
    rateLimiter.prefix = prefixes.limiter
    replayGuard.prefix = prefixes.replay
    globalThis.fetch = fetch
    if (users.length) await db.from('invade_user').whereIn('id', users).delete()
    await seed.cleanup()
  })

  /** A person signed in with Discord, and their session token. */
  async function person(name = 'Ember') {
    const subject = randomUUID()
    const { userId } = await sessionService.signIn('discord', subject, name, null)
    users.push(userId)
    const token = await sessionService.create(userId)
    return { id: userId, name, token, subject }
  }

  /** A device connected to `user` through the browser link, as the app and the site do it. */
  async function connected(http: any, user: { token: string }) {
    const device = await seed.device()
    const app = desktopClient(http, device)
    const pair = await app.post('/api/desktop/account/pair', {})
    pair.assertStatus(201)
    const code = new URL(pair.body().url).pathname.split('/').pop()!
    const approve = await http
      .post('/api/account/link')
      .withCookie('invade_session', user.token)
      .header('Origin', accountOrigin())
      .json({ code })
    approve.assertStatus(200)
    return { ...device, app }
  }

  test('the account answers only a signed-in browser', async ({ client: http, assert }) => {
    const user = await person()
    const anonymous = await http.get('/api/account')
    anonymous.assertStatus(401)
    assert.equal(anonymous.body().errors[0].code, 'E_SIGNED_OUT')

    const mine = await http.get('/api/account').withCookie('invade_session', user.token)
    mine.assertStatus(200)
    assert.equal(mine.body().user.name, 'Ember')
    assert.deepEqual(mine.body().user.providers, ['discord'])
    assert.equal(mine.header('cache-control'), 'no-store')

    const forged = await http.get('/api/account').withCookie('invade_session', 'x'.repeat(43))
    forged.assertStatus(401)
  })

  test('a write from another origin is refused', async ({ client: http, assert }) => {
    const user = await person()
    const change = { type: 'createFolder', id: randomUUID(), name: 'Duo' }
    for (const origin of [null, 'https://evil.example']) {
      const request = http.post('/api/account/changes').withCookie('invade_session', user.token)
      if (origin) request.header('Origin', origin)
      const response = await request.json(change)
      response.assertStatus(403)
      assert.equal(response.body().errors[0].code, 'E_ORIGIN')
    }
    const same = await http
      .post('/api/account/changes')
      .withCookie('invade_session', user.token)
      .header('Origin', accountOrigin())
      .json(change)
    same.assertStatus(200)
    assert.deepEqual(same.body().folders, [{ id: change.id, name: 'Duo' }])
  })

  test('favorites live in folders; a deleted folder keeps its players', async ({ assert }) => {
    const user = await person()
    const [a, b] = [await seed.player(), await seed.player()]
    const folder = randomUUID()
    await accountService.change(user, { type: 'createFolder', id: folder, name: 'Scouting' })
    // The same folder twice (a retry) is already done; another with the same name is refused.
    await accountService.change(user, { type: 'createFolder', id: folder, name: 'Scouting' })
    await refused(
      accountService.change(user, { type: 'createFolder', id: randomUUID(), name: 'scouting' }),
      /already have a folder/
    )
    await accountService.change(user, { type: 'favorite', puuid: a.puuid, folderId: folder })
    await accountService.change(user, { type: 'favorite', puuid: b.puuid })
    let account = await accountService.snapshot(user)
    assert.sameMembers(
      account.favorites.map((f) => [f.puuid, f.folderId].join()),
      [`${a.puuid},${folder}`, `${b.puuid},`]
    )
    await accountService.change(user, { type: 'deleteFolder', id: folder })
    account = await accountService.snapshot(user)
    assert.lengthOf(account.folders, 0)
    assert.deepEqual(
      account.favorites.map((f) => f.folderId),
      [null, null]
    )
    await refused(
      accountService.change(user, { type: 'favorite', puuid: 'A'.repeat(78) }),
      /not on Invade/
    )
  })

  test('another person cannot file into my folder', async () => {
    const [me, other] = [await person(), await person('Copper Lane')]
    const player = await seed.player()
    const folder = randomUUID()
    await accountService.change(me, { type: 'createFolder', id: folder, name: 'Mine' })
    await refused(
      accountService.change(other, { type: 'favorite', puuid: player.puuid, folderId: folder }),
      /no longer exists/
    )
    await refused(
      accountService.change(other, { type: 'createFolder', id: folder, name: 'Mine' }),
      /Unknown folder/
    )
  })

  test('an app connects through its link, then proves the League account signed in', async ({
    client: http,
    assert,
  }) => {
    const user = await person()
    const { device, app } = await connected(http, user)
    const player = await seed.player()
    const raw = randomUUID()

    // A Riot ID link proves nothing.
    await seed.link(device.id, player.puuid, null)
    const claimed = await app.post('/api/desktop/account/verify', { rawPuuid: raw })
    claimed.assertStatus(403)
    assert.equal(claimed.body().errors[0].code, 'E_NOT_DETECTED')

    // The client link of this device does.
    await db.from('desktop_device_account').where({ device_id: device.id }).delete()
    await seed.link(device.id, player.puuid, raw)
    const proven = await app.post('/api/desktop/account/verify', { rawPuuid: raw, auto: true })
    proven.assertStatus(200)
    assert.equal(proven.body().verified, player.puuid)
    assert.equal(proven.body().mainPuuid, player.puuid)
    assert.deepEqual(
      proven.body().accounts.map((a: { puuid: string }) => a.puuid),
      [player.puuid]
    )

    const seen = await app.get('/api/desktop/account')
    seen.assertStatus(200)
    assert.equal(seen.body().user.id, user.id)
    assert.lengthOf(seen.body().devices, 1)
  })

  test('a client link from another device proves nothing', async ({ client: http, assert }) => {
    const user = await person()
    const { app } = await connected(http, user)
    const elsewhere = await seed.device()
    const player = await seed.player()
    const raw = randomUUID()
    await seed.link(elsewhere.device.id, player.puuid, raw)
    const response = await app.post('/api/desktop/account/verify', { rawPuuid: raw })
    response.assertStatus(403)
    assert.equal(response.body().errors[0].code, 'E_NOT_DETECTED')
  })

  test('an app that is not connected cannot verify or change anything', async ({
    client: http,
    assert,
  }) => {
    const device = await seed.device()
    const app = desktopClient(http, device)
    const empty = await app.get('/api/desktop/account')
    empty.assertStatus(200)
    assert.isNull(empty.body().user)
    for (const response of [
      await app.post('/api/desktop/account/verify', { rawPuuid: randomUUID() }),
      await app.post('/api/desktop/account/changes', {
        type: 'createFolder',
        id: randomUUID(),
        name: 'X',
      }),
    ]) {
      // Never 401: to the app that means its device token is gone.
      response.assertStatus(403)
      assert.equal(response.body().errors[0].code, 'E_NOT_CONNECTED')
    }
  })

  test('a link works once, before it expires, and never moves an app between people', async ({
    client: http,
    assert,
  }) => {
    const [me, other] = [await person(), await person('Copper Lane')]
    const { app } = await connected(http, me)
    const pair = await app.post('/api/desktop/account/pair', {})
    const code = new URL(pair.body().url).pathname.split('/').pop()!
    const stolen = await http
      .post('/api/account/link')
      .withCookie('invade_session', other.token)
      .header('Origin', accountOrigin())
      .json({ code })
    stolen.assertStatus(409)
    assert.equal(stolen.body().errors[0].code, 'E_APP_TAKEN')

    const fresh = await seed.device()
    const freshPair = await desktopClient(http, fresh).post('/api/desktop/account/pair', {})
    const freshCode = new URL(freshPair.body().url).pathname.split('/').pop()!
    await db
      .from('invade_pairing')
      .where('device_id', fresh.device.id)
      .update({ expires_at: new Date(Date.now() - 1000) })
    const late = await http
      .post('/api/account/link')
      .withCookie('invade_session', me.token)
      .header('Origin', accountOrigin())
      .json({ code: freshCode })
    late.assertStatus(410)
    assert.equal(late.body().errors[0].code, 'E_LINK_EXPIRED')
  })

  test('the newest proof moves a League account; a removal holds against the app', async ({
    client: http,
    assert,
  }) => {
    const [me, other] = [await person(), await person('Copper Lane')]
    const mine = await connected(http, me)
    const theirs = await connected(http, other)
    const player = await seed.player()
    const raw = randomUUID()
    await seed.link(mine.device.id, player.puuid, raw)
    await seed.link(theirs.device.id, player.puuid, raw)
    ;(await mine.app.post('/api/desktop/account/verify', { rawPuuid: raw })).assertStatus(200)
    ;(await theirs.app.post('/api/desktop/account/verify', { rawPuuid: raw })).assertStatus(200)
    let account = await accountService.snapshot(me)
    assert.lengthOf(account.accounts, 0)
    assert.isNull(account.mainPuuid)

    await accountService.change(other, { type: 'removeAccount', puuid: player.puuid })
    const auto = await theirs.app.post('/api/desktop/account/verify', { rawPuuid: raw, auto: true })
    assert.isNull(auto.body().verified)
    assert.lengthOf(auto.body().accounts, 0)
    const asked = await theirs.app.post('/api/desktop/account/verify', { rawPuuid: raw })
    assert.equal(asked.body().verified, player.puuid)
  })

  test('the app may name a favorite by Riot ID or by the client PUUID', async ({
    client: http,
    assert,
  }) => {
    const user = await person()
    const { app } = await connected(http, user)
    const player = await seed.player()
    const byName = await app.post('/api/desktop/account/changes', {
      type: 'favorite',
      gameName: player.game_name,
      tagLine: player.tag_line,
      platform: 'EUW1',
    })
    byName.assertStatus(200)
    assert.deepEqual(
      byName.body().favorites.map((f: { puuid: string }) => f.puuid),
      [player.puuid]
    )
    // Removing a player Invade never stored is already done.
    const gone = await app.post('/api/desktop/account/changes', {
      type: 'removeFavorite',
      gameName: 'Nobody',
      tagLine: 'NONE',
    })
    gone.assertStatus(200)
    assert.lengthOf(gone.body().favorites, 1)
  })

  test('signing in with Discord sets a session and returns where the person was', async ({
    client: http,
    assert,
  }) => {
    const subject = `test-${randomUUID()}`
    globalThis.fetch = (async (url: string | URL) => {
      const href = String(url)
      if (href.includes('token')) {
        return new Response(JSON.stringify({ access_token: 'token' }), { status: 200 })
      }
      return new Response(JSON.stringify({ id: subject, global_name: 'Briar' }), { status: 200 })
    }) as typeof fetch

    const saved = { id: env.get('DISCORD_CLIENT_ID'), secret: env.get('DISCORD_CLIENT_SECRET') }
    env.set('DISCORD_CLIENT_ID', saved.id || 'test-client')
    env.set('DISCORD_CLIENT_SECRET', saved.secret || 'test-secret')
    try {
      const start = await http.get('/auth/discord?next=/account').redirects(0)
      start.assertStatus(302)
      const location = new URL(start.header('location')!)
      assert.equal(location.searchParams.get('scope'), 'identify')
      const flow = start.cookie('invade_oauth')?.value
      assert.exists(flow)
      const back = await http
        .get(`/auth/discord/callback?code=abc&state=${location.searchParams.get('state')}`)
        .withEncryptedCookie('invade_oauth', flow)
        .redirects(0)
      back.assertStatus(302)
      assert.equal(back.header('location'), '/account')
      assert.exists(back.cookie('invade_session')?.value)
      const row = await db.from('invade_identity').where({ provider: 'discord', subject }).first()
      users.push(row.user_id)

      // A state that does not match is refused.
      const wrong = await http
        .get('/auth/discord/callback?code=abc&state=' + 'x'.repeat(43))
        .withEncryptedCookie('invade_oauth', flow)
        .redirects(0)
      assert.include(wrong.header('location'), 'error=expired')
    } finally {
      env.set('DISCORD_CLIENT_ID', saved.id ?? '')
      env.set('DISCORD_CLIENT_SECRET', saved.secret ?? '')
    }
  })
})
