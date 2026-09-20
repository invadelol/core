import { test } from '@japa/runner'
import summonerService from '#services/summoner_service'
import matchService from '#services/matches_service'
import type Summoner from '#models/summoner'

const player = {
  puuid: 'test-player',
  gameName: 'Player',
  tagLine: 'custom',
  platform: 'OC1',
} as Summoner

test.group('Regionless summoner API', (group) => {
  const resolve = summonerService.resolveAndUpsert
  const update = matchService.update
  const stored = summonerService.findStored
  group.each.teardown(() => {
    summonerService.resolveAndUpsert = resolve
    matchService.update = update
    summonerService.findStored = stored
  })

  test('profile route delegates to automatic detection', async ({ client, assert }) => {
    summonerService.resolveAndUpsert = async (slug, platform) => {
      assert.equal(slug, 'Player-custom')
      assert.isUndefined(platform)
      return player
    }
    const response = await client.get('/api/summoners/Player-custom')
    response.assertStatus(200)
    response.assertBodyContains({ summoner: { platform: 'OC1' } })
  })

  test('legacy platform API is still available', async ({ client, assert }) => {
    summonerService.resolveAndUpsert = async (_slug, platform) => {
      assert.equal(platform, 'OC1')
      return player
    }
    const response = await client.get('/api/summoners/OC1/Player-custom')
    response.assertStatus(200)
  })

  test('sync redetects transfers and routes matches using the resolved platform', async ({
    client,
    assert,
  }) => {
    summonerService.resolveAndUpsert = async (slug, platform, options) => {
      assert.equal(slug, 'My-Player-custom')
      assert.isUndefined(platform)
      assert.isTrue(options?.refresh)
      return player
    }
    matchService.update = async (puuid, cluster) => {
      assert.equal(puuid, player.puuid)
      assert.equal(cluster, 'sea')
      return []
    }
    const response = await client.post('/api/summoners/sync').json({ summoner: 'My-Player-custom' })
    response.assertStatus(200)
    response.assertBodyContains({ summoner: { platform: 'OC1' }, matches: [] })
  })

  test('upstream failures retain their meaning on regionless lookups', async ({ client }) => {
    summonerService.resolveAndUpsert = async () => {
      throw { status: 429 }
    }
    summonerService.findStored = async () => null
    const response = await client.get('/api/summoners/Player-custom')
    response.assertStatus(503)
  })
})
