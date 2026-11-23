import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import { accountOrigin } from '#services/accounts/session_service'
import { writeLimiter } from '#services/profiles/browser_writes'
import profileService from '#services/profiles/profile_service'
import { verifyPro, unverifyPro } from '#services/profiles/verified_pros'
import skinCatalogue from '#services/skins/skin_catalogue'
import { DesktopSeed } from '#tests/fixtures/desktop_db'
import {
  ProfileSeed,
  SKINS,
  expectStatus,
  fakeCatalogue,
  type Person,
} from '#tests/fixtures/profiles'
import { DEFAULT_SHOWCASES, type ProfileSettings } from '../../inertia/lib/invade_profile.js'

const settings = (overrides: Partial<ProfileSettings> = {}): ProfileSettings => ({
  bio: 'Ezreal one-trick in denial.',
  links: [],
  backdrop: null,
  avatar: 'backdrop',
  accent: 'violet',
  frame: false,
  showcases: DEFAULT_SHOWCASES.map((s) => ({ ...s })),
  favorites: [],
  ...overrides,
})

/**
 * Invade profiles (`/u/<handle>`): who sees what (League accounts only as the owner allows),
 * the tabs as addresses, the owner's Customize saves with Invade+ gating, verified pros.
 */
test.group('Invade profiles', (group) => {
  group.tap((t) => t.tags(['@profiles']))
  const prefix = writeLimiter.prefix
  let seed: DesktopSeed
  let people: ProfileSeed

  group.each.setup(() => {
    seed = new DesktopSeed()
    people = new ProfileSeed()
    writeLimiter.prefix = `profile:rl:test:${randomUUID()}:`
    skinCatalogue.use(fakeCatalogue())
  })
  group.each.teardown(async () => {
    writeLimiter.prefix = prefix
    skinCatalogue.use(null)
    await db.from('admin.entitlement').where('label', 'like', 'test:%').delete()
    await people.cleanup()
    await seed.cleanup()
  })

  const grant = (person: Person, kind: 'premium' | 'beta') =>
    db.table('admin.entitlement').insert({ kind, user_id: person.id, label: `test:${kind}` })

  /** The person's own app read these skins (§13), so they own them. */
  async function owns(person: Person, skins: number[]) {
    const player = await seed.player()
    await people.own(person, player.puuid, { main: false })
    await db
      .table('invade_collection_read')
      .insert({ puuid: player.puuid, user_id: person.id, read_at: new Date() })
    await db
      .table('invade_owned_skin')
      .multiInsert(skins.map((id) => ({ puuid: player.puuid, skin_id: id })))
  }

  function save(http: any, person: Person | null, body: unknown, origin = accountOrigin()) {
    const request = http.put('/api/profile').header('Origin', origin)
    if (person) request.withCookie('invade_session', person.token)
    return request.json(body)
  }

  test('the address: unknown handles and tabs are not found, the canonical one is lower case', async ({
    client,
  }) => {
    const ember = await people.person()
    await expectStatus(client.get(`/u/${ember.handle}`), 200)
    await expectStatus(client.get(`/u/${ember.handle}/skins`), 200)
    await expectStatus(client.get('/u/nobody_here_at_all'), 404)
    await expectStatus(client.get(`/u/${ember.handle}/nope`), 404)
    await expectStatus(client.get(`/u/${ember.handle}/overview`), 404)
    const upper = await client.get(`/u/${ember.handle.toUpperCase()}/skins`).redirects(0)
    upper.assertStatus(301)
    upper.assertHeader('location', `/u/${ember.handle}/skins`)
  })

  test('a League account shows only when its owner shows it', async ({ assert }) => {
    const ember = await people.person()
    const main = await seed.player()
    const hidden = await seed.player()
    await people.own(ember, main.puuid)
    await people.own(ember, hidden.puuid, { shown: false, main: false })

    const page = await profileService.page(ember.handle, 'overview', null)
    assert.deepEqual(
      page!.head.plates.map((p) => p.puuid),
      [main.puuid]
    )
    assert.isTrue(page!.head.plates[0].main)
    assert.equal(page!.head.platform, 'EUW1')
    assert.notInclude(JSON.stringify(page), hidden.puuid)

    // Every account hidden: no plate, no region, and none of them anywhere in the page.
    await db.from('invade_owned_account').where('puuid', main.puuid).update({ shown: false })
    const none = await profileService.page(ember.handle, 'overview', null)
    assert.lengthOf(none!.head.plates, 0)
    assert.isNull(none!.head.platform)
    assert.notInclude(JSON.stringify(none), main.puuid)
  })

  test('the owner customises; visitors and other origins cannot', async ({ client, assert }) => {
    const ember = await people.person()
    const briar = await people.person('Briar')
    await expectStatus(save(client, null, settings()), 401)
    const foreign = await save(client, ember, settings(), 'https://evil.example')
    foreign.assertStatus(403)
    assert.equal(foreign.body().errors[0].code, 'E_ORIGIN')

    const saved = await save(
      client,
      ember,
      settings({
        bio: '  bot lane,\n late nights  ',
        links: [{ kind: 'twitch', handle: '@emberplays' }],
      })
    )
    saved.assertStatus(200)
    assert.equal(saved.body().bio, 'bot lane, late nights')
    assert.deepEqual(saved.body().links, [{ kind: 'twitch', handle: 'emberplays' }])

    const page = await profileService.page(ember.handle, 'overview', {
      id: briar.id,
      name: briar.name,
    })
    assert.equal(page!.head.bio, 'bot lane, late nights')
    assert.equal(page!.head.links[0].url, 'https://www.twitch.tv/emberplays')
    assert.isFalse(page!.head.owner)
    assert.isNull(page!.customize)
    const own = await profileService.page(ember.handle, 'overview', {
      id: ember.id,
      name: ember.name,
    })
    assert.isTrue(own!.head.owner)
    assert.isNotNull(own!.customize)
  })

  test('bad choices are refused with a reason', async ({ client, assert }) => {
    const ember = await people.person()
    const refusals: [Partial<ProfileSettings>, RegExp][] = [
      [{ bio: 'x'.repeat(161) }, /160 characters/],
      [{ links: [{ kind: 'x', handle: 'not a handle!' }] }, /not a X name/],
      [
        {
          links: [
            { kind: 'x', handle: 'a' },
            { kind: 'x', handle: 'b' },
          ],
        },
        /One link per network/,
      ],
      [{ backdrop: SKINS.kdaAhri }, /skins you own/],
      [{ favorites: [SKINS.kdaAhri, SKINS.kdaAhri] }, /four different skins/],
      [{ favorites: [999_999] }, /four different skins/],
    ]
    for (const [change, message] of refusals) {
      const response = await save(client, ember, settings(change))
      response.assertStatus(422)
      assert.match(response.body().errors[0].message, message)
    }
    const shape = await save(client, ember, { ...settings(), accent: 'neon' })
    shape.assertStatus(422)
  })

  test('Invade+ choices need Invade+, and fall back when it ends', async ({ client, assert }) => {
    const ember = await people.person()
    const plus = settings({
      accent: 'rose',
      frame: true,
      showcases: DEFAULT_SHOWCASES.map((s) => ({ ...s, on: true })),
    })
    for (const change of [
      { accent: 'rose' as const },
      { frame: true },
      { showcases: DEFAULT_SHOWCASES.map((s) => ({ ...s, on: s.key === 'season' || s.on })) },
    ]) {
      const response = await save(client, ember, settings(change))
      response.assertStatus(422)
      assert.match(response.body().errors[0].message, /Invade\+/)
    }

    await grant(ember, 'premium')
    await expectStatus(save(client, ember, plus), 200)
    const premium = await profileService.page(ember.handle, 'overview', null)
    assert.equal(premium!.head.accent, 'rose')
    assert.isTrue(premium!.head.frame)
    assert.deepInclude(premium!.head.badges, { kind: 'plus', label: 'Invade+' })
    assert.include(premium!.overview!.showcases, 'season')

    // The grant ends: the choices stay stored, the page shows the free ones.
    await db.from('admin.entitlement').where('user_id', ember.id).update({ revoked_at: new Date() })
    const lapsed = await profileService.page(ember.handle, 'overview', null)
    assert.equal(lapsed!.head.accent, 'violet')
    assert.isFalse(lapsed!.head.frame)
    assert.notInclude(lapsed!.overview!.showcases, 'season')
    const stored = await profileService.settings(ember.id)
    assert.equal(stored.accent, 'rose')
  })

  test('the backdrop and avatar come from a skin the person owns', async ({ client, assert }) => {
    const ember = await people.person()
    await owns(ember, [SKINS.faerieCourtEzreal])
    await expectStatus(save(client, ember, settings({ backdrop: SKINS.faerieCourtEzreal })), 200)
    const page = await profileService.page(ember.handle, 'overview', null)
    assert.deepEqual(page!.head.backdrop, {
      url: '/cdn/splash/991-33.jpg',
      skin: SKINS.faerieCourtEzreal,
    })
    assert.equal(page!.head.avatarUrl, '/cdn/tile/991-33.jpg')

    // The skin leaves the collection (a newer read without it): the backdrop goes with it.
    await db.from('invade_owned_skin').where('skin_id', SKINS.faerieCourtEzreal).delete()
    const after = await profileService.page(ember.handle, 'overview', null)
    assert.isNull(after!.head.backdrop?.skin ?? null)
  })

  test('a beta grant on one of the League accounts shows the badge', async ({ assert }) => {
    const ember = await people.person()
    const player = await seed.player()
    await people.own(ember, player.puuid)
    await db
      .table('admin.entitlement')
      .insert({ kind: 'beta', puuid: player.puuid, label: 'test:beta' })
    const page = await profileService.page(ember.handle, 'overview', null)
    assert.deepEqual(page!.head.badges, [{ kind: 'beta', label: 'Beta tester' }])
  })

  test('a verified pro shows the pro, their accounts and their tabs', async ({ assert }) => {
    const caps = await people.person('Caps')
    const pro = await people.pro('Caps')
    assert.equal(await verifyPro(caps.handle, 'no-such-pro'), 'no-pro')
    assert.equal(await verifyPro('nobody_here_at_all', pro.slug), 'no-account')
    assert.equal(await verifyPro(caps.handle.toUpperCase(), pro.slug), 'linked')
    const other = await people.person('Impostor')
    assert.equal(await verifyPro(other.handle, pro.slug), 'pro-taken')

    const page = await profileService.page(caps.handle, 'overview', null)
    assert.equal(page!.head.pro?.slug, pro.slug)
    assert.equal(page!.head.pro?.accounts[0].tier, 'MASTER')
    assert.deepEqual(page!.tabs, ['overview', 'solo', 'champions', 'career'])
    assert.isNotNull(page!.pro)

    assert.isTrue(await unverifyPro(caps.handle))
    const plain = await profileService.page(caps.handle, 'overview', null)
    assert.isNull(plain!.head.pro)
  })

  test('a tab the profile does not have opens the overview', async ({ assert }) => {
    const ember = await people.person()
    const page = await profileService.page(ember.handle, 'solo', null)
    assert.equal(page!.tab, 'overview')
  })
})
