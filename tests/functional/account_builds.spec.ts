import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import riotAssets from '#services/riot/assets'
import rateLimiter from '#services/desktop/rate_limiter'
import replayGuard from '#services/desktop/signing'
import { loadProfileBuilds } from '#services/builds/profile_builds'
import { DesktopSeed } from '#tests/fixtures/desktop_db'
import { AccountSeed, pageProps, site } from '#tests/fixtures/accounts'

const ITEMS = [1055, 2003, 3006, 3031, 3094, 3036, 3072, 3046, 6672]
/** A version 2 build link's items and max order, as the app writes them. */
const CODE = 's1055,2003-b3006-c6672,3031,3094-l3036-l3072,3046-mqew'

/** A build as the app sends it (§14). */
const build = (overrides: Record<string, unknown> = {}) => ({
  localId: randomUUID(),
  championId: 222,
  lane: 'bottom',
  name: 'Crit into tanks',
  code: CODE,
  updatedAt: new Date().toISOString(),
  shared: true,
  ...overrides,
})

/**
 * Builds on Invade accounts (docs/desktop-sync.md §14): the app's whole set synced, each build
 * checked against the game data, a shared build's page with its counts, Save to my builds, and
 * what a profile shows.
 */
test.group('Account builds', (group) => {
  group.tap((t) => t.tags(['@accounts']))
  const prefixes = { limiter: rateLimiter.prefix, replay: replayGuard.prefix }
  const { names, championKeys } = riotAssets
  let seed: DesktopSeed
  let accounts: AccountSeed

  group.each.setup(() => {
    seed = new DesktopSeed()
    accounts = new AccountSeed(seed)
    rateLimiter.prefix = `desktop:rl:test:${randomUUID()}:`
    replayGuard.prefix = `desktop:sig:test:${randomUUID()}:`
    riotAssets.championKeys = async () => ({ jinx: '222', ahri: '103' })
    riotAssets.names = (async (kind: string) =>
      kind === 'champion'
        ? { 222: 'Jinx', 103: 'Ahri' }
        : Object.fromEntries(ITEMS.map((id) => [id, `Item ${id}`]))) as typeof names
  })
  group.each.teardown(async () => {
    rateLimiter.prefix = prefixes.limiter
    replayGuard.prefix = prefixes.replay
    Object.assign(riotAssets, { names, championKeys })
    await accounts.cleanup()
    await seed.cleanup()
  })

  test('the app syncs its whole set: new, changed and removed builds', async ({
    client: http,
    assert,
  }) => {
    const me = await accounts.person()
    const { app } = await accounts.connected(http, me)
    const [a, b] = [build(), build({ name: 'Lethal', shared: false })]

    const first = await app.put('/api/desktop/builds', { builds: [a, b] })
    first.assertStatus(200)
    const synced = first.body().builds as Array<Record<string, unknown>>
    assert.sameMembers(
      synced.map((s) => s.localId),
      [a.localId, b.localId]
    )
    const idOfA = synced.find((s) => s.localId === a.localId)!.id as string
    assert.match(idOfA, /^[A-Za-z0-9]{10}$/)
    assert.equal(new URL(String(synced[0].url)).pathname, `/build/${synced[0].id}`)
    assert.deepEqual(Object.keys(synced[0]).sort(), ['id', 'imports', 'localId', 'opens', 'url'])

    // A changed build keeps its page; an absent one leaves the account.
    const second = await app.put('/api/desktop/builds', {
      builds: [{ ...a, name: 'Crit, renamed', updatedAt: new Date().toISOString() }],
    })
    second.assertStatus(200)
    assert.deepEqual(
      second.body().builds.map((s: { id: string }) => s.id),
      [idOfA]
    )
    const listed = await app.get('/api/desktop/builds')
    assert.deepEqual(
      listed.body().builds.map((s: { name: string; savedFrom: unknown }) => [s.name, s.savedFrom]),
      [['Crit, renamed', null]]
    )

    const emptied = await app.put('/api/desktop/builds', { builds: [] })
    assert.lengthOf(emptied.body().builds, 0)
  })

  test('a build the app would not make is refused, and nothing changes', async ({
    client: http,
    assert,
  }) => {
    const me = await accounts.person()
    const { app } = await accounts.connected(http, me)
    const first = await app.put('/api/desktop/builds', { builds: [build()] })
    first.assertStatus(200)
    for (const bad of [
      build({ localId: 'nope' }),
      build({ lane: 'adc' }),
      build({ championId: 99999 }),
      build({ code: 'c9999999' }),
      build({ code: 'zz' }),
      build({ shared: 'yes' }),
      build({ updatedAt: 'yesterday' }),
    ]) {
      const response = await app.put('/api/desktop/builds', { builds: [bad] })
      response.assertStatus(422)
      assert.equal(response.body().errors[0].code, 'E_ACCOUNT_INVALID')
    }
    const twice = build()
    const duplicate = await app.put('/api/desktop/builds', { builds: [twice, twice] })
    duplicate.assertStatus(422)
    const tooMany = await app.put('/api/desktop/builds', {
      builds: Array.from({ length: 201 }, () => build()),
    })
    tooMany.assertStatus(422)
    const kept = await db.from('invade_build').where('user_id', me.id)
    assert.lengthOf(kept, 1)
  })

  test('a shared build has a page; a private one is only its owner', async ({
    client: http,
    assert,
  }) => {
    const [me, other] = [await accounts.person(), await accounts.person('Briar')]
    const { app } = await accounts.connected(http, me)
    const [open, hidden] = [build(), build({ shared: false })]
    const put = await app.put('/api/desktop/builds', { builds: [open, hidden] })
    const synced = put.body().builds as Array<{ localId: string; id: string }>
    const id = (b: { localId: string }) => synced.find((s) => s.localId === b.localId)!.id

    const page = await http.get(`/build/${id(open)}`)
    page.assertStatus(200)
    const props = pageProps(page.text())
    assert.equal(props.build.name, 'Crit into tanks')
    assert.equal(props.account.author.handle, me.handle)
    assert.isFalse(props.account.mine)
    assert.include(page.text(), `/build/${id(open)}`)
    const anonymous = await http.get(`/build/${id(hidden)}`)
    anonymous.assertStatus(404)
    const someoneElse = await site(http, other).get(`/build/${id(hidden)}`)
    someoneElse.assertStatus(404)
    const own = await site(http, me).get(`/build/${id(hidden)}`)
    own.assertStatus(200)
    assert.isTrue(pageProps(own.text()).account.mine)
    const unknown = await http.get('/build/0000000000')
    unknown.assertStatus(404)
  })

  test('opens count once a day per visitor, never the owner', async ({ client: http, assert }) => {
    const me = await accounts.person()
    const { app } = await accounts.connected(http, me)
    const put = await app.put('/api/desktop/builds', { builds: [build()] })
    const [synced] = put.body().builds
    const keys = await redis.keys(`build:open:${synced.id}:*`)
    if (keys.length) await redis.del(...keys)

    await http.get(`/build/${synced.id}`)
    await http.get(`/build/${synced.id}`)
    await site(http, me).get(`/build/${synced.id}`)
    const row = await db.from('invade_build').where('id', synced.id).first()
    assert.equal(row.opens, 1)
    await redis.del(...(await redis.keys(`build:open:${synced.id}:*`)))
  })

  test('Save to my builds: another person, once, and it counts as an import', async ({
    client: http,
    assert,
  }) => {
    const [me, other] = [await accounts.person(), await accounts.person('Briar')]
    const mine = await accounts.connected(http, me)
    const theirs = await accounts.connected(http, other)
    const put = await mine.app.put('/api/desktop/builds', { builds: [build()] })
    const [synced] = put.body().builds
    const path = `/api/builds/${synced.id}/save`

    const foreign = await http.put(path)
    foreign.assertStatus(403)
    const self = await site(http, me).put(path)
    self.assertStatus(422)
    for (let i = 0; i < 2; i++) {
      const save = await site(http, other).put(path)
      save.assertStatus(200)
    }

    const listed = await theirs.app.get('/api/desktop/builds')
    const [saved] = listed.body().builds
    assert.equal(saved.id, synced.id)
    assert.deepEqual(saved.savedFrom, { name: 'Ember', handle: me.handle })
    assert.equal(saved.code, CODE)
    assert.equal(saved.imports, 1)

    // Not shared any more: it leaves the other person's builds.
    await mine.app.put('/api/desktop/builds', {
      builds: [{ ...build(), localId: synced.localId, shared: false }],
    })
    const after = await theirs.app.get('/api/desktop/builds')
    assert.lengthOf(after.body().builds, 0)
    const gone = await site(http, other).put(path)
    gone.assertStatus(404)
    const letGo = await site(http, other).delete(path)
    letGo.assertStatus(200)
  })

  test('a profile shows the shared builds, all of them to their owner', async ({
    client: http,
    assert,
  }) => {
    const [me, other] = [await accounts.person(), await accounts.person('Briar')]
    const { app } = await accounts.connected(http, me)
    await app.put('/api/desktop/builds', {
      builds: [build({ name: 'Open' }), build({ name: 'Mine only', shared: false })],
    })
    const seen = await loadProfileBuilds(me.id, other.id)
    assert.deepEqual(
      seen.map((b) => b.name),
      ['Open']
    )
    assert.deepEqual(seen[0].items, {
      start: [1055, 2003],
      boots: 3006,
      core: [6672, 3031, 3094],
      later: [3036, 3072],
    })
    assert.equal(seen[0].skillOrder, 'QEW')
    assert.equal(seen[0].lane, 'bottom')
    const own = await loadProfileBuilds(me.id, me.id)
    assert.sameMembers(
      own.map((b) => b.name),
      ['Open', 'Mine only']
    )
  })
})
