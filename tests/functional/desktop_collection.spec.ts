import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import rateLimiter from '#services/desktop/rate_limiter'
import replayGuard from '#services/desktop/signing'
import collectionService from '#services/skins/collection_service'
import skinCatalogue from '#services/skins/skin_catalogue'
import { DesktopSeed } from '#tests/fixtures/desktop_db'
import { signedHeaders } from '#tests/fixtures/desktop_http'
import {
  ProfileSeed,
  SKINS,
  expectStatus,
  fakeCatalogue,
  type Person,
} from '#tests/fixtures/profiles'

const PATH = '/api/desktop/collection'

/** `PUT` through the signed client (it only knows GET, POST and DELETE). */
function put(http: any, credentials: { token: string; secret: string }, payload: unknown) {
  const body = JSON.stringify(payload)
  return http
    .put(PATH)
    .headers(signedHeaders(credentials, 'PUT', PATH, body))
    .json(body)
}

/**
 * The collection read (docs/desktop-sync.md §13): only a League account the sending app saw
 * signed in to the client, owned by the person the app is connected to; the newest read replaces
 * the set; a person's collection is the union of their accounts'.
 */
test.group('Desktop collection', (group) => {
  group.tap((t) => t.tags(['@profiles']))
  const prefixes = { limiter: rateLimiter.prefix, replay: replayGuard.prefix }
  let seed: DesktopSeed
  let people: ProfileSeed

  group.each.setup(() => {
    seed = new DesktopSeed()
    people = new ProfileSeed()
    rateLimiter.prefix = `desktop:rl:test:${randomUUID()}:`
    replayGuard.prefix = `desktop:sig:test:${randomUUID()}:`
    skinCatalogue.use(fakeCatalogue())
  })
  group.each.teardown(async () => {
    rateLimiter.prefix = prefixes.limiter
    replayGuard.prefix = prefixes.replay
    skinCatalogue.use(null)
    await people.cleanup()
    await seed.cleanup()
  })

  /** A person, their connected app, and a League account that app saw in the client. */
  async function setup(person?: Person) {
    const owner = person ?? (await people.person())
    const device = await seed.device()
    await db.table('invade_device_user').insert({ device_id: device.device.id, user_id: owner.id })
    const player = await seed.player()
    await seed.link(device.device.id, player.puuid, randomUUID())
    await people.own(owner, player.puuid)
    return { owner, device, player }
  }

  const read = (
    puuid: string,
    skins: { id: number; purchasedAt: string | null }[],
    at = Date.now()
  ) => ({
    puuid,
    skins,
    readAt: new Date(at).toISOString(),
  })

  test('a proven account replaces its collection with the newest read', async ({
    client,
    assert,
  }) => {
    const { owner, device, player } = await setup()
    const first = await put(
      client,
      device,
      read(player.puuid, [
        { id: SKINS.firestarterAhri, purchasedAt: '2026-11-04T21:00:00.000Z' },
        { id: SKINS.kdaAhri, purchasedAt: null },
      ])
    )
    first.assertStatus(204)
    let owned = await collectionService.owned(owner.id)
    assert.sameMembers([...owned.keys()], [SKINS.firestarterAhri, SKINS.kdaAhri])
    assert.equal(owned.get(SKINS.firestarterAhri)?.toISOString(), '2026-11-04T21:00:00.000Z')

    // A newer read is the whole set: a skin missing from it is gone.
    const second = await put(
      client,
      device,
      read(player.puuid, [{ id: SKINS.kdaKaisa, purchasedAt: null }], Date.now() + 1000)
    )
    second.assertStatus(204)
    owned = await collectionService.owned(owner.id)
    assert.deepEqual([...owned.keys()], [SKINS.kdaKaisa])

    // An older read (a retry that arrived late) changes nothing.
    const stale = await put(
      client,
      device,
      read(player.puuid, [{ id: SKINS.kdaAhri, purchasedAt: null }], Date.now() - 60_000)
    )
    stale.assertStatus(204)
    owned = await collectionService.owned(owner.id)
    assert.deepEqual([...owned.keys()], [SKINS.kdaKaisa])
  })

  test('the collection is the union of the accounts the person still owns', async ({
    client,
    assert,
  }) => {
    const first = await setup()
    const second = await setup(first.owner)
    await expectStatus(
      put(
        client,
        first.device,
        read(first.player.puuid, [{ id: SKINS.kdaAhri, purchasedAt: null }])
      ),
      204
    )
    await expectStatus(
      put(
        client,
        second.device,
        read(second.player.puuid, [{ id: SKINS.psyopsEzreal, purchasedAt: null }])
      ),
      204
    )
    const both = await collectionService.owned(first.owner.id)
    assert.sameMembers([...both.keys()], [SKINS.kdaAhri, SKINS.psyopsEzreal])

    // "Not mine": that account's skins no longer count.
    await db
      .from('invade_owned_account')
      .where('puuid', second.player.puuid)
      .update({ removed_at: new Date() })
    const left = await collectionService.owned(first.owner.id)
    assert.deepEqual([...left.keys()], [SKINS.kdaAhri])

    const summary = await collectionService.summary(first.owner.id, fakeCatalogue())
    assert.equal(summary?.owned, 1)
    assert.equal(summary?.byRarity.epic, 1)
  })

  test('only an account this app saw in the client, owned by its person', async ({
    client,
    assert,
  }) => {
    const { device, player } = await setup()
    const stranger = await seed.player()
    const unknown = await put(client, device, read(stranger.puuid, []))
    unknown.assertStatus(403)
    assert.equal(unknown.body().errors[0].code, 'E_NOT_DETECTED')

    // Linked by Riot ID only: proves nothing.
    await seed.link(device.device.id, stranger.puuid, null)
    const byRiotId = await put(client, device, read(stranger.puuid, []))
    byRiotId.assertStatus(403)

    // Another person's account, even one this app saw.
    const other = await people.person('Briar')
    await db.from('invade_owned_account').where('puuid', player.puuid).update({ user_id: other.id })
    const taken = await put(client, device, read(player.puuid, []))
    taken.assertStatus(403)
    assert.equal(taken.body().errors[0].code, 'E_NOT_DETECTED')
  })

  test('an app without an account, or unsigned, is refused', async ({ client, assert }) => {
    const device = await seed.device()
    const player = await seed.player()
    const loose = await put(client, device, read(player.puuid, []))
    loose.assertStatus(403)
    assert.equal(loose.body().errors[0].code, 'E_NOT_CONNECTED')

    const unsigned = await client.put(PATH).json(read(player.puuid, []))
    unsigned.assertStatus(401)
    assert.equal(unsigned.body().errors[0].code, 'E_DEVICE_UNAUTHORIZED')
  })

  test('a malformed read is refused whole', async ({ client, assert }) => {
    const { device, player } = await setup()
    const shapes = [
      {
        puuid: player.puuid,
        skins: [{ id: 'x', purchasedAt: null }],
        readAt: new Date().toISOString(),
      },
      {
        puuid: player.puuid,
        skins: [{ id: 7, purchasedAt: null }],
        readAt: new Date().toISOString(),
      },
      { puuid: player.puuid, skins: [] },
    ]
    for (const body of shapes) {
      const response = await put(client, device, body)
      response.assertStatus(422)
      assert.equal(response.body().errors[0].code, 'E_VALIDATION_ERROR')
    }
    const future = await put(client, device, read(player.puuid, [], Date.now() + 3_600_000))
    future.assertStatus(422)
    const tooOld = await put(
      client,
      device,
      read(player.puuid, [{ id: SKINS.kdaAhri, purchasedAt: '2001-01-01T00:00:00.000Z' }])
    )
    tooOld.assertStatus(422)
    assert.equal(tooOld.body().errors[0].code, 'E_ACCOUNT_INVALID')
  })

  test('deleting the person deletes what their app sent', async ({ client, assert }) => {
    const { owner, device, player } = await setup()
    await expectStatus(
      put(client, device, read(player.puuid, [{ id: SKINS.kdaAhri, purchasedAt: null }])),
      204
    )
    await db.from('invade_user').where('id', owner.id).delete()
    assert.isNull(await db.from('invade_owned_skin').where('puuid', player.puuid).first())
    assert.isNull(await db.from('invade_collection_read').where('puuid', player.puuid).first())
  })
})
