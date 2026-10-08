import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import summonerService from '#services/summoner_service'
import playerInsightsService from '#services/player_insights_service'
import rateLimiter from '#services/desktop/rate_limiter'
import replayGuard from '#services/desktop/signing'
import { DesktopSeed } from '#tests/fixtures/desktop_db'
import { desktopClient, signedHeaders } from '#tests/fixtures/desktop_http'

/**
 * Request signing end to end (docs/desktop-sync.md §1.1): the real body
 * parser, the real middleware and the real Redis replay cache. A rejected
 * request must never reach the route, so each case uses `DELETE /link`,
 * whose 204 is easy to tell from a 401.
 */
test.group('Desktop request signing', (group) => {
  group.tap((t) => t.tags(['@desktop']))
  const prefixes = { limiter: rateLimiter.prefix, replay: replayGuard.prefix }
  const resolve = summonerService.resolveAndUpsert
  const mastery = playerInsightsService.mastery
  const updateRanks = summonerService.updateRanks
  let seed: DesktopSeed

  group.each.setup(() => {
    seed = new DesktopSeed()
    rateLimiter.prefix = `desktop:rl:test:${randomUUID()}:`
    replayGuard.prefix = `desktop:sig:test:${randomUUID()}:`
  })
  group.each.teardown(async () => {
    rateLimiter.prefix = prefixes.limiter
    replayGuard.prefix = prefixes.replay
    summonerService.resolveAndUpsert = resolve
    playerInsightsService.mastery = mastery
    summonerService.updateRanks = updateRanks
    await seed.cleanup()
  })

  const PATH = `/api/desktop/link/${'A'.repeat(78)}`

  test('a correctly signed request goes through', async ({ client: http }) => {
    const { token, secret } = await seed.device()
    const response = await desktopClient(http, { token, secret }).delete(PATH)
    response.assertStatus(204)
  })

  test('a wrong signature, a tampered body or another path is E_BAD_SIGNATURE', async ({
    client: http,
    assert,
  }) => {
    const { token, secret } = await seed.device()
    const codes: string[] = []

    const wrongKey = await http
      .delete(PATH)
      .headers(signedHeaders({ token, secret: 'b'.repeat(64) }, 'DELETE', PATH))
    codes.push(wrongKey.body().errors[0].code)

    // Signed for one body, sent with another.
    const signedFor = JSON.stringify({
      gameName: 'Louhi',
      tagLine: '727',
      platform: 'EUW1',
      source: 'riot_id',
    })
    const tampered = await http
      .post('/api/desktop/link')
      .headers(signedHeaders({ token, secret }, 'POST', '/api/desktop/link', signedFor))
      .json(signedFor.replace('Louhi', 'Other'))
    codes.push(tampered.body().errors[0].code)

    // Signed for one path (or query), sent to another.
    const elsewhere = await http
      .delete(`/api/desktop/link/${'B'.repeat(78)}`)
      .headers(signedHeaders({ token, secret }, 'DELETE', PATH))
    codes.push(elsewhere.body().errors[0].code)
    const query = await http
      .get('/api/desktop/resolve?gameName=Other&tagLine=X1')
      .headers(
        signedHeaders({ token, secret }, 'GET', '/api/desktop/resolve?gameName=Me&tagLine=X1')
      )
    codes.push(query.body().errors[0].code)

    for (const response of [wrongKey, tampered, elsewhere, query]) response.assertStatus(401)
    assert.deepEqual(codes, Array(4).fill('E_BAD_SIGNATURE'))
  })

  test('missing signature headers are E_BAD_SIGNATURE', async ({ client: http, assert }) => {
    const { token, secret } = await seed.device()
    const headers = signedHeaders({ token, secret }, 'DELETE', PATH)
    for (const drop of ['X-Invade-Signature', 'X-Invade-Timestamp']) {
      const partial: Record<string, string> = { ...headers }
      delete partial[drop]
      const response = await http.delete(PATH).headers(partial)
      response.assertStatus(401)
      assert.equal(response.body().errors[0].code, 'E_BAD_SIGNATURE')
    }
  })

  test('a skewed clock is E_CLOCK_SKEW, with Date to correct it', async ({
    client: http,
    assert,
  }) => {
    const { token, secret } = await seed.device()
    const response = await http
      .delete(PATH)
      .headers(signedHeaders({ token, secret }, 'DELETE', PATH, '', Date.now() - 6 * 60_000))
    response.assertStatus(401)
    assert.equal(response.body().errors[0].code, 'E_CLOCK_SKEW')
    const serverTime = Date.parse(response.header('date') ?? '')
    assert.isBelow(Math.abs(serverTime - Date.now()), 5000)
  })

  test('the same signed request twice is E_REPLAY', async ({ client: http, assert }) => {
    const { token, secret } = await seed.device()
    const headers = signedHeaders({ token, secret }, 'DELETE', PATH)
    const first = await http.delete(PATH).headers(headers)
    first.assertStatus(204)
    const replayed = await http.delete(PATH).headers(headers)
    replayed.assertStatus(401)
    assert.equal(replayed.body().errors[0].code, 'E_REPLAY')
  })

  test('a device registered before signing must register again', async ({
    client: http,
    assert,
  }) => {
    const { device, token, secret } = await seed.device()
    await db.from('desktop_device').where('id', device.id).update({ secret_encrypted: null })
    const response = await desktopClient(http, { token, secret }).delete(PATH)
    response.assertStatus(401)
    assert.equal(response.body().errors[0].code, 'E_DEVICE_UNAUTHORIZED')
  })

  test('resolve checks the signature whenever a token is sent', async ({
    client: http,
    assert,
  }) => {
    const player = await seed.player()
    summonerService.resolveAndUpsert = async () =>
      (await summonerService.findStored(`${player.game_name}-TST`))!
    summonerService.updateRanks = async () => {}
    playerInsightsService.mastery = async () => []
    const path = `/api/desktop/resolve?gameName=${player.game_name}&tagLine=TST`

    const anonymous = await http.get(path)
    anonymous.assertStatus(200)

    const { token, secret } = await seed.device()
    const signed = await desktopClient(http, { token, secret }).get(path)
    signed.assertStatus(200)
    assert.equal(signed.body().puuid, player.puuid)

    const unsigned = await http.get(path).header('Authorization', `Bearer ${token}`)
    unsigned.assertStatus(401)
    assert.equal(unsigned.body().errors[0].code, 'E_BAD_SIGNATURE')
  })
})
