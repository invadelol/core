import { test } from '@japa/runner'
import { randomBytes } from 'node:crypto'
import redis from '@adonisjs/redis/services/main'
import summonerService from '#services/summoner_service'
import matchService from '#services/matches_service'
import type Summoner from '#models/summoner'

test.group('Summoner sync', (group) => {
  const resolve = summonerService.resolveAndUpsert
  const ranksFresh = summonerService.ranksFresh
  const updateRanks = summonerService.updateRanks
  const update = matchService.update
  const puuids: string[] = []
  group.each.teardown(() => {
    summonerService.resolveAndUpsert = resolve
    summonerService.ranksFresh = ranksFresh
    summonerService.updateRanks = updateRanks
    matchService.update = update
  })
  group.teardown(async () => {
    for (const puuid of puuids) {
      await redis.del(`summoner:${puuid}:cache_generation`, `summoner:${puuid}:cache_keys`)
    }
  })

  test('the profile read after a sync is never a cached one, even when its ranks failed', async ({
    client,
    assert,
  }) => {
    // A Riot API puuid's shape, never a real one.
    const puuid = randomBytes(64).toString('base64url').slice(0, 78)
    puuids.push(puuid)
    const name = `Sync${randomBytes(4).toString('hex')}`
    summonerService.resolveAndUpsert = async () =>
      ({ puuid, gameName: name, tagLine: 'EUW', platform: 'EUW1' }) as Summoner
    summonerService.ranksFresh = async () => false
    summonerService.updateRanks = async () => {
      throw new Error('league-v4 is down')
    }
    matchService.update = async () => []
    const generation = async () =>
      Number((await redis.get(`summoner:${puuid}:cache_generation`)) ?? 0)

    const before = await generation()
    const response = await client.post('/api/summoners/sync').json({ summoner: `${name}-EUW` })
    response.assertStatus(200)
    response.assertBodyContains({ matches: [], rankRefreshFailed: true })
    assert.equal(await generation(), before + 1, "the player's cached answers were dropped")
  })
})
