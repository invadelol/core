import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import encryption from '@adonisjs/core/services/encryption'
import { CookieClient } from '@adonisjs/http-server'
import { randomUUID } from 'node:crypto'
import { DesktopSeed } from '#tests/fixtures/desktop_db'
import {
  change,
  session,
  snapshot,
  verifyDetected,
  type AccountUser,
} from '#services/accounts/service'
import env from '#start/env'
import { desktopClient } from '#tests/fixtures/desktop_http'

test.group('User accounts and profile favorites', (group) => {
  let seed: DesktopSeed, user: AccountUser, token: string, other: AccountUser
  group.each.setup(async () => {
    seed = new DesktopSeed()
    user = { id: randomUUID(), name: 'Account test', provider: 'discord' }
    other = { id: randomUUID(), name: 'Other test', provider: 'google' }
    for (const u of [user, other])
      await db
        .table('invade_user')
        .insert({ id: u.id, provider: u.provider, subject: u.id, display_name: u.name })
    token = await session(user.id)
    return async () => {
      await db.from('invade_user').whereIn('id', [user.id, other.id]).delete()
      await seed.cleanup()
    }
  })
  const cookie = () => new CookieClient(encryption).sign('invade_session', token)!
  test('anonymous account requests are rejected', async ({ client }) => {
    const res = await client.get('/api/account')
    res.assertStatus(401)
  })
  test('signed-in snapshots are private and contain no other users', async ({ client, assert }) => {
    const res = await client.get('/api/account').header('Cookie', 'invade_session=' + cookie())
    res.assertStatus(200)
    assert.equal(res.body().user.id, user.id)
    assert.equal(res.header('cache-control'), 'private, no-store')
  })
  test('a favorite does not create ownership', async ({ assert }) => {
    const p = await seed.player()
    await change(user, { type: 'favorite', puuid: p.puuid, folderId: null })
    const s = await snapshot(user)
    assert.lengthOf(s.favorites, 1)
    assert.lengthOf(s.accounts, 0)
    assert.isNull(s.mainPuuid)
  })
  test('a Riot ID claim cannot prove ownership', async ({ assert }) => {
    const { device } = await seed.device()
    const p = await seed.player()
    await seed.link(device.id, p.puuid, null)
    await db.table('invade_device_user').insert({ device_id: device.id, user_id: user.id })
    await assert.rejects(
      () => verifyDetected(device.id, randomUUID()),
      /This account has not been detected/
    )
    assert.lengthOf((await snapshot(user)).accounts, 0)
  })
  test('a signed League observation verifies the detected account and chooses a first main', async ({
    assert,
  }) => {
    const { device } = await seed.device()
    const p = await seed.player(),
      raw = randomUUID()
    await seed.link(device.id, p.puuid, raw)
    await db.table('invade_device_user').insert({ device_id: device.id, user_id: user.id })
    const s = await verifyDetected(device.id, raw)
    assert.equal(s.mainPuuid, p.puuid)
    assert.lengthOf(s.accounts, 1)
    assert.isDefined(s.accounts[0].verifiedAt)
  })
  test('only verified accounts can be selected as main', async ({ assert }) => {
    const p = await seed.player()
    await assert.rejects(
      () => change(user, { type: 'main', puuid: p.puuid }),
      /Choose one of your verified/
    )
  })
  test('users cannot move favorites into someone else’s folder', async ({ assert }) => {
    const id = randomUUID(),
      p = await seed.player()
    await change(other, { type: 'createFolder', id, name: 'Other folder' })
    await assert.rejects(
      () => change(user, { type: 'favorite', puuid: p.puuid, folderId: id }),
      /Folder not found/
    )
  })
  test('folders, moves and deletion preserve favorites', async ({ assert }) => {
    const id = randomUUID(),
      p = await seed.player()
    await change(user, { type: 'createFolder', id, name: 'Team' })
    await change(user, { type: 'favorite', puuid: p.puuid, folderId: id })
    await change(user, { type: 'renameFolder', id, name: 'Clash team' })
    let s = await snapshot(user)
    assert.equal(s.folders[0].name, 'Clash team')
    assert.equal(s.favorites[0].folderId, id)
    s = await change(user, { type: 'deleteFolder', id })
    assert.lengthOf(s.favorites, 1)
    assert.isNull(s.favorites[0].folderId)
  })
  test('browser mutations reject a cross-origin request', async ({ client }) => {
    const res = await client
      .post('/api/account/changes')
      .header('Cookie', 'invade_session=' + cookie())
      .header('Origin', 'https://example.com')
      .json({ type: 'createFolder', id: randomUUID(), name: 'Bad' })
    res.assertStatus(403)
  })
  test('a valid browser mutation persists for the same linked desktop user', async ({
    client,
    assert,
  }) => {
    const res = await client
      .post('/api/account/changes')
      .header('Cookie', 'invade_session=' + cookie())
      .header('Origin', env.get('ACCOUNT_ORIGIN')!)
      .json({ type: 'createFolder', id: randomUUID(), name: 'Shared' })
    res.assertStatus(200)
    assert.equal((await snapshot(user)).folders[0].name, 'Shared')
  })
  test('desktop pairing requires approval and its code is single use', async ({
    client,
    assert,
  }) => {
    const creds = await seed.device(),
      desktop = desktopClient(client, creds)
    const pair = await desktop.post('/api/desktop/pair', {})
    pair.assertStatus(201)
    const code = pair.body().url.split('/').at(-1)
    const approve = () =>
      client
        .post('/api/account/approve')
        .header('Cookie', 'invade_session=' + cookie())
        .header('Origin', env.get('ACCOUNT_ORIGIN')!)
        .json({ code })
    const first = await approve()
    first.assertStatus(200)
    const second = await approve()
    second.assertStatus(410)
    const linked = await desktop.get('/api/desktop/account')
    linked.assertStatus(200)
    assert.equal(linked.body().user.id, user.id)
  })
  test('a second user cannot take over a linked desktop', async ({ client }) => {
    const creds = await seed.device(),
      desktop = desktopClient(client, creds)
    await db.table('invade_device_user').insert({ device_id: creds.device.id, user_id: other.id })
    const pair = await desktop.post('/api/desktop/pair', {})
    pair.assertStatus(201)
    const code = pair.body().url.split('/').at(-1)
    const approve = await client
      .post('/api/account/approve')
      .header('Cookie', 'invade_session=' + cookie())
      .header('Origin', env.get('ACCOUNT_ORIGIN')!)
      .json({ code })
    approve.assertStatus(409)
  })
  test('OAuth callbacks without the signed state cookie cannot create a session', async ({
    client,
  }) => {
    const res = await client.get('/auth/discord/callback?state=invalid&code=invalid').redirects(0)
    res.assertStatus(302)
    res.assertHeader('location', '/signin?error=expired')
  })
})
