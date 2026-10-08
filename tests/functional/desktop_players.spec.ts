import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import riotApiService from '#services/riot/api'
import summonerService from '#services/summoner_service'
import matchesService from '#services/matches_service'
import playerInsightsService from '#services/player_insights_service'
import playerSnapshotService from '#services/desktop/player_snapshot_service'
import rateLimiter from '#services/desktop/rate_limiter'
import { DesktopSeed } from '#tests/fixtures/desktop_db'
import { desktopClient } from '#tests/fixtures/desktop_http'

/**
 * `POST /api/desktop/players` end to end (docs/desktop-sync.md §6), and the
 * website reading what it stored, against the isolated databases. Riot is
 * stubbed and must not be called for anything the app already reported.
 */
test.group('Desktop player snapshots API', (group) => {
  group.tap((t) => t.tags(['@desktop']))
  const client = riotApiService.client
  const mastery = playerInsightsService.mastery
  const update = matchesService.update
  const resolve = summonerService.resolveAndUpsert
  const championIds = playerSnapshotService.championIds
  const prefix = rateLimiter.prefix
  let seed: DesktopSeed
  let riotCalls: string[]

  group.each.setup(() => {
    seed = new DesktopSeed()
    riotCalls = []
    rateLimiter.prefix = `desktop:rl:test:${randomUUID()}:`
    playerSnapshotService.championIds = async () => null
    playerInsightsService.mastery = async () => {
      riotCalls.push('mastery')
      return []
    }
    riotApiService.client = {
      league: {
        getEntriesByPUUID: async () => {
          riotCalls.push('league')
          return []
        },
      },
    } as unknown as typeof client
  })

  group.each.teardown(async () => {
    riotApiService.client = client
    playerInsightsService.mastery = mastery
    matchesService.update = update
    summonerService.resolveAndUpsert = resolve
    playerSnapshotService.championIds = championIds
    rateLimiter.prefix = prefix
    await seed.cleanup()
  })

  const batch = (players: unknown[]) => ({ schema: 1, platform: 'EUW1', app: '0.2.7', players })

  function player(overrides: Record<string, unknown> = {}) {
    const rawPuuid = randomUUID()
    seed.raws.push(rawPuuid)
    return {
      rawPuuid,
      gameName: 'Nobody',
      tagLine: 'NOPE',
      profileIconId: 4568,
      summonerLevel: 245,
      privacy: 'PUBLIC',
      self: false,
      context: 'in_game',
      observedAt: Date.now() - 60_000,
      ranks: null,
      mastery: null,
      ...overrides,
    }
  }

  /** A registered device (through the API) linked to a stored player by its raw PUUID. */
  async function linked(http: any) {
    const stored = await seed.player()
    const registered = await http.post('/api/desktop/devices').json({ app: '0.2.7', os: 'macos' })
    registered.assertStatus(201)
    const { deviceId, token, secret } = registered.body()
    seed.devices.push(deviceId)
    const app = desktopClient(http, { token, secret })
    const rawPuuid = randomUUID()
    seed.raws.push(rawPuuid)
    const link = await app.post('/api/desktop/link', {
      gameName: stored.game_name,
      tagLine: 'TST',
      platform: 'EUW1',
      rawPuuid,
      source: 'lcu',
    })
    link.assertStatus(200)
    return { app, stored, rawPuuid, deviceId }
  }

  test('register → link → players, then the website shows them as from the app', async ({
    client: http,
    assert,
  }) => {
    const { app, stored, rawPuuid, deviceId } = await linked(http)
    const observedAt = Date.now() - 30_000

    // A new device is not believed about the account it linked: any Riot ID can be linked.
    const claim = player({
      rawPuuid,
      gameName: stored.game_name,
      tagLine: 'TST',
      self: true,
      context: 'self',
      observedAt: observedAt - 60_000,
    })
    const early = await app.post('/api/desktop/players', batch([claim]))
    early.assertStatus(200)
    assert.deepEqual(early.body(), { results: [{ rawPuuid, status: 'held' }] })

    // The same device once trusted (§4.2: verified uploads on several days, a few days old).
    await db
      .from('desktop_device')
      .where('id', deviceId)
      .update({
        verified_uploads: 5,
        verified_days: 3,
        created_at: new Date(Date.now() - 4 * 86_400_000),
      })

    const self = player({
      rawPuuid,
      gameName: stored.game_name,
      tagLine: 'TST',
      self: true,
      context: 'self',
      observedAt,
      ranks: [
        {
          queue: 'RANKED_SOLO_5x5',
          tier: 'EMERALD',
          division: 'II',
          lp: 64,
          wins: 61,
          losses: 52,
          provisional: false,
        },
      ],
      mastery: [
        {
          championId: 45,
          championLevel: 38,
          championPoints: 402115,
          lastPlayTime: observedAt - 1e6,
        },
        {
          championId: 103,
          championLevel: 12,
          championPoints: 90210,
          lastPlayTime: observedAt - 2e6,
        },
      ],
    })
    const stranger = player()
    const broken = player({ observedAt: Date.now() - 48 * 3600_000 })

    const response = await app.post('/api/desktop/players', batch([self, stranger, broken]))
    response.assertStatus(200)
    assert.deepEqual(response.body(), {
      results: [
        { rawPuuid, status: 'applied' },
        { rawPuuid: stranger.rawPuuid, status: 'staged' },
        {
          rawPuuid: broken.rawPuuid,
          status: 'rejected',
          code: 'E_INVALID_PLAYER',
          message: 'observedAt is not within the last 24 hours',
        },
      ],
    })

    const profile = await http.get(
      `/api/summoners/${encodeURIComponent(`${stored.game_name}-TST`)}`
    )
    profile.assertStatus(200)
    assert.equal(Date.parse(profile.body().freshness.lastObservedAt), observedAt)
    assert.equal(profile.body().summoner.profileIconId, 4568)

    const ranks = await http.get(`/api/summoners/puuid/${stored.puuid}/ranks`)
    ranks.assertStatus(200)
    assert.deepInclude(ranks.body().current[0], {
      queueType: 'RANKED_SOLO_5x5',
      tier: 'EMERALD',
      leaguePoints: 64,
      wins: 61,
      losses: 52,
      source: 'desktop',
    })
    assert.equal(Date.parse(ranks.body().current[0].observedAt), observedAt)
    assert.notProperty(ranks.body().current[0], 'deviceId')

    const top = await http.get(`/api/summoners/puuid/${stored.puuid}/mastery?count=5`)
    top.assertStatus(200)
    assert.deepEqual(
      top.body().map((entry: any) => [entry.championId, entry.source, entry.observedAt]),
      [
        [45, 'desktop', observedAt],
        [103, 'desktop', observedAt],
      ]
    )

    // Everything above came from the app: Riot was never asked.
    assert.deepEqual(riotCalls, [])
  })

  test('a malformed batch is 422 as a whole', async ({ client: http, assert }) => {
    const { app } = await linked(http)
    const one = player()
    const cases = [
      batch([]),
      batch(Array.from({ length: 26 }, () => player())),
      { ...batch([player()]), schema: 2 },
      batch([one, { ...one }]),
      batch([one, { ...one, rawPuuid: one.rawPuuid.toUpperCase() }]),
      batch([42]),
      { schema: 1, platform: 'EUW1', app: '0.2.7' },
    ]
    for (const body of cases) {
      const response = await app.post('/api/desktop/players', body)
      response.assertStatus(422)
      assert.equal(response.body().errors[0].code, 'E_VALIDATION_ERROR')
    }
  })

  test('the route takes up to 256 KB', async ({ client: http, assert }) => {
    const { app } = await linked(http)
    const huge = await app.post('/api/desktop/players', {
      ...batch([player()]),
      padding: 'x'.repeat(300 * 1024),
    })
    huge.assertStatus(413)
    assert.deepEqual(huge.body().errors[0], {
      message: 'The request body is larger than 256 KB',
      code: 'E_PAYLOAD_TOO_LARGE',
    })
  })

  test('limits: 60 requests and 1500 players per device, 240 requests per IP', async ({
    client: http,
    assert,
  }) => {
    const { app, deviceId } = await linked(http)
    const hour = (bucket: string, id: string, amount: number) =>
      rateLimiter.hit(bucket, id, Number.MAX_SAFE_INTEGER, 3600, amount)

    // 1490 players already this hour: a batch of 10 reaches 1500 exactly...
    await hour('players:device:players', deviceId, 1490)
    const many = (count: number) => batch(Array.from({ length: count }, () => player()))
    const fits = await app.post('/api/desktop/players', many(10))
    fits.assertStatus(200)
    // ...and one more player is past it.
    const players = await app.post('/api/desktop/players', many(1))
    players.assertStatus(429)
    assert.equal(players.body().errors[0].code, 'E_RATE_LIMITED')
    assert.isAbove(Number(players.header('retry-after')), 0)

    await hour('players:device', deviceId, 60)
    const requests = await app.post('/api/desktop/players', batch([player()]))
    requests.assertStatus(429)

    const other = await linked(http)
    for (const address of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
      await hour('players:ip', address, 240)
    }
    const ip = await other.app.post('/api/desktop/players', batch([player()]))
    ip.assertStatus(429)
  })

  test('the website’s Update skips league-v4 for ranks known in the last 3 minutes', async ({
    client: http,
    assert,
  }) => {
    const stored = await seed.player()
    summonerService.resolveAndUpsert = async () =>
      (await summonerService.findStored(`${stored.game_name}-TST`))!
    matchesService.update = async () => []
    const slug = `${stored.game_name}-TST`
    const rankAt = (minutes: number) =>
      db.table('riot_rank').insert({
        puuid: stored.puuid,
        queue_type: 'RANKED_SOLO_5x5',
        tier: 'GOLD',
        division: 'I',
        league_points: 10,
        wins: 1,
        losses: null,
        source: 'desktop',
        fetched_at: new Date(Date.now() - minutes * 60_000),
      })

    await rankAt(2)
    const fresh = await http.post('/api/summoners/sync').json({ summoner: slug })
    fresh.assertStatus(200)
    assert.deepEqual(riotCalls, [])

    await db.from('riot_rank').where('puuid', stored.puuid).delete()
    await rankAt(5)
    const stale = await http.post('/api/summoners/sync').json({ summoner: slug })
    stale.assertStatus(200)
    assert.deepEqual(riotCalls, ['league'])
  })
})
