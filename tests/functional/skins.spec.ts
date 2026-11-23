import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import { accountOrigin } from '#services/accounts/session_service'
import { writeLimiter } from '#services/profiles/browser_writes'
import skinCatalogue from '#services/skins/skin_catalogue'
import { hub, listPage, profileSkins, skinPage } from '#services/skins/skin_pages'
import { DesktopSeed } from '#tests/fixtures/desktop_db'
import {
  ProfileSeed,
  SKINS,
  expectStatus,
  fakeCatalogue,
  type Person,
} from '#tests/fixtures/profiles'
import { SKIN_LIMITS } from '../../inertia/lib/skin_types.js'

/**
 * Skins as players rate them: half-star ratings, reviews and their likes, likes, the wishlist,
 * lists; the pages that add them up; "owned" only from the app; and who may write what.
 */
test.group('Skins', (group) => {
  group.tap((t) => t.tags(['@skins']))
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
    await people.cleanup()
    await seed.cleanup()
  })

  function write(
    http: any,
    person: Person | null,
    method: 'put' | 'post' | 'patch' | 'delete',
    url: string,
    body?: unknown
  ) {
    const request = http[method](url).header('Origin', accountOrigin())
    if (person) request.withCookie('invade_session', person.token)
    return body === undefined ? request : request.json(body)
  }
  const viewer = (p: Person) => ({ id: p.id, name: p.name })

  test('the pages answer, and a skin the game does not have is not found', async ({ client }) => {
    await expectStatus(client.get('/skins'), 200)
    await expectStatus(client.get('/skins?q=kda'), 200)
    await expectStatus(client.get(`/skins/${SKINS.firestarterAhri}`), 200)
    await expectStatus(client.get('/skins/999999'), 404)
    await expectStatus(client.get('/skins/103000'), 404)
    await expectStatus(client.get(`/skins/lists/${randomUUID()}`), 404)
    await expectStatus(client.get('/skins/lists/not-a-list'), 404)
    const search = await client.get('/api/skins/search?q=firestarter')
    search.assertStatus(200)
    search.assertBodyContains({
      skins: [{ id: SKINS.firestarterAhri }, { id: SKINS.firestarterEvelynn }],
    })
    await expectStatus(client.get('/api/skins/search'), 422)
  })

  test('half-star ratings add up, and can be taken back', async ({ client, assert }) => {
    const [ember, briar] = [await people.person(), await people.person('Briar')]
    const url = `/api/skins/${SKINS.firestarterAhri}/rating`
    await expectStatus(write(client, ember, 'put', url, { rating: 9 }), 204)
    await expectStatus(write(client, briar, 'put', url, { rating: 6 }), 204)
    await expectStatus(write(client, ember, 'put', url, { rating: 10 }), 204)
    let page = await skinPage(SKINS.firestarterAhri, viewer(ember))
    assert.equal(page!.ratings.count, 2)
    assert.equal(page!.ratings.average, 4)
    assert.equal(page!.ratings.histogram[9], 1)
    assert.equal(page!.viewer!.rating, 10)
    assert.deepEqual(page!.place, { rank: 1, of: 3 })
    await expectStatus(write(client, ember, 'put', url, { rating: null }), 204)
    page = await skinPage(SKINS.firestarterAhri, viewer(ember))
    assert.equal(page!.ratings.count, 1)
    assert.isNull(page!.viewer!.rating)

    for (const rating of [0, 11, 4.5, 'five']) {
      await expectStatus(write(client, ember, 'put', url, { rating }), 422)
    }
    await expectStatus(write(client, ember, 'put', '/api/skins/999999/rating', { rating: 5 }), 404)
  })

  test('a write needs a session from the site itself', async ({ client, assert }) => {
    const ember = await people.person()
    const url = `/api/skins/${SKINS.kdaAhri}/like`
    const anonymous = await write(client, null, 'put', url, { on: true })
    anonymous.assertStatus(401)
    assert.equal(anonymous.body().errors[0].code, 'E_SIGNED_OUT')
    const foreign = await client
      .put(url)
      .header('Origin', 'https://evil.example')
      .withCookie('invade_session', ember.token)
      .json({ on: true })
    foreign.assertStatus(403)
    assert.equal(foreign.body().errors[0].code, 'E_ORIGIN')
  })

  test('a review is one per person and skin, liked by others, gone when emptied', async ({
    client,
    assert,
  }) => {
    const [ember, briar] = [await people.person(), await people.person('Briar')]
    const url = `/api/skins/${SKINS.firestarterAhri}/review`
    const first = await write(client, ember, 'put', url, {
      body: '  the obsidian chroma\n\n\n\nalone  ',
    })
    first.assertStatus(200)
    const id = first.body().id
    const again = await write(client, ember, 'put', url, { body: 'is a personality' })
    assert.equal(again.body().id, id)
    await expectStatus(
      write(client, ember, 'put', url, { body: 'x'.repeat(SKIN_LIMITS.review + 1) }),
      422
    )
    await expectStatus(
      write(client, briar, 'put', `/api/skin-reviews/${id}/like`, { on: true }),
      204
    )
    await expectStatus(
      write(client, briar, 'put', `/api/skin-reviews/${id}/like`, { on: true }),
      204
    )
    await expectStatus(
      write(client, briar, 'put', `/api/skin-reviews/${randomUUID()}/like`, { on: true }),
      404
    )
    const page = await skinPage(SKINS.firestarterAhri, viewer(briar))
    assert.equal(page!.reviews.total, 1)
    assert.equal(page!.reviews.popular[0].body, 'is a personality')
    assert.equal(page!.reviews.popular[0].likes, 1)
    assert.isTrue(page!.reviews.popular[0].liked)
    assert.isFalse(page!.reviews.popular[0].mine)

    const cleared = await write(client, ember, 'put', url, { body: '   ' })
    assert.isNull(cleared.body().id)
    assert.equal((await skinPage(SKINS.firestarterAhri, null))!.reviews.total, 0)
  })

  test('"Owns it" and Owned come only from the app\'s read', async ({ client, assert }) => {
    const ember = await people.person()
    await expectStatus(
      write(client, ember, 'put', `/api/skins/${SKINS.kdaAhri}/review`, { body: 'clean' }),
      200
    )
    let page = await skinPage(SKINS.kdaAhri, viewer(ember))
    assert.isNull(page!.viewer!.owned, 'unknown before the app read anything')
    assert.isFalse(page!.reviews.recent[0].owns)

    const player = await seed.player()
    await people.own(ember, player.puuid)
    await db
      .table('invade_collection_read')
      .insert({ puuid: player.puuid, user_id: ember.id, read_at: new Date() })
    await db.table('invade_owned_skin').insert({
      puuid: player.puuid,
      skin_id: SKINS.kdaAhri,
      purchased_at: new Date('2026-11-04T21:00:00Z'),
    })
    page = await skinPage(SKINS.kdaAhri, viewer(ember))
    assert.isTrue(page!.viewer!.owned)
    assert.isTrue(page!.reviews.recent[0].owns)
    assert.isFalse((await skinPage(SKINS.firestarterAhri, viewer(ember)))!.viewer!.owned)

    const tab = await profileSkins(ember.id, null, [])
    assert.equal(tab.collection?.owned, 1)
    assert.equal(tab.diary[0].skin.id, SKINS.kdaAhri)
    assert.equal(tab.diary[0].purchasedAt, '2026-11-04T21:00:00.000Z')
  })

  test('likes and the wishlist, with its limit', async ({ client, assert }) => {
    const ember = await people.person()
    await expectStatus(
      write(client, ember, 'put', `/api/skins/${SKINS.kdaAhri}/like`, { on: true }),
      204
    )
    await expectStatus(
      write(client, ember, 'put', `/api/skins/${SKINS.kdaAhri}/wish`, { on: true }),
      204
    )
    await expectStatus(
      write(client, ember, 'put', `/api/skins/${SKINS.kdaAhri}/wish`, { on: true }),
      204
    )
    let page = await skinPage(SKINS.kdaAhri, viewer(ember))
    assert.isTrue(page!.viewer!.liked)
    assert.isNotNull(page!.viewer!.wishedAt)
    const tab = await profileSkins(ember.id, null, [])
    assert.equal(tab.wishlistTotal, 1)
    await expectStatus(
      write(client, ember, 'put', `/api/skins/${SKINS.kdaAhri}/wish`, { on: false }),
      204
    )
    page = await skinPage(SKINS.kdaAhri, viewer(ember))
    assert.isNull(page!.viewer!.wishedAt)

    await db.table('invade_skin_wish').multiInsert(
      Array.from({ length: SKIN_LIMITS.wishlist }, (_, i) => ({
        user_id: ember.id,
        skin_id: 1_000 + i,
      }))
    )
    const full = await write(client, ember, 'put', `/api/skins/${SKINS.kdaAhri}/wish`, { on: true })
    full.assertStatus(422)
    assert.equal(full.body().errors[0].code, 'E_ACCOUNT_LIMIT')
  })

  test('lists: made, filled and emptied by their owner only, liked by anyone', async ({
    client,
    assert,
  }) => {
    const [ember, briar] = [await people.person(), await people.person('Briar')]
    const made = await write(client, ember, 'post', '/api/skin-lists', {
      title: ' Every K/DA skin, ranked ',
      body: 'loud',
    })
    made.assertStatus(201)
    const id = made.body().id
    for (const skin of [SKINS.kdaAhri, SKINS.firestarterAhri, SKINS.kdaAhri]) {
      await expectStatus(
        write(client, ember, 'put', `/api/skin-lists/${id}/skins/${skin}`, { on: true }),
        204
      )
    }
    await expectStatus(
      write(client, briar, 'put', `/api/skin-lists/${id}/skins/${SKINS.kdaKaisa}`, {
        on: true,
      }),
      404
    )
    await expectStatus(
      write(client, briar, 'patch', `/api/skin-lists/${id}`, { title: 'mine now' }),
      404
    )
    await expectStatus(write(client, briar, 'delete', `/api/skin-lists/${id}`), 404)
    await expectStatus(write(client, briar, 'put', `/api/skin-lists/${id}/like`, { on: true }), 204)
    await expectStatus(write(client, ember, 'post', '/api/skin-lists', { title: '' }), 422)

    let list = await listPage(id, viewer(briar))
    assert.equal(list!.title, 'Every K/DA skin, ranked')
    assert.deepEqual(
      list!.skins.map((s) => s.id),
      [SKINS.kdaAhri, SKINS.firestarterAhri]
    )
    assert.equal(list!.likes, 1)
    assert.isTrue(list!.liked)
    assert.isFalse(list!.mine)
    assert.lengthOf((await skinPage(SKINS.kdaAhri, null))!.lists, 1)
    await expectStatus(
      write(client, ember, 'patch', `/api/skin-lists/${id}`, { title: 'K/DA, ranked' }),
      204
    )
    await expectStatus(
      write(client, ember, 'put', `/api/skin-lists/${id}/skins/${SKINS.kdaAhri}`, {
        on: false,
      }),
      204
    )
    list = await listPage(id, viewer(ember))
    assert.equal(list!.title, 'K/DA, ranked')
    assert.deepEqual(
      list!.skins.map((s) => s.id),
      [SKINS.firestarterAhri]
    )
    assert.isTrue(list!.mine)
    await expectStatus(write(client, ember, 'delete', `/api/skin-lists/${id}`), 204)
    assert.isNull(await listPage(id, null))
  })

  test('a list holds a limited number of skins, a person a limited number of lists', async ({
    client,
    assert,
  }) => {
    const ember = await people.person()
    const made = await write(client, ember, 'post', '/api/skin-lists', { title: 'All of them' })
    const id = made.body().id
    await db.table('invade_skin_list_item').multiInsert(
      Array.from({ length: SKIN_LIMITS.listSkins }, (_, i) => ({
        list_id: id,
        skin_id: 1_000 + i,
        position: i + 1,
      }))
    )
    const full = await write(client, ember, 'put', `/api/skin-lists/${id}/skins/${SKINS.kdaAhri}`, {
      on: true,
    })
    full.assertStatus(422)
    assert.equal(full.body().errors[0].code, 'E_ACCOUNT_LIMIT')

    await db.table('invade_skin_list').multiInsert(
      Array.from({ length: SKIN_LIMITS.lists - 1 }, (_, i) => ({
        user_id: ember.id,
        title: `List ${i}`,
      }))
    )
    const many = await write(client, ember, 'post', '/api/skin-lists', { title: 'One more' })
    many.assertStatus(422)
  })

  test("the hub: the week, friends' activity, the best rated", async ({ client, assert }) => {
    const [ember, briar, stranger] = [
      await people.person(),
      await people.person('Briar'),
      await people.person('Glass'),
    ]
    await people.befriend(ember, briar)
    await expectStatus(
      write(client, briar, 'put', `/api/skins/${SKINS.kdaKaisa}/rating`, { rating: 10 }),
      204
    )
    await expectStatus(
      write(client, briar, 'put', `/api/skins/${SKINS.kdaAhri}/wish`, { on: true }),
      204
    )
    await expectStatus(
      write(client, stranger, 'put', `/api/skins/${SKINS.darkCosmicJhin}/rating`, {
        rating: 4,
      }),
      204
    )

    const data = await hub(viewer(ember))
    assert.lengthOf(data.popular, 7)
    assert.equal(data.popular[0].id, SKINS.kdaKaisa)
    assert.equal(data.topRated[0].id, SKINS.kdaKaisa)
    assert.equal(data.total, fakeCatalogue().skins.size)
    assert.sameMembers(
      data.activity.map((a) => `${a.person.name} ${a.kind} ${a.skin.id}`),
      [`Briar rated ${SKINS.kdaKaisa}`, `Briar wished ${SKINS.kdaAhri}`]
    )
    // Strangers' marks never show as friends'.
    const theirs = await hub(viewer(stranger))
    assert.lengthOf(theirs.activity, 0)
    const friends = (await skinPage(SKINS.kdaKaisa, viewer(ember)))!.friends
    assert.deepEqual(
      friends.map((f) => [f.person.name, f.rating]),
      [['Briar', 10]]
    )
  })

  test('deleting the person deletes their ratings, reviews, likes, wishes and lists', async ({
    client,
    assert,
  }) => {
    const ember = await people.person()
    await write(client, ember, 'put', `/api/skins/${SKINS.kdaAhri}/rating`, { rating: 8 })
    await write(client, ember, 'put', `/api/skins/${SKINS.kdaAhri}/review`, { body: 'fine' })
    await write(client, ember, 'put', `/api/skins/${SKINS.kdaAhri}/like`, { on: true })
    await write(client, ember, 'put', `/api/skins/${SKINS.kdaAhri}/wish`, { on: true })
    await write(client, ember, 'post', '/api/skin-lists', { title: 'gone' })
    await db.from('invade_user').where('id', ember.id).delete()
    for (const table of [
      'invade_skin_rating',
      'invade_skin_review',
      'invade_skin_like',
      'invade_skin_wish',
      'invade_skin_list',
    ]) {
      assert.isNull(await db.from(table).where('user_id', ember.id).first(), table)
    }
  })
})
