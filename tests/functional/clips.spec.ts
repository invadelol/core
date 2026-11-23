import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ApiClient } from '@japa/api-client'
import db from '@adonisjs/lucid/services/db'
import rateLimiter from '#services/desktop/rate_limiter'
import replayGuard from '#services/desktop/signing'
import riotAssets from '#services/riot/assets'
import matchRepository from '#services/analytics/match_repository'
import accountService from '#services/accounts/account_service'
import clipService from '#services/clips/clip_service'
import { loadProfileClips } from '#services/clips/profile_clips'
import { notificationsOf } from '#services/clips/notifications'
import { LocalClipStore, useClipStore } from '#services/clips/storage'
import { DesktopSeed } from '#tests/fixtures/desktop_db'
import { desktopClient } from '#tests/fixtures/desktop_http'
import { AccountSeed, pageProps, site } from '#tests/fixtures/accounts'

/** The smallest file the checks take for an H.264 MP4: an `ftyp` box, then bytes. */
const mp4 = (size = 4096, codec = 'avc1') => {
  const bytes = Buffer.alloc(size, 0)
  bytes.write('ftypisom', 4, 'latin1')
  bytes.write(codec, 64, 'latin1')
  return bytes
}
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)])

/** A file sent to a signed upload address, as the app sends it: the bytes as they are. */
function putFile(http: ApiClient, url: string, bytes: Buffer) {
  const address = new URL(url)
  const request = http
    .put(address.pathname + address.search)
    .header('content-type', 'application/octet-stream')
  request.request.serialize((body: Buffer) => body as unknown as string).send(bytes)
  return request
}

const MATCH = 'EUW1_7000000001'
const GAME_START = 1_791_873_000_000

/** A clip as the app posts it (§11). */
const details = (overrides: Record<string, unknown> = {}) => ({
  matchId: MATCH,
  gameStartedAt: GAME_START,
  championId: 81,
  title: 'he really thought he had me',
  visibility: 'everyone',
  comments: 'everyone',
  clipStartMs: 541_000,
  durationMs: 21_000,
  replace: false,
  events: [
    { t: 552_300, kind: 'kill', killer: 'Ember#0002', victim: 'Lee Sin', assisters: [] },
    { t: 551_000, kind: 'objective', killer: 'Turret_T2_C_05', victim: null, detail: '' },
    { t: 100_000, kind: 'kill', killer: 'Ember#0002', victim: 'Ahri' },
    { t: 553_000, kind: 'dance', killer: 'Ember#0002' },
  ],
  ...overrides,
})

/**
 * Clips end to end (docs/desktop-sync.md §11, §12): posted by a connected app (details, both
 * files on their signed addresses, complete), one per game with replace, the files checked where
 * they are, the page and its files, who may watch, comments with one level of replies, GGs, what
 * the person is told about, a profile's clips, and deletion. The game lookups are stood in for.
 */
test.group('Clips', (group) => {
  group.tap((t) => t.tags(['@clips']))
  const prefixes = { limiter: rateLimiter.prefix, replay: replayGuard.prefix }
  const stand = {
    findGame: clipService.findGame,
    recap: clipService.recap,
    names: riotAssets.names,
    summary: matchRepository.getSummaryById,
  }
  let seed: DesktopSeed
  let accounts: AccountSeed
  let dir: string

  group.each.setup(async () => {
    seed = new DesktopSeed()
    accounts = new AccountSeed(seed)
    rateLimiter.prefix = `desktop:rl:test:${randomUUID()}:`
    replayGuard.prefix = `desktop:sig:test:${randomUUID()}:`
    dir = await mkdtemp(join(tmpdir(), 'clips-'))
    useClipStore(new LocalClipStore(dir))
    clipService.recap = async () => {}
    riotAssets.names = (async () => ({ 81: 'Ezreal', 64: 'Lee Sin', 103: 'Ahri' })) as never
  })
  group.each.teardown(async () => {
    rateLimiter.prefix = prefixes.limiter
    replayGuard.prefix = prefixes.replay
    Object.assign(clipService, { findGame: stand.findGame, recap: stand.recap })
    riotAssets.names = stand.names
    matchRepository.getSummaryById = stand.summary
    useClipStore(null)
    await accounts.cleanup()
    await seed.cleanup()
    await rm(dir, { recursive: true, force: true })
  })

  /** A person whose connected app owns a League account that played the game, and that app. */
  async function poster(http: ApiClient, name = 'Ember') {
    const person = await accounts.person(name)
    const player = await seed.player()
    const device = await accounts.connected(http, person)
    await accounts.owned(person, player.puuid)
    return { person, player, app: device.app }
  }

  /** The game: Ember's Ezreal against Lee Sin, and whoever else is named. */
  function game(players: { puuid: string; gameName: string; championId: number }[]) {
    clipService.findGame = async (puuids: string[]) => {
      const seat = players.find((p) => puuids.includes(p.puuid))
      return seat
        ? { matchId: MATCH, puuid: seat.puuid, championId: seat.championId, platform: 'EUW1' }
        : null
    }
    matchRepository.getSummaryById = (async () => ({
      matchId: MATCH,
      participants: players.map((p) => ({ ...p, tagLine: '0002' })),
    })) as never
  }

  /** Posts a clip from `app`, sends both files to their addresses, completes it. */
  async function post(http: ApiClient, app: ReturnType<typeof desktopClient>, extra = {}) {
    const created = await app.post('/api/desktop/clips', details(extra))
    created.assertStatus(201)
    const { clip, upload } = created.body()
    for (const [url, bytes] of [
      [upload.video, mp4()],
      [upload.poster, jpeg()],
    ] as const) {
      const sent = await putFile(http, url, bytes)
      sent.assertStatus(200)
    }
    const done = await app.post(`/api/desktop/clips/${clip.id}/complete`, {})
    done.assertStatus(200)
    return done.body()
  }

  test('a clip posts in three steps and goes online', async ({ client: http, assert }) => {
    const { person, player, app } = await poster(http)
    game([{ puuid: player.puuid, gameName: 'Ember', championId: 81 }])
    const created = await app.post('/api/desktop/clips', details())
    created.assertStatus(201)
    assert.equal(created.body().clip.status, 'uploading')
    assert.match(created.body().upload.video, /\/api\/clips\/upload\?key=clips%2F/)

    // Not online before its files are up.
    const early = await app.post(`/api/desktop/clips/${created.body().clip.id}/complete`, {})
    early.assertStatus(409)
    assert.equal(early.body().errors[0].code, 'E_CLIP_NOT_UPLOADED')
    await db.from('invade_clip').where('id', created.body().clip.id).delete()

    const clip = await post(http, app)
    assert.equal(clip.title, 'he really thought he had me')
    assert.equal(clip.moment, 'Solo kill on Lee Sin')
    // Inside the window only, known kinds only, champions only (no Riot ID kept).
    assert.deepEqual(
      clip.events.map((e: { kind: string; killer: number | null }) => [e.kind, e.killer]),
      [
        ['objective', null],
        ['kill', 81],
      ]
    )
    assert.notInclude(JSON.stringify(clip.events), 'Ember')

    const page = await http.get(`/clip/${clip.id}`)
    page.assertStatus(200)
    assert.include(page.text(), 'property="og:video"')
    assert.include(page.text(), `/og/clip/${clip.id}.jpg`)
    const video = await http.get(`/clips/${clip.id}.mp4`).header('Range', 'bytes=0-99')
    video.assertStatus(206)
    assert.equal(video.header('content-range'), 'bytes 0-99/4096')

    const mine = await app.get('/api/desktop/clips')
    assert.deepEqual(
      mine.body().clips.map((c: { id: string; status: string }) => [c.id, c.status]),
      [[clip.id, 'ready']]
    )
    const listed = await http.get(`/api/clips?match=${MATCH}`)
    assert.lengthOf(listed.body().clips, 1)
    assert.equal(listed.body().clips[0].author.handle, person.handle)
  })

  test('one clip per game: a second asks to replace the first', async ({
    client: http,
    assert,
  }) => {
    const { player, app } = await poster(http)
    game([{ puuid: player.puuid, gameName: 'Ember', championId: 81 }])
    const first = await post(http, app)
    const again = await app.post('/api/desktop/clips', details({ title: 'again' }))
    again.assertStatus(409)
    assert.equal(again.body().code, 'E_CLIP_EXISTS')
    assert.equal(again.body().existing.id, first.id)
    assert.equal(again.body().existing.comments, 0)

    const second = await post(http, app, { title: 'again', replace: true })
    assert.notEqual(second.id, first.id)
    const gone = await http.get(`/clip/${first.id}`)
    gone.assertStatus(404)
    const left = await db.from('invade_clip').where('match_id', MATCH)
    assert.deepEqual(
      left.map((c) => c.id),
      [second.id]
    )
  })

  test('the files are checked where they are', async ({ client: http, assert }) => {
    const { player, app } = await poster(http)
    game([{ puuid: player.puuid, gameName: 'Ember', championId: 81 }])
    const created = await app.post('/api/desktop/clips', details())
    const { clip, upload } = created.body()
    await putFile(http, upload.video, mp4(4096, 'hvc1'))
    await putFile(http, upload.poster, jpeg())
    const hevc = await app.post(`/api/desktop/clips/${clip.id}/complete`, {})
    hevc.assertStatus(422)
    assert.equal(hevc.body().errors[0].code, 'E_CLIP_HEVC')
    assert.isNull(await db.from('invade_clip').where('id', clip.id).first())

    // An upload address only works as it was signed.
    const forged = await putFile(http, upload.video.replace(/sig=[^&]+/, 'sig=nope'), mp4())
    forged.assertStatus(403)
  })

  test('details the app would not send are refused', async ({ client: http, assert }) => {
    const { player, app } = await poster(http)
    game([{ puuid: player.puuid, gameName: 'Ember', championId: 81 }])
    for (const bad of [
      { title: '' },
      { durationMs: 90_000 },
      { visibility: 'friends' },
      { comments: 'maybe' },
      { matchId: 'nope' },
    ]) {
      const response = await app.post('/api/desktop/clips', details(bad))
      response.assertStatus(422)
      assert.equal(response.body().errors[0].code, 'E_CLIP_INVALID')
    }
    game([])
    const noGame = await app.post('/api/desktop/clips', details())
    noGame.assertStatus(404)
    assert.equal(noGame.body().errors[0].code, 'E_CLIP_NO_GAME')
  })

  test('an Only me clip is its owner only, everywhere', async ({ client: http, assert }) => {
    const { person, player, app } = await poster(http)
    const other = await accounts.person('Briar')
    game([{ puuid: player.puuid, gameName: 'Ember', championId: 81 }])
    const clip = await post(http, app, { visibility: 'private' })
    for (const path of [`/clip/${clip.id}`, `/clips/${clip.id}.mp4`, `/clips/${clip.id}.jpg`]) {
      const anonymous = await http.get(path)
      anonymous.assertStatus(404)
      const stranger = await site(http, other).get(path)
      stranger.assertStatus(404)
    }
    const own = await site(http, person).get(`/clip/${clip.id}`)
    own.assertStatus(200)
    const listed = await http.get(`/api/clips?match=${MATCH}`)
    assert.lengthOf(listed.body().clips, 0)
    const seen = await loadProfileClips(person.id, other.id)
    assert.lengthOf(seen.clips, 0)
    const theirOwn = await loadProfileClips(person.id, person.id)
    assert.lengthOf(theirOwn.clips, 1)
  })

  test('comments: one level of replies, as the clip allows', async ({ client: http, assert }) => {
    const { person: ember, player, app } = await poster(http)
    const { person: copper, player: lee } = await poster(http, 'Copper Lane')
    const stranger = await accounts.person('Northwind')
    game([
      { puuid: player.puuid, gameName: 'Ember', championId: 81 },
      { puuid: lee.puuid, gameName: 'Copper Lane', championId: 64 },
    ])
    const clip = await post(http, app, { comments: 'game' })
    const path = `/api/clips/${clip.id}/comments`

    const outsider = await site(http, stranger).post(path).json({ body: 'nice' })
    outsider.assertStatus(403)
    assert.equal(outsider.body().errors[0].code, 'E_COMMENTS_GAME')

    const first = await site(http, copper)
      .post(path)
      .json({ body: 'one more auto and that was mine', atMs: 14_000 })
    first.assertStatus(200)
    const [top] = first.body().comments
    assert.equal(top.championId, 64)
    assert.equal(top.atMs, 14_000)

    const reply = await site(http, ember)
      .post(path)
      .json({ body: 'you walked into the E', parentId: top.id })
    reply.assertStatus(200)
    const [thread] = reply.body().comments
    assert.lengthOf(thread.replies, 1)
    assert.isTrue(thread.replies[0].byAuthor)

    // A reply is never answered itself.
    const deeper = await site(http, copper)
      .post(path)
      .json({ body: 'no', parentId: thread.replies[0].id })
    deeper.assertStatus(404)

    const patched = await site(http, ember).patch(`/api/clips/${clip.id}`).json({ comments: 'off' })
    patched.assertStatus(200)
    const off = await site(http, copper).post(path).json({ body: 'still here' })
    off.assertStatus(403)
    assert.equal(off.body().errors[0].code, 'E_COMMENTS_OFF')

    // Its writer or the clip's owner deletes a comment; with it go its replies.
    const removed = await site(http, ember).delete(`${path}/${top.id}`)
    removed.assertStatus(200)
    assert.lengthOf(removed.body().comments, 0)
  })

  test('GGs: once each, never one own, and what the owner is told', async ({
    client: http,
    assert,
  }) => {
    const { person: ember, player, app } = await poster(http)
    const briar = await accounts.person('Briar')
    game([{ puuid: player.puuid, gameName: 'Ember', championId: 81 }])
    const clip = await post(http, app)
    const own = await site(http, ember).put(`/api/clips/${clip.id}/gg`)
    own.assertStatus(422)
    for (let i = 0; i < 2; i++) {
      const gg = await site(http, briar).put(`/api/clips/${clip.id}/gg`)
      assert.deepEqual(gg.body(), { gg: 1, ggByViewer: true })
    }
    await site(http, briar).post(`/api/clips/${clip.id}/comments`).json({ body: 'clean' })
    await accountService.change(briar, [{ op: 'follow', kind: 'user', id: ember.id }], 'site')

    const told = await notificationsOf(ember.id)
    assert.sameMembers(
      told.items.map((n) => n.kind),
      ['gg', 'comment', 'follow']
    )
    assert.equal(told.items.find((n) => n.kind === 'comment')!.text, 'clean')
    assert.equal(told.items.find((n) => n.kind === 'gg')!.clip!.id, clip.id)
    // Asked again after the newest: nothing new.
    const after = await notificationsOf(ember.id, told.cursor)
    assert.lengthOf(after.items, 0)
    assert.equal(after.cursor, told.cursor)

    const viaApp = await app.get('/api/desktop/notifications')
    viaApp.assertStatus(200)
    assert.lengthOf(viaApp.body().items, 3)
    const theirs = await notificationsOf(briar.id)
    assert.lengthOf(theirs.items, 0)
  })

  test('a profile shows the public clips and the pinned one', async ({ client: http, assert }) => {
    const { person, player, app } = await poster(http)
    game([{ puuid: player.puuid, gameName: 'Ember', championId: 81 }])
    const clip = await post(http, app)
    const pin = await site(http, person).put(`/api/clips/${clip.id}/pin`)
    pin.assertStatus(204)
    const shown = await loadProfileClips(person.id, null)
    assert.equal(shown.pinned?.id, clip.id)
    assert.equal(shown.clips[0].moment, 'Solo kill on Lee Sin')
    assert.equal(shown.clips[0].url, `/clip/${clip.id}`)
  })

  test('deleting a clip takes its files, comments, GGs and saved copies', async ({
    client: http,
    assert,
  }) => {
    const { person, player, app } = await poster(http)
    const briar = await accounts.person('Briar')
    game([{ puuid: player.puuid, gameName: 'Ember', championId: 81 }])
    const clip = await post(http, app)
    await site(http, briar).put(`/api/clips/${clip.id}/gg`)
    await site(http, briar).post(`/api/clips/${clip.id}/comments`).json({ body: 'gg' })
    await accountService.change(briar, [{ op: 'save', kind: 'clip', id: clip.id }], 'site')

    const stranger = await site(http, briar).delete(`/api/clips/${clip.id}`)
    stranger.assertStatus(404)
    const deleted = await app.delete(`/api/desktop/clips/${clip.id}`)
    deleted.assertStatus(204)
    const file = await site(http, person).get(`/clips/${clip.id}.mp4`)
    file.assertStatus(404)
    assert.lengthOf(await db.from('invade_gg').where('target_id', clip.id), 0)
    assert.lengthOf(await db.from('invade_clip_comment').where('clip_id', clip.id), 0)
    assert.lengthOf(await db.from('invade_saved').where('target_id', clip.id), 0)
  })

  test('a person is never told about their own doing, and a page names nobody hidden', async ({
    client: http,
    assert,
  }) => {
    const { person, player, app } = await poster(http)
    game([{ puuid: player.puuid, gameName: 'Ember', championId: 81 }])
    const clip = await post(http, app)
    await site(http, person).post(`/api/clips/${clip.id}/comments`).json({ body: 'mine' })
    const told = await notificationsOf(person.id)
    assert.lengthOf(told.items, 0)
    await accountService.change(person, [{ op: 'show', puuid: player.puuid, shown: false }], 'site')
    const page = await http.get(`/clip/${clip.id}`)
    assert.isNull(pageProps(page.text()).clip.author.account)
  })
})
