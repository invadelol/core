import { test } from '@japa/runner'
import { randomBytes, randomInt } from 'node:crypto'
import redis from '@adonisjs/redis/services/main'
import riotApiService from '#services/riot/api'
import { CoalescingRiotAPI } from '#services/riot/client'
import { RIOT_QUOTAS } from '#services/quota/riot_quota'
import playerInsightsService from '#services/player_insights_service'
import summonerService from '#services/summoner_service'
import matchService from '#services/matches_service'
import Summoner from '#models/summoner'
import PlayerMastery from '#models/player_mastery'

/** A Riot API puuid's shape (78 base64url characters), never a real one. */
const fakePuuid = () => randomBytes(64).toString('base64url').slice(0, 78)

/** A public address picked at random, so no two tests share a quota. */
const freshAddress = () => `198.18.${randomInt(0, 256)}.${randomInt(1, 255)}`

/** Cloudflare edges (https://www.cloudflare.com/ips). */
const EDGE = '172.70.12.4'
const OTHER_EDGE = '162.158.1.1'

/** The application's Riot client, its queue included, with Riot answering every read. */
function riot() {
  const api = new CoalescingRiotAPI('RGAPI-00000000-0000-0000-0000-000000000000')
  const urls: string[] = []
  ;(api as any).riotRateLimiter.execute = async ({ url }: { url: string }) => {
    urls.push(url)
    if (url.includes('/champion-masteries/')) {
      return [{ championId: 45, championLevel: 7, championPoints: 70000, lastPlayTime: 1 }]
    }
    return { puuid: 'x' }
  }
  riotApiService.client = api
  return urls
}

test.group('Riot quotas on the API', (group) => {
  const client = riotApiService.client
  const findBy = Summoner.findBy
  const findMastery = PlayerMastery.find
  const remember = (playerInsightsService as any).rememberTop
  const resolve = summonerService.resolveAndUpsert
  const findStored = summonerService.findStored
  const ranksFresh = summonerService.ranksFresh
  const update = matchService.update

  group.each.setup(() => {
    // Every player asked about is stored, on EUW; no snapshot to fall back on; nothing written.
    Summoner.findBy = (async (_key: string, puuid: string) => ({
      puuid,
      platform: 'EUW1',
    })) as unknown as typeof Summoner.findBy
    PlayerMastery.find = (async () => null) as unknown as typeof PlayerMastery.find
    ;(playerInsightsService as any).rememberTop = async () => {}
  })
  group.each.teardown(() => {
    riotApiService.client = client
    Summoner.findBy = findBy
    PlayerMastery.find = findMastery
    ;(playerInsightsService as any).rememberTop = remember
    summonerService.resolveAndUpsert = resolve
    summonerService.findStored = findStored
    summonerService.ranksFresh = ranksFresh
    matchService.update = update
  })
  group.teardown(async () => {
    const keys = await redis.keys('quota:*')
    if (keys.length) await redis.del(...keys)
  })

  const mastery = (puuid: string) => `/api/summoners/puuid/${puuid}/mastery`

  test('an address reading mastery from Riot too often gets a 429 with Retry-After', async ({
    client: http,
    assert,
  }) => {
    const urls = riot()
    const ip = freshAddress()
    const { limit } = RIOT_QUOTAS.routes.mastery.address[0]
    const first = fakePuuid()
    for (let i = 0; i < limit; i++) {
      const response = await http
        .get(mastery(i === 0 ? first : fakePuuid()))
        .header('x-forwarded-for', ip)
      response.assertStatus(200)
    }
    assert.lengthOf(urls, limit)

    const refused = await http.get(mastery(fakePuuid())).header('x-forwarded-for', ip)
    refused.assertStatus(429)
    const wait = Number(refused.header('retry-after'))
    assert.isAbove(wait, 0)
    assert.isAtMost(wait, 600)
    refused.assertBodyContains({
      errors: [{ code: 'E_TOO_MANY_REQUESTS' }],
      retryAfter: wait,
      scope: 'address',
    })
    assert.lengthOf(urls, limit, 'the refused read never reached Riot')

    // An answer already cached costs nothing, and is never refused.
    ;(await http.get(mastery(first)).header('x-forwarded-for', ip)).assertStatus(200)
    // Someone else is not held by this address's quota.
    ;(await http.get(mastery(fakePuuid())).header('x-forwarded-for', freshAddress())).assertStatus(
      200
    )
  })

  test("behind Cloudflare the visitor's own address is counted, never a forged one", async ({
    client: http,
  }) => {
    riot()
    const visitorIp = `81.2.${randomInt(0, 256)}.${randomInt(1, 255)}`
    const { limit } = RIOT_QUOTAS.routes.mastery.address[0]
    const through = (edge: string, cf: string) =>
      http.get(mastery(fakePuuid())).header('x-forwarded-for', edge).header('cf-connecting-ip', cf)
    for (let i = 0; i < limit; i++)
      (await through(EDGE, visitorIp)).assertStatus(200)
      // The same visitor through another edge is the same visitor.
    ;(await through(OTHER_EDGE, visitorIp)).assertStatus(429)
    // Every visitor behind that edge is not.
    ;(await through(EDGE, `81.3.${randomInt(0, 256)}.${randomInt(1, 255)}`)).assertStatus(200)
    // Straight to the server, CF-Connecting-IP is anyone's to write: the hop is counted instead.
    ;(await through(freshAddress(), visitorIp)).assertStatus(200)
  })

  test("a sync that just worked answers the next one from what's stored", async ({
    client: http,
    assert,
  }) => {
    const urls = riot()
    const puuid = fakePuuid()
    const name = `Quota${randomBytes(4).toString('hex')}`
    const stored = { puuid, gameName: name, tagLine: 'EUW', platform: 'EUW1' } as Summoner
    summonerService.resolveAndUpsert = async () => {
      await riotApiService.client.account.getByRiotId({
        region: 'europe' as any,
        gameName: name,
        tagLine: 'EUW',
      })
      return stored
    }
    summonerService.findStored = async () => stored
    summonerService.ranksFresh = async () => true
    matchService.update = async () => []

    const ip = freshAddress()
    const sync = () =>
      http
        .post('/api/summoners/sync')
        .header('x-forwarded-for', ip)
        .json({ summoner: `${name}-EUW` })
    ;(await sync()).assertStatus(200)
    assert.lengthOf(urls, 1)
    const again = await sync()
    again.assertStatus(200)
    again.assertBodyContains({ matches: [], rankRefreshFailed: false })
    assert.lengthOf(urls, 1, 'nothing asked of Riot the second time')
  })

  test('an address updating too many players is refused before Riot is asked', async ({
    client: http,
    assert,
  }) => {
    const urls = riot()
    summonerService.resolveAndUpsert = async (summoner: string) => {
      await riotApiService.client.account.getByRiotId({
        region: 'europe' as any,
        gameName: summoner,
        tagLine: 'EUW',
      })
      return {
        puuid: fakePuuid(),
        gameName: summoner,
        tagLine: 'EUW',
        platform: 'EUW1',
      } as Summoner
    }
    summonerService.ranksFresh = async () => true
    matchService.update = async () => []
    const ip = freshAddress()
    const { limit } = RIOT_QUOTAS.routes.sync.address[0]
    for (let i = 0; i < limit; i++) {
      const response = await http
        .post('/api/summoners/sync')
        .header('x-forwarded-for', ip)
        .json({ summoner: `Lobby${i}${randomBytes(3).toString('hex')}-EUW` })
      response.assertStatus(200)
    }
    const refused = await http
      .post('/api/summoners/sync')
      .header('x-forwarded-for', ip)
      .json({ summoner: `Lobby${randomBytes(3).toString('hex')}-EUW` })
    refused.assertStatus(429)
    refused.assertBodyContains({ errors: [{ code: 'E_TOO_MANY_REQUESTS' }] })
    assert.lengthOf(urls, limit)
  })

  test("another site's page cannot make its visitors' browsers ask Riot", async ({
    client: http,
    assert,
  }) => {
    const urls = riot()
    const refused = await http
      .get(mastery(fakePuuid()))
      .header('x-forwarded-for', freshAddress())
      .header('sec-fetch-site', 'cross-site')
      .header('sec-fetch-mode', 'no-cors')
    refused.assertStatus(403)
    refused.assertBodyContains({ errors: [{ code: 'E_CROSS_SITE' }] })
    const sync = await http
      .post('/api/summoners/sync')
      .header('origin', 'https://evil.example')
      .json({ summoner: 'Anyone-EUW' })
    sync.assertStatus(403)
    assert.lengthOf(urls, 0)

    // The site itself, and the desktop app (no browser headers at all), go through.
    ;(
      await http
        .get(mastery(fakePuuid()))
        .header('x-forwarded-for', freshAddress())
        .header('sec-fetch-site', 'same-origin')
    ).assertStatus(200)
    ;(
      await http
        .get(mastery(fakePuuid()))
        .header('x-forwarded-for', freshAddress())
        .header('user-agent', 'Invade/0.3.9 (windows)')
    ).assertStatus(200)
  })
})

test.group('CORS', () => {
  const preflight = (http: any, origin: string) =>
    http
      .options('/api/summoners/sync')
      .header('origin', origin)
      .header('access-control-request-method', 'POST')
      .header('access-control-request-headers', 'content-type')

  test('the site, its preview and the desktop app may call the API with credentials', async ({
    client: http,
  }) => {
    for (const origin of ['https://invade.lol', 'https://pp.invade.lol', 'tauri://localhost']) {
      const response = await preflight(http, origin)
      response.assertStatus(204)
      response.assertHeader('access-control-allow-origin', origin)
      response.assertHeader('access-control-allow-credentials', 'true')
    }
    const read = await http.get('/api/health').header('origin', 'http://tauri.localhost')
    read.assertHeader('access-control-allow-origin', 'http://tauri.localhost')
    read.assertHeader('access-control-expose-headers', 'retry-after')
  })

  test('any other site gets no CORS headers at all', async ({ client: http, assert }) => {
    for (const origin of ['https://evil.example', 'https://invade.lol.evil.example', 'null']) {
      const response = await preflight(http, origin)
      response.assertStatus(204)
      assert.isUndefined(response.header('access-control-allow-origin'))
      assert.isUndefined(response.header('access-control-allow-credentials'))
      const read = await http.get('/api/health').header('origin', origin)
      assert.isUndefined(read.header('access-control-allow-origin'))
      assert.isUndefined(read.header('access-control-allow-credentials'))
    }
  })
})
