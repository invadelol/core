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
import ingestionService from '#services/analytics/ingestion_service'
import matchSourceService from '#services/match_source_service'
import redis from '@adonisjs/redis/services/main'

test.group('Match sync lifecycle', (group) => {
  const client = riotApiService.client
  const existing = matchRepository.getExistingIds
  const store = matchService.fetchAndStoreMatch
  const find = Summoner.find
  const dispatch = SummonerUpdated.dispatch
  const warn = logger.warn
  const archive = matchService.archive
  const claim = matchSourceService.claim
  const updateSource = matchSourceService.update
  const ingestMatch = ingestionService.ingestMatch
  const ingestTimeline = ingestionService.ingestTimeline
  const pipeline = redis.pipeline

  group.each.teardown(() => {
    riotApiService.client = client
    matchRepository.getExistingIds = existing
    matchService.fetchAndStoreMatch = store
    Summoner.find = find
    SummonerUpdated.dispatch = dispatch
    logger.warn = warn
    matchService.archive = archive
    matchSourceService.claim = claim
    matchSourceService.update = updateSource
    ingestionService.ingestMatch = ingestMatch
    ingestionService.ingestTimeline = ingestTimeline
    redis.pipeline = pipeline
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

  test('a timeline that cannot be stored keeps the game and flags it, without failing the sync', async ({
    assert,
  }) => {
    const match = {
      info: { platformId: 'EUW1', gameStartTimestamp: 1, participants: [{ puuid: 'p1' }] },
    }
    riotApiService.client = {
      matchV5: {
        getMatchById: async () => match,
        getMatchTimelineById: async () => ({ info: { frames: [] } }),
      },
    } as unknown as typeof client
    matchService.archive = async () => {}
    matchSourceService.claim = async () => true
    const flagged: unknown[] = []
    matchSourceService.update = (async (_id: string, changes: unknown) => {
      flagged.push(changes)
      return []
    }) as unknown as typeof updateSource
    ingestionService.ingestMatch = async () => ({ platform: 'EUW1', gameStartMs: 1 })
    ingestionService.ingestTimeline = async () => {
      throw new Error("Unsigned type must not contain '-' symbol")
    }
    logger.warn = (() => {}) as typeof warn
    redis.pipeline = (() => ({
      eval() {},
      publish() {},
      exec: async () => [],
    })) as unknown as typeof pipeline

    const stored = await matchService.fetchAndStoreMatch('EUW1_2', PlatformId.EUROPE)
    assert.deepEqual(stored, { matchId: 'EUW1_2', platform: 'EUW1', gameStartMs: 1 })
    assert.deepEqual(flagged, [
      {
        completeness: {
          pings: true,
          summonerLevel: true,
          statPerks: true,
          timeline: false,
          position: 'riot',
        },
      },
    ])
  })
})
