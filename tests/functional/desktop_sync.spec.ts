import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import clickhouse from 'adonisjs-clickhouse/services/main'
import riotApiService from '#services/riot/api'
import summonerService from '#services/summoner_service'
import playerInsightsService from '#services/player_insights_service'
import publicationService from '#services/desktop/publication_service'
import rateLimiter from '#services/desktop/rate_limiter'
import { RetryScheduler } from '#services/desktop/retry_scheduler'
import { RiotUpstreamException } from '#utils/riot_errors'
import encryption from '@adonisjs/core/services/encryption'
import { apiPuuids, makeUpload, riotMatch, UPLOADER_PARTICIPANT } from '#tests/fixtures/desktop'
import { DesktopSeed } from '#tests/fixtures/desktop_db'
import { desktopClient } from '#tests/fixtures/desktop_http'

/**
 * The desktop routes end to end, against the isolated Postgres and
 * ClickHouse databases. Only Riot (and the R2 archive) is stubbed.
 */
test.group('Desktop sync API', (group) => {
  group.tap((t) => t.tags(['@desktop']))
  const client = riotApiService.client
  const resolve = summonerService.resolveAndUpsert
  const updateRanks = summonerService.updateRanks
  const mastery = playerInsightsService.mastery
  const service = {
    championIds: publicationService.championIds,
    archive: publicationService.archive,
    retries: publicationService.retries,
  }
  const prefix = rateLimiter.prefix
  let seed: DesktopSeed

  group.each.setup(() => {
    seed = new DesktopSeed()
    // Fresh counters per test: the per-IP limits would otherwise carry across runs.
    rateLimiter.prefix = `desktop:rl:test:${randomUUID()}:`
    publicationService.championIds = async () => null
    publicationService.archive = async () => {}
    publicationService.retries = new RetryScheduler([60_000])
  })

  group.each.teardown(async () => {
    publicationService.retries.clear()
    riotApiService.client = client
    summonerService.resolveAndUpsert = resolve
    summonerService.updateRanks = updateRanks
    playerInsightsService.mastery = mastery
    Object.assign(publicationService, service)
    rateLimiter.prefix = prefix
    for (const matchId of seed.matchIds) {
      for (const table of ['matches', 'participants', 'match_timeline']) {
        await clickhouse.command({ query: `DELETE FROM ${table} WHERE match_id = '${matchId}'` })
      }
    }
    await seed.cleanup()
  })

  /** A stored player for the fixture's uploader, a registered device, and its token. */
  async function onboarded() {
    const upload = makeUpload({ fresh: true, gameId: 8e9 + Math.floor(Math.random() * 1e9) })
    const puuids = apiPuuids(upload)
    await seed.players(upload, puuids, [UPLOADER_PARTICIPANT])
    // A Riot-path upload stores every participant as a player; clean them all up.
    seed.puuids.push(...puuids.values())
    const { device, token, secret } = await seed.device()
    const identity = upload.game.participantIdentities.find(
      (i) => i.participantId === UPLOADER_PARTICIPANT
    )!.player
    return {
      upload,
      puuids,
      device,
      credentials: { token, secret },
      identity,
      puuid: puuids.get(upload.uploader)!,
    }
  }

  test('config exposes the kill switches and the payload limit', async ({ client: http }) => {
    const response = await http.get('/api/desktop/config')
    response.assertStatus(200)
    response.assertBody({
      uploads: true,
      resolve: true,
      maxPayloadBytes: 2000000,
      minAppVersion: null,
    })
  })

  test('registers a device and returns its token and secret once', async ({
    client: http,
    assert,
  }) => {
    const response = await http.post('/api/desktop/devices').json({ app: '0.2.7', os: 'windows' })
    response.assertStatus(201)
    const { deviceId, token, secret } = response.body()
    seed.devices.push(deviceId)
    assert.match(token, /^inv_dev_[A-Za-z0-9_-]{43}$/)
    assert.match(secret, /^[0-9a-f]{64}$/)
    const row = await db.from('desktop_device').where('id', deviceId).first()
    assert.notEqual(row.token_hash, token)
    assert.lengthOf(row.token_hash, 64)
    // Stored encrypted with the app key, never in clear.
    assert.notInclude(row.secret_encrypted, secret)
    assert.equal(encryption.decrypt(row.secret_encrypted), secret)

    const invalid = await http.post('/api/desktop/devices').json({ app: '0.2.7', os: 'linux' })
    invalid.assertStatus(422)
    assert.equal(invalid.body().errors[0].code, 'E_VALIDATION_ERROR')
  })

  test('register → link → upload → duplicate, then the website shows it', async ({
    client: http,
    assert,
  }) => {
    const { upload, puuids, credentials, identity, puuid } = await onboarded()
    const app = desktopClient(http, credentials)

    const link = await app.post('/api/desktop/link', {
      gameName: identity.gameName,
      tagLine: identity.tagLine,
      platform: 'EUW1',
      rawPuuid: identity.puuid,
      source: 'lcu',
    })
    link.assertStatus(200)
    link.assertBody({
      puuid,
      profileUrl: `https://invade.lol/${encodeURIComponent(`${identity.gameName}-${identity.tagLine}`)}`,
    })

    const calls: string[] = []
    riotApiService.client = {
      matchV5: {
        getMatchById: async ({ matchId }: { matchId: string }) => {
          calls.push(matchId)
          return riotMatch(upload, puuids)
        },
      },
    } as unknown as typeof client
    upload.lp = {
      queue: 'RANKED_SOLO_5x5',
      before: {
        tier: 'EMERALD',
        division: 'II',
        lp: 45,
        wins: 60,
        losses: 52,
        at: upload.game.gameCreation + 60_000,
      },
      after: {
        tier: 'EMERALD',
        division: 'II',
        lp: 64,
        wins: 61,
        losses: 52,
        at: upload.capturedAt - 20_000,
      },
    }

    const first = await app.post('/api/desktop/matches', upload)
    first.assertStatus(200)
    first.assertBody({
      matchId: upload.matchId,
      status: 'verified',
      lp: 'stored',
      url: `https://invade.lol/${encodeURIComponent(`${identity.gameName}-${identity.tagLine}`)}/match/${upload.matchId}`,
    })
    assert.deepEqual(calls, [upload.matchId])

    const again = await app.post('/api/desktop/matches', upload)
    again.assertStatus(200)
    again.assertBodyContains({ status: 'duplicate', lp: 'stored' })
    assert.lengthOf(calls, 1)

    const match = await http.get(`/api/matches/${upload.matchId}`)
    match.assertStatus(200)
    match.assertBodyContains({ matchId: upload.matchId, source: 'riot', verification: 'verified' })
    assert.lengthOf(match.body().participants, 10)
    assert.isAbove(match.body().timeline.length, 100)

    const list = await http.get(`/api/summoners/puuid/${puuid}/matches?view=summary`)
    list.assertStatus(200)
    const listed = list.body().find((m: any) => m.matchId === upload.matchId)
    assert.equal(listed.lpChange, 19)
    assert.equal(listed.source, 'riot')

    const profile = await http.get(
      `/api/summoners/${encodeURIComponent(`${identity.gameName}-${identity.tagLine}`)}`
    )
    profile.assertStatus(200)
    assert.isNotNull(profile.body().freshness.lastDesktopSyncAt)
  })

  test('uploads need a valid device token', async ({ client: http, assert }) => {
    const upload = makeUpload()
    const anonymous: Record<string, string> = {}
    for (const headers of [anonymous, { Authorization: 'Bearer inv_dev_nope' }]) {
      const response = await http.post('/api/desktop/matches').headers(headers).json(upload)
      response.assertStatus(401)
      assert.equal(response.body().errors[0].code, 'E_DEVICE_UNAUTHORIZED')
    }
  })

  test('an uploader the device is not linked to gets 403 E_NOT_LINKED', async ({
    client: http,
    assert,
  }) => {
    const { upload, credentials } = await onboarded()
    seed.matchIds.push(upload.matchId)
    const response = await desktopClient(http, credentials).post('/api/desktop/matches', upload)
    response.assertStatus(403)
    assert.equal(response.body().errors[0].code, 'E_NOT_LINKED')
  })

  test('implausible games get 422 E_INVALID_MATCH, malformed ones E_VALIDATION_ERROR', async ({
    client: http,
    assert,
  }) => {
    const { upload, device, credentials, puuid } = await onboarded()
    await seed.link(device.id, puuid, upload.uploader)
    const app = desktopClient(http, credentials)

    upload.game.queueId = 830
    const invalid = await app.post('/api/desktop/matches', upload)
    invalid.assertStatus(422)
    assert.deepEqual(invalid.body().errors[0], {
      message: 'Invalid match: queue 830 is not accepted',
      code: 'E_INVALID_MATCH',
    })

    const malformed = await app.post('/api/desktop/matches', {
      schema: 1,
      matchId: upload.matchId,
    })
    malformed.assertStatus(422)
    assert.equal(malformed.body().errors[0].code, 'E_VALIDATION_ERROR')

    const lp = await app.post('/api/desktop/matches', { ...upload, lp: 'gold' })
    lp.assertStatus(422)
    assert.equal(lp.body().errors[0].code, 'E_INVALID_LP')
  })

  test('only the upload route accepts bodies over 1 MB, and only up to 2 MB', async ({
    client: http,
    assert,
  }) => {
    const { credentials } = await onboarded()
    const app = desktopClient(http, credentials)

    const huge = await app.post('/api/desktop/matches', {
      schema: 1,
      padding: 'x'.repeat(2_100_000),
    })
    huge.assertStatus(413)
    assert.equal(huge.body().errors[0].code, 'E_PAYLOAD_TOO_LARGE')

    // 1.5 MB passes the parser on the upload route (and fails validation instead)...
    const large = await app.post('/api/desktop/matches', {
      schema: 1,
      padding: 'x'.repeat(1_500_000),
    })
    large.assertStatus(422)

    // ...while every other route keeps the default 1 MB limit. Those routes do
    // not read a rejected body, so the client may see the socket close first.
    const elsewhere = await http
      .post('/api/summoners/sync')
      .json({ summoner: 'a-b', padding: 'x'.repeat(1_500_000) })
      .then(
        (response) => response.status(),
        (error) => error.code
      )
    assert.include([413, 'EPIPE', 'ECONNRESET'], elsewhere)
  })

  test('revoking a device or unlinking an account takes effect at once', async ({
    client: http,
    assert,
  }) => {
    const { upload, device, credentials, puuid } = await onboarded()
    await seed.link(device.id, puuid, upload.uploader)
    const app = desktopClient(http, credentials)

    const unlink = await app.delete(`/api/desktop/link/${puuid}`)
    unlink.assertStatus(204)
    const notLinked = await app.post('/api/desktop/matches', upload)
    notLinked.assertStatus(403)

    const revoke = await app.delete('/api/desktop/devices/me')
    revoke.assertStatus(204)
    const gone = await app.post('/api/desktop/matches', upload)
    gone.assertStatus(401)
    assert.equal(gone.body().errors[0].code, 'E_DEVICE_UNAUTHORIZED')
  })

  test('registrations are limited per address with 429 and Retry-After', async ({
    client: http,
    assert,
  }) => {
    for (let i = 0; i < 10; i++) {
      const ok = await http.post('/api/desktop/devices').json({ app: '0.2.7', os: 'macos' })
      ok.assertStatus(201)
      seed.devices.push(ok.body().deviceId)
    }
    const limited = await http.post('/api/desktop/devices').json({ app: '0.2.7', os: 'macos' })
    limited.assertStatus(429)
    assert.equal(limited.body().errors[0].code, 'E_RATE_LIMITED')
    assert.isAbove(Number(limited.header('retry-after')), 0)
  })

  test('resolve answers from stored data and Riot only for what is missing', async ({
    client: http,
    assert,
  }) => {
    const { identity, puuid } = await onboarded()
    let refreshed = 0
    summonerService.updateRanks = async () => {
      refreshed++
      await db.table('riot_rank').insert({
        puuid,
        queue_type: 'RANKED_SOLO_5x5',
        tier: 'EMERALD',
        division: 'II',
        league_points: 64,
        wins: 61,
        losses: 52,
        fetched_at: new Date(),
      })
    }
    playerInsightsService.mastery = async () =>
      [1, 2, 3, 4, 5, 6].map((n) => ({
        championId: n,
        championLevel: 10,
        championPoints: n * 1000,
        lastPlayTime: 1791400000000,
        championPointsUntilNextLevel: 0,
        tokensEarned: 0,
        source: 'riot' as const,
        observedAt: 1791450000000,
      }))

    const response = await http
      .get('/api/desktop/resolve')
      .qs({ gameName: identity.gameName, tagLine: identity.tagLine })
    response.assertStatus(200)
    response.assertBodyContains({
      puuid,
      gameName: identity.gameName,
      platform: 'EUW1',
      solo: { tier: 'EMERALD', division: 'II', lp: 64, wins: 61, losses: 52, source: 'riot' },
      flex: null,
      recent: [],
      stale: false,
    })
    assert.deepEqual(
      response.body().mastery.map((m: any) => m.championId),
      [6, 5, 4, 3, 2]
    )
    assert.equal(refreshed, 1)

    // The rank is fresh now: no second league-v4 call.
    await http
      .get('/api/desktop/resolve')
      .qs({ gameName: identity.gameName, tagLine: identity.tagLine })
    assert.equal(refreshed, 1)
  })

  test('resolve maps Riot failures to the documented codes', async ({ client: http, assert }) => {
    summonerService.resolveAndUpsert = async () => {
      throw new Exception('Summoner not found', { status: 404 })
    }
    const missing = await http.get('/api/desktop/resolve').qs({ gameName: 'Nobody', tagLine: 'X1' })
    missing.assertStatus(404)
    assert.equal(missing.body().errors[0].code, 'E_SUMMONER_NOT_FOUND')

    summonerService.resolveAndUpsert = async () => {
      throw new RiotUpstreamException('Riot is rate limiting', 'E_RIOT_RATE_LIMITED', 429, 42)
    }
    const limited = await http.get('/api/desktop/resolve').qs({ gameName: 'Nobody', tagLine: 'X1' })
    limited.assertStatus(429)
    assert.equal(limited.body().errors[0].code, 'E_RIOT_RATE_LIMITED')
    assert.equal(limited.header('retry-after'), '42')

    summonerService.resolveAndUpsert = async () => {
      throw { status: 503 }
    }
    const down = await http.get('/api/desktop/resolve').qs({ gameName: 'Nobody', tagLine: 'X1' })
    down.assertStatus(503)
    assert.equal(down.body().errors[0].code, 'E_RIOT_UNAVAILABLE')
    assert.isAbove(Number(down.header('retry-after')), 0)
  })
})
