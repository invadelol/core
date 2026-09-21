import { test } from '@japa/runner'
import { PlatformId } from '@fightmegg/riot-api'
import logger from '@adonisjs/core/services/logger'
import riotApiService from '#services/riot/api'
import matchService from '#services/matches_service'
import matchRepository from '#services/analytics/match_repository'
import Summoner from '#models/summoner'
import SummonerUpdated from '#events/summoner_updated'
import emitter from '@adonisjs/core/services/emitter'
import UpdateSummonerRank from '#listeners/update_summoner_rank'

test.group('Match sync lifecycle', (group) => {
  const client = riotApiService.client
  const existing = matchRepository.getExistingIds
  const store = matchService.fetchAndStoreMatch
  const find = Summoner.find
  const dispatch = SummonerUpdated.dispatch
  const warn = logger.warn

  group.each.teardown(() => {
    riotApiService.client = client
    matchRepository.getExistingIds = existing
    matchService.fetchAndStoreMatch = store
    Summoner.find = find
    SummonerUpdated.dispatch = dispatch
    logger.warn = warn
  })

  test('coalesces by resolved PUUID even when callers use different profile routes', async ({
    assert,
  }) => {
    let calls = 0
    riotApiService.client = {
      matchV5: {
        getIdsByPuuid: async () => {
          calls++
          return []
        },
      },
    } as unknown as typeof client
    assert.deepEqual(
      await Promise.all([
        matchService.update('same-player', PlatformId.EUROPE),
        matchService.update('same-player', PlatformId.EUROPE),
      ]),
      [[], []]
    )
    assert.equal(calls, 1)
    await matchService.update('same-player', PlatformId.EUROPE)
    assert.equal(calls, 2)
  })

  test('post-sync listener rejection is handled without failing a successful ingestion', async ({
    assert,
  }) => {
    riotApiService.client = {
      matchV5: { getIdsByPuuid: async () => ['EUW1_1'] },
    } as unknown as typeof client
    matchRepository.getExistingIds = async () => new Set()
    const storedMatch = { matchId: 'EUW1_1', platform: 'EUW1', gameStartMs: 1 }
    matchService.fetchAndStoreMatch = async () => storedMatch
    Summoner.find = (async () => ({ platform: 'EUW1' })) as unknown as typeof find
    const failure = new Error('Listener failed')
    SummonerUpdated.dispatch = async () => {
      throw failure
    }
    let logged: unknown
    logger.warn = ((context: { err: unknown }) => {
      logged = context.err
    }) as typeof warn

    const result = await matchService.update('listener-player', PlatformId.EUROPE)
    await new Promise<void>((resolve) => setImmediate(resolve))
    assert.deepEqual(result, [storedMatch])
    assert.strictEqual(logged, failure)
  })

  test('rank refresh is not also registered as a background listener', ({ assert }) => {
    const listeners = emitter.eventsListeners.get(SummonerUpdated)
    assert.isDefined(listeners)
    for (const listener of listeners!.keys()) {
      assert.isFalse(Array.isArray(listener) && listener[0] === UpdateSummonerRank)
    }
  })
})
