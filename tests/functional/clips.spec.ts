import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import db from '@adonisjs/lucid/services/db'
import rateLimiter from '#services/desktop/rate_limiter'
import replayGuard from '#services/desktop/signing'
import sessionService, { accountOrigin } from '#services/accounts/session_service'
import clipService from '#services/clips/clip_service'
import { LocalClipStore, useClipStore } from '#services/clips/storage'
import { DesktopSeed } from '#tests/fixtures/desktop_db'
import { desktopClient, signedHeaders } from '#tests/fixtures/desktop_http'

/** The smallest file the clip routes take for an H.264 MP4: an `ftyp` box, then bytes. */
const mp4 = (size = 4096, codec = 'avc1') => {
  const bytes = Buffer.alloc(size, 0)
  bytes.write('ftypisom', 4, 'latin1')
  bytes.write(codec, 64, 'latin1')
  return bytes
}
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)])

/**
 * Clips end to end (docs/desktop-sync.md §11): posted by a connected app for a game of one of the
 * person's own League accounts, served with byte ranges, listed by match and player, deleted by
 * their owner only. The game lookup (ClickHouse) is stood in for.
 */
test.group('Clips', (group) => {
  group.tap((t) => t.tags(['@clips']))
  const prefixes = { limiter: rateLimiter.prefix, replay: replayGuard.prefix }
  const findGame = clipService.findGame
  let seed: DesktopSeed
  let users: string[] = []
  let dir: string

  group.each.setup(async () => {
    seed = new DesktopSeed()
    users = []
    rateLimiter.prefix = `desktop:rl:test:${randomUUID()}:`
    replayGuard.prefix = `desktop:sig:test:${randomUUID()}:`
    dir = await mkdtemp(join(tmpdir(), 'clips-'))
    useClipStore(new LocalClipStore(dir))
  })
  group.each.teardown(async () => {
    rateLimiter.prefix = prefixes.limiter
    replayGuard.prefix = prefixes.replay
    clipService.findGame = findGame
    useClipStore(null)
    if (users.length) {
      await db.from('invade_clip').whereIn('user_id', users).delete()
      await db.from('invade_user').whereIn('id', users).delete()
    }
    await seed.cleanup()
    await rm(dir, { recursive: true, force: true })
  })

  /** A person whose connected app owns a League account, and that app. */
  async function poster(http: any) {
    const { userId } = await sessionService.signIn('discord', randomUUID(), 'Ember', null)
    users.push(userId)
    const token = await sessionService.create(userId)
    const player = await seed.player()
    const device = await seed.device()
    await db.table('invade_device_user').insert({ device_id: device.device.id, user_id: userId })
    await db.table('invade_owned_account').insert({ puuid: player.puuid, user_id: userId })
    clipService.findGame = async () => ({
      matchId: 'EUW1_7000000001',
      puuid: player.puuid,
      championId: 81,
      platform: 'EUW1',
    })
    return { userId, token, player, device, app: desktopClient(http, device) }
  }

  const details = (bytes: number) => ({
    started: Date.now() - 3_600_000,
    gameTime: 552,
    durationMs: 21_000,
    title: 'he really thought he had me',
    event: 'kill',
    visibility: 'everyone',
    championKey: 'Ezreal',
    bytes,
  })

  /** A raw, signed PUT of a file, as the app sends a clip's video and picture. */
  function put(http: any, creds: { token: string; secret: string }, path: string, body: Buffer) {
    const request = http
      .put(path)
      .headers({ ...signedHeaders(creds, 'PUT', path, body), 'Content-Type': 'video/mp4' })
    request.request.serialize((bytes: Buffer) => bytes as unknown as string).send(body)
    return request
  }

  test('a connected app posts a clip; its page, file and lists show it', async ({
    client: http,
    assert,
  }) => {
    const me = await poster(http)
    const video = mp4()
    const made = await me.app.post('/api/desktop/clips', details(video.length))
    made.assertStatus(201)
    const id = made.body().id
    assert.equal(made.body().matchId, 'EUW1_7000000001')
    assert.match(made.body().url, new RegExp(`/clip/${id}$`))

    // Not on the site before its video arrives.
    const early = await http.get(`/clip/${id}`)
    early.assertStatus(404)
    const sent = await put(http, me.device, `/api/desktop/clips/${id}/video`, video)
    sent.assertStatus(200)
    assert.equal(sent.body().bytes, video.length)
    const picture = await put(http, me.device, `/api/desktop/clips/${id}/poster`, jpeg())
    picture.assertStatus(200)

    const page = await http.get(`/clip/${id}`)
    page.assertStatus(200)
    page.assertTextIncludes('og:video')
    const part = await http.get(`/clips/${id}.mp4`).header('Range', 'bytes=0-99')
    part.assertStatus(206)
    assert.equal(part.header('content-range'), `bytes 0-99/${video.length}`)
    const thumb = await http.get(`/clips/${id}.jpg`)
    thumb.assertStatus(200)

    const byMatch = await http.get('/api/clips?match=EUW1_7000000001')
    assert.deepEqual(
      byMatch.body().clips.map((c: { id: string }) => c.id),
      [id]
    )
    const byPlayer = await http.get(`/api/clips?puuid=${me.player.puuid}`)
    assert.lengthOf(byPlayer.body().clips, 1)
    const mine = await me.app.get('/api/desktop/clips')
    assert.isTrue(mine.body().clips[0].mine)
  })

  test('an HEVC video is refused and takes its clip with it', async ({ client: http, assert }) => {
    const me = await poster(http)
    const video = mp4(4096, 'hvc1')
    const made = await me.app.post('/api/desktop/clips', details(video.length))
    const id = made.body().id
    const sent = await put(http, me.device, `/api/desktop/clips/${id}/video`, video)
    sent.assertStatus(422)
    assert.equal(sent.body().errors[0].code, 'E_CLIP_HEVC')
    assert.isNull(await db.from('invade_clip').where('id', id).first())
  })

  test('limits: length, size, and the clips one account keeps', async ({
    client: http,
    assert,
  }) => {
    const me = await poster(http)
    const long = await me.app.post('/api/desktop/clips', { ...details(10), durationMs: 90_000 })
    long.assertStatus(422)
    assert.equal(long.body().errors[0].code, 'E_CLIP_INVALID')
    const large = await me.app.post('/api/desktop/clips', details(500 * 1024 * 1024))
    large.assertStatus(413)
    await db.table('invade_clip').multiInsert(
      Array.from({ length: 20 }, (_, i) => ({
        id: `Quota${String(i).padStart(5, '0')}`,
        user_id: me.userId,
        puuid: me.player.puuid,
        match_id: 'EUW1_7000000001',
        platform: 'EUW1',
        champion_id: 81,
        game_time: i,
        duration_ms: 10_000,
        title: 'x',
        event: 'kill',
        status: 'ready',
      }))
    )
    const full = await me.app.post('/api/desktop/clips', details(10))
    full.assertStatus(422)
    assert.equal(full.body().errors[0].code, 'E_CLIP_QUOTA')
  })

  test('a game none of the accounts played is refused', async ({ client: http, assert }) => {
    const me = await poster(http)
    clipService.findGame = async () => null
    const made = await me.app.post('/api/desktop/clips', details(10))
    made.assertStatus(404)
    assert.equal(made.body().errors[0].code, 'E_CLIP_NO_GAME')
  })

  test('only its owner deletes a clip, from the site or the app', async ({
    client: http,
    assert,
  }) => {
    const me = await poster(http)
    const video = mp4()
    const made = await me.app.post('/api/desktop/clips', details(video.length))
    const id = made.body().id
    await put(http, me.device, `/api/desktop/clips/${id}/video`, video)

    const { userId } = await sessionService.signIn('discord', randomUUID(), 'Copper Lane', null)
    users.push(userId)
    const other = await sessionService.create(userId)
    const refused = await http
      .delete(`/api/clips/${id}`)
      .withCookie('invade_session', other)
      .header('Origin', accountOrigin())
    refused.assertStatus(404)

    const gone = await http
      .delete(`/api/clips/${id}`)
      .withCookie('invade_session', me.token)
      .header('Origin', accountOrigin())
    gone.assertStatus(204)
    const file = await http.get(`/clips/${id}.mp4`)
    file.assertStatus(404)
    assert.isNull(await db.from('invade_clip').where('id', id).first())
  })
})
