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
import { AccountSeed, pageProps, site } from '#tests/fixtures/accounts'

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

/**
 * Invade accounts end to end (docs/desktop-sync.md §10): Discord sign-in and handles, the browser
 * session and its Origin check, a desktop app connected through its one-time link, the proof of a
 * League account, the accounts shown on the profile, and deleting the account.
 */
test.group('Invade accounts', (group) => {
  group.tap((t) => t.tags(['@accounts']))
  const prefixes = { limiter: rateLimiter.prefix, replay: replayGuard.prefix }
  const fetch = globalThis.fetch
  let seed: DesktopSeed
  let accounts: AccountSeed

  group.each.setup(() => {
    seed = new DesktopSeed()
    accounts = new AccountSeed(seed)
    rateLimiter.prefix = `desktop:rl:test:${randomUUID()}:`
    replayGuard.prefix = `desktop:sig:test:${randomUUID()}:`
  })
  group.each.teardown(async () => {
    rateLimiter.prefix = prefixes.limiter
    replayGuard.prefix = prefixes.replay
    globalThis.fetch = fetch
    await accounts.cleanup()
    await seed.cleanup()
  })

  test('a handle comes from the Discord name, numbered when taken', async ({ assert }) => {
    const base = `Émber ${randomUUID().slice(0, 6)}`
    const first = await accounts.person(base)
    const second = await accounts.person(base)
    const expected = base
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
    assert.equal(first.handle, expected)
    assert.equal(second.handle, `${expected}2`)
    const emoji = await accounts.person('🔥🔥')
    assert.match(emoji.handle, /^player\d*$/)
  })

  test('signing in again keeps the account and its handle', async ({ assert }) => {
    const subject = randomUUID()
    const id = await sessionService.signIn(subject, 'Briar')
    accounts.users.push(id)
    const again = await sessionService.signIn(subject, 'Briar Signal')
    assert.equal(again, id)
    const user = await db.from('invade_user').where('id', id).first()
    assert.equal(user.display_name, 'Briar')
    const identity = await db.from('invade_identity').where({ subject }).first()
    assert.equal(identity.display_name, 'Briar Signal')
  })

  test('the account answers only a signed-in browser', async ({ client: http, assert }) => {
    const user = await accounts.person()
    const anonymous = await http.get('/api/account')
    anonymous.assertStatus(401)
    assert.equal(anonymous.body().errors[0].code, 'E_SIGNED_OUT')

    const mine = await site(http, user).get('/api/account')
    mine.assertStatus(200)
    assert.equal(mine.body().user.name, 'Ember')
    assert.equal(mine.body().user.handle, user.handle)
    assert.deepEqual(mine.body().user.providers, ['discord'])
    assert.isFalse(mine.body().user.premium)
    assert.deepEqual(mine.body().counts, { followers: 0, following: 0, friends: 0, saved: 0 })
    assert.equal(mine.body().settings.clipVisibility, 'everyone')
    assert.equal(mine.header('cache-control'), 'no-store')

    const forged = await http.get('/api/account').withCookie('invade_session', 'x'.repeat(43))
    forged.assertStatus(401)
  })

  test('a write from another origin is refused', async ({ client: http, assert }) => {
    const user = await accounts.person()
    const ops = [{ op: 'rename', name: 'Ember Two' }]
    for (const origin of [null, 'https://evil.example']) {
      const request = http.post('/api/account/changes').withCookie('invade_session', user.token)
      if (origin) request.header('Origin', origin)
      const response = await request.json({ ops })
      response.assertStatus(403)
      assert.equal(response.body().errors[0].code, 'E_ORIGIN')
    }
    const same = await site(http, user).post('/api/account/changes').json({ ops })
    same.assertStatus(200)
    assert.equal(same.body().user.name, 'Ember Two')
  })

  test('changes apply all together or not at all', async ({ client: http, assert }) => {
    const user = await accounts.person()
    const response = await site(http, user)
      .post('/api/account/changes')
      .json({ ops: [{ op: 'rename', name: 'Renamed' }, { op: 'nonsense' }] })
    response.assertStatus(422)
    const row = await db.from('invade_user').where('id', user.id).first()
    assert.equal(row.display_name, 'Ember')
    const tooMany = await site(http, user)
      .post('/api/account/changes')
      .json({ ops: Array.from({ length: 51 }, () => ({ op: 'rename', name: 'X' })) })
    tooMany.assertStatus(422)
  })

  test('privacy settings take only their own values', async ({ assert }) => {
    const user = await accounts.person()
    const account = await accountService.change(
      user,
      [{ op: 'settings', settings: { clipVisibility: 'private', allowTags: false } }],
      'site'
    )
    assert.deepEqual(account.settings, {
      clipVisibility: 'private',
      clipComments: 'everyone',
      clipsOnProfile: true,
      allowTags: false,
      streamerMode: true,
    })
    await refused(
      accountService.change(
        user,
        [{ op: 'settings', settings: { clipVisibility: 'friends' } }],
        'site'
      ),
      /Unknown setting/
    )
    await refused(
      accountService.change(user, [{ op: 'settings', settings: { handle: 'taken' } }], 'site'),
      /Unknown setting/
    )
  })

  test('an app connects through its link, then proves the League account signed in', async ({
    client: http,
    assert,
  }) => {
    const user = await accounts.person()
    const { device, app } = await accounts.connected(http, user)
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
      proven.body().accounts.map((a: { puuid: string; shown: boolean }) => [a.puuid, a.shown]),
      [[player.puuid, true]]
    )

    const seen = await app.get('/api/desktop/account')
    seen.assertStatus(200)
    assert.equal(seen.body().user.id, user.id)
    assert.equal(seen.body().user.handle, user.handle)
    assert.lengthOf(seen.body().devices, 1)
  })

  test('the link has no code: 32 characters, ten minutes, nothing else', async ({
    client: http,
    assert,
  }) => {
    const device = await seed.device()
    const pair = await desktopClient(http, device).post('/api/desktop/account/pair', {})
    pair.assertStatus(201)
    assert.deepEqual(Object.keys(pair.body()).sort(), ['expiresAt', 'url'])
    const url = new URL(pair.body().url)
    assert.equal(url.origin, accountOrigin())
    assert.match(url.pathname, /^\/account\/link\/[A-Za-z0-9_-]{32}$/)
    const minutes = (pair.body().expiresAt - Date.now()) / 60_000
    assert.isAbove(minutes, 9.9)
    assert.isAtMost(minutes, 10)
  })

  test('the link page asks a signed-out visitor to sign in first, and comes back', async ({
    client: http,
    assert,
  }) => {
    const device = await seed.device()
    const pair = await desktopClient(http, device).post('/api/desktop/account/pair', {})
    const path = new URL(pair.body().url).pathname
    const page = await http.get(path).redirects(0)
    page.assertStatus(302)
    assert.equal(page.header('location'), `/signin?next=${encodeURIComponent(path)}`)
  })

  test('the link page names the app, then says connected', async ({ client: http, assert }) => {
    const user = await accounts.person()
    const device = await seed.device()
    const pair = await desktopClient(http, device).post('/api/desktop/account/pair', {})
    const path = new URL(pair.body().url).pathname
    const code = path.split('/').pop()!
    const before = await site(http, user).get(path)
    before.assertStatus(200)
    assert.deepEqual(pageProps(before.text()).pairing, {
      os: 'macos',
      app: '0.2.7',
      expired: false,
      approved: false,
      linkedElsewhere: false,
    })
    const approved = await site(http, user).post('/api/account/link').json({ code })
    approved.assertStatus(204)
    const after = await site(http, user).get(path)
    assert.isTrue(pageProps(after.text()).pairing.approved)
    // Used once: the same link again is spent.
    const again = await site(http, user).post('/api/account/link').json({ code })
    again.assertStatus(410)
  })

  test('"This is not me" signs out and comes back to the link', async ({
    client: http,
    assert,
  }) => {
    const user = await accounts.person()
    const next = '/signin?next=%2Faccount%2Flink%2Fabc'
    const response = await site(http, user).post('/signout').form({ next }).redirects(0)
    response.assertStatus(302)
    assert.equal(response.header('location'), next)
    const gone = await site(http, user).get('/api/account')
    gone.assertStatus(401)
    const elsewhere = await site(http, await accounts.person())
      .post('/signout')
      .form({ next: '//evil.example' })
      .redirects(0)
    assert.equal(elsewhere.header('location'), '/account')
  })

  test('a client link from another device proves nothing', async ({ client: http, assert }) => {
    const user = await accounts.person()
    const { app } = await accounts.connected(http, user)
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
    assert.deepEqual(empty.body().counts, { followers: 0, following: 0, friends: 0, saved: 0 })
    for (const response of [
      await app.post('/api/desktop/account/verify', { rawPuuid: randomUUID() }),
      await app.post('/api/desktop/account/changes', {
        ops: [{ op: 'follow', kind: 'pro', id: 'faker' }],
      }),
      await app.get('/api/desktop/builds'),
    ]) {
      // Never 401: to the app that means its device token is gone.
      response.assertStatus(403)
      assert.equal(response.body().errors[0].code, 'E_NOT_CONNECTED')
    }
  })

  test('the app sends only its own changes', async ({ client: http, assert }) => {
    const user = await accounts.person()
    const { app } = await accounts.connected(http, user)
    for (const op of [
      { op: 'rename', name: 'X' },
      { op: 'notMine', puuid: 'A'.repeat(78) },
      { op: 'settings', settings: { allowTags: false } },
      { op: 'createFolder', id: randomUUID(), name: 'Duo' },
    ]) {
      const response = await app.post('/api/desktop/account/changes', { ops: [op] })
      response.assertStatus(422)
      assert.equal(response.body().errors[0].code, 'E_ACCOUNT_INVALID')
    }
  })

  test('a link works once, before it expires, and never moves an app between people', async ({
    client: http,
    assert,
  }) => {
    const [me, other] = [await accounts.person(), await accounts.person('Copper Lane')]
    const { app } = await accounts.connected(http, me)
    const pair = await app.post('/api/desktop/account/pair', {})
    const code = new URL(pair.body().url).pathname.split('/').pop()!
    const stolen = await site(http, other).post('/api/account/link').json({ code })
    stolen.assertStatus(409)
    assert.equal(stolen.body().errors[0].code, 'E_APP_TAKEN')

    const fresh = await seed.device()
    const freshPair = await desktopClient(http, fresh).post('/api/desktop/account/pair', {})
    const freshCode = new URL(freshPair.body().url).pathname.split('/').pop()!
    await db
      .from('invade_pairing')
      .where('device_id', fresh.device.id)
      .update({ expires_at: new Date(Date.now() - 1000) })
    const late = await site(http, me).post('/api/account/link').json({ code: freshCode })
    late.assertStatus(410)
    assert.equal(late.body().errors[0].code, 'E_LINK_EXPIRED')
  })

  test('the newest proof moves a League account; "Not mine" holds against the app', async ({
    client: http,
    assert,
  }) => {
    const [me, other] = [await accounts.person(), await accounts.person('Copper Lane')]
    const mine = await accounts.connected(http, me)
    const theirs = await accounts.connected(http, other)
    const player = await seed.player()
    const raw = randomUUID()
    await seed.link(mine.device.id, player.puuid, raw)
    await seed.link(theirs.device.id, player.puuid, raw)
    for (const app of [mine.app, theirs.app]) {
      const proof = await app.post('/api/desktop/account/verify', { rawPuuid: raw })
      proof.assertStatus(200)
    }
    let account = await accountService.snapshot(me)
    assert.lengthOf(account.accounts, 0)
    assert.isNull(account.mainPuuid)

    await accountService.change(other, [{ op: 'notMine', puuid: player.puuid }], 'site')
    const auto = await theirs.app.post('/api/desktop/account/verify', { rawPuuid: raw, auto: true })
    assert.isNull(auto.body().verified)
    assert.lengthOf(auto.body().accounts, 0)
    const asked = await theirs.app.post('/api/desktop/account/verify', { rawPuuid: raw })
    assert.equal(asked.body().verified, player.puuid)
  })

  test('main and shown: only the person own accounts, from the app too', async ({
    client: http,
    assert,
  }) => {
    const user = await accounts.person()
    const { app } = await accounts.connected(http, user)
    const [first, second, stranger] = [
      await seed.player(),
      await seed.player(),
      await seed.player(),
    ]
    await accounts.owned(user, first.puuid)
    await accounts.owned(user, second.puuid)

    const changed = await app.post('/api/desktop/account/changes', {
      ops: [
        { op: 'main', puuid: second.puuid },
        { op: 'show', puuid: first.puuid, shown: false },
      ],
    })
    changed.assertStatus(200)
    assert.equal(changed.body().mainPuuid, second.puuid)
    assert.deepEqual(
      changed.body().accounts.map((a: { puuid: string; shown: boolean }) => [a.puuid, a.shown]),
      [
        [first.puuid, false],
        [second.puuid, true],
      ]
    )
    for (const op of [
      { op: 'main', puuid: stranger.puuid },
      { op: 'show', puuid: stranger.puuid, shown: true },
    ]) {
      const response = await app.post('/api/desktop/account/changes', { ops: [op] })
      response.assertStatus(422)
    }
  })

  test('a hidden main account is not the person picture anywhere', async ({ assert }) => {
    const user = await accounts.person()
    const player = await seed.player('EUW1', { profile_icon_id: 4025 })
    await accounts.owned(user, player.puuid, { shown: false })
    let viewer = await accountService.viewer(user)
    assert.isNull(viewer!.avatarUrl)
    // The person still sees their own main account in their menu.
    assert.equal(viewer!.main!.puuid, player.puuid)
    await accountService.change(user, [{ op: 'show', puuid: player.puuid, shown: true }], 'site')
    viewer = await accountService.viewer(user)
    assert.match(viewer!.avatarUrl!, /\/cdn\/profile-icon\/4025\.png$/)
  })

  test('deleting the account takes its follows both ways and its saved items', async ({
    client: http,
    assert,
  }) => {
    const [me, friend] = [await accounts.person(), await accounts.person('Briar')]
    await accountService.change(me, [{ op: 'follow', kind: 'user', id: friend.id }], 'site')
    await accountService.change(friend, [{ op: 'follow', kind: 'user', id: me.id }], 'site')
    const refusedDelete = await site(http, me).delete('/api/account').json({})
    refusedDelete.assertStatus(422)
    const deleted = await site(http, me).delete('/api/account').json({ confirm: 'delete' })
    deleted.assertStatus(204)
    assert.isNull(await db.from('invade_user').where('id', me.id).first())
    const left = await db
      .from('invade_follow')
      .where('target_id', me.id)
      .orWhere('follower_id', me.id)
    assert.lengthOf(left, 0)
    const { counts } = await accountService.snapshot(friend)
    assert.deepEqual(counts, { followers: 0, following: 0, friends: 0, saved: 0 })
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
      accounts.users.push(row.user_id)
      const user = await db.from('invade_user').where('id', row.user_id).first()
      assert.match(user.handle, /^briar\d*$/)

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

  test('Google is gone: its routes are not sign-in routes', async ({ client: http }) => {
    const google = await http.get('/auth/google').redirects(0)
    google.assertStatus(404)
  })
})
