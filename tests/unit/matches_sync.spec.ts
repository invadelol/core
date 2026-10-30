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
import { Exception } from '@adonisjs/core/exceptions'
import pendingMatches from '#services/pending_matches'
import { RiotUpstreamException } from '#utils/riot_errors'

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
  const enqueue = pendingMatches.enqueue
  /** The games a sync handed to the pending queue (never fetched here: no Riot call may escape). */
  let queued: string[] = []
  group.each.setup(() => {
    queued = []
    pendingMatches.enqueue = (matchId) => {
      queued.push(matchId)
      return true
    }
  })

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
    pendingMatches.enqueue = enqueue
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

  test('Brawl games from match-v5 are never stored, and not fetched again', async ({ assert }) => {
    let fetched = 0
    riotApiService.client = {
      matchV5: {
        getIdsByPuuid: async () => ['EUW1_3'],
        getMatchById: async () => {
          fetched++
          return { info: { platformId: 'EUW1', queueId: 2300, participants: [{ puuid: 'p1' }] } }
        },
        getMatchTimelineById: async () => ({ info: { frames: [] } }),
      },
    } as unknown as typeof client
    matchRepository.getExistingIds = async () => new Set()
    Summoner.find = (async () => null) as unknown as typeof find
    const touched: string[] = []
    matchService.archive = async () => {
      touched.push('archive')
    }
    matchSourceService.claim = async () => {
      touched.push('claim')
      return true
    }
    ingestionService.ingestMatch = async () => {
      touched.push('ingest')
      return { platform: 'EUW1', gameStartMs: 1 }
    }

    assert.deepEqual(await matchService.update('brawl-player', PlatformId.EUROPE), [])
    assert.deepEqual(await matchService.update('brawl-player', PlatformId.EUROPE), [])
    assert.deepEqual(touched, [])
    assert.equal(fetched, 1)
  })

  test('asks for the timeline only once the match is in and claimed', async ({ assert }) => {
    const calls: string[] = []
    riotApiService.client = {
      matchV5: {
        getMatchById: async () => {
          calls.push('match')
          await new Promise<void>((resolve) => setImmediate(resolve))
          return { info: { platformId: 'EUW1', gameStartTimestamp: 1, participants: [] } }
        },
        getMatchTimelineById: async () => {
          calls.push('timeline')
          return { info: { frames: [] } }
        },
      },
    } as unknown as typeof client
    matchService.archive = async () => {}
    matchSourceService.claim = async () => {
      calls.push('claim')
      return true
    }
    ingestionService.ingestMatch = async () => ({ platform: 'EUW1', gameStartMs: 1 })
    ingestionService.ingestTimeline = async () => {}
    redis.pipeline = (() => ({
      eval() {},
      publish() {},
      exec: async () => [],
    })) as unknown as typeof pipeline

    await matchService.fetchAndStoreMatch('EUW1_4', PlatformId.EUROPE)
    assert.deepEqual(calls, ['match', 'claim', 'timeline'])
  })

  test('a game another writer claimed costs no timeline call', async ({ assert }) => {
    let timelines = 0
    riotApiService.client = {
      matchV5: {
        getMatchById: async () => ({
          info: { platformId: 'EUW1', gameStartTimestamp: 1, participants: [] },
        }),
        getMatchTimelineById: async () => {
          timelines++
          return { info: { frames: [] } }
        },
      },
    } as unknown as typeof client
    matchService.archive = async () => {}
    matchSourceService.claim = async () => false

    await matchService.fetchAndStoreMatch('EUW1_5', PlatformId.EUROPE)
    assert.equal(timelines, 0)
  })

  test('a sync waits for every game, and hands those Riot cannot give yet to the pending queue', async ({
    assert,
  }) => {
    riotApiService.client = {
      matchV5: { getIdsByPuuid: async () => ['EUW1_10', 'EUW1_11'] },
    } as unknown as typeof client
    matchRepository.getExistingIds = async () => new Set()
    Summoner.find = (async () => null) as unknown as typeof find
    let storedSlowly = false
    matchService.fetchAndStoreMatch = async (matchId) => {
      if (matchId === 'EUW1_11') {
        // match-v5 does not serve a game that just ended yet.
        throw new Exception('Summoner not found', { status: 404, code: 'E_SUMMONER_NOT_FOUND' })
      }
      await new Promise((resolve) => setTimeout(resolve, 20))
      storedSlowly = true
      return { matchId, platform: 'EUW1', gameStartMs: 1 }
    }

    const result = await matchService.update('slow-player', PlatformId.EUROPE)
    assert.isTrue(storedSlowly, 'answered once the slower game was stored')
    assert.deepEqual(result, [{ matchId: 'EUW1_10', platform: 'EUW1', gameStartMs: 1 }])
    assert.deepEqual(queued, ['EUW1_11'], 'asked again a few minutes later')
  })

  test('a sync fails only when it stored nothing, and still queues the games', async ({
    assert,
  }) => {
    riotApiService.client = {
      matchV5: { getIdsByPuuid: async () => ['EUW1_12', 'EUW1_13'] },
    } as unknown as typeof client
    matchRepository.getExistingIds = async () => new Set()
    Summoner.find = (async () => null) as unknown as typeof find
    const busy = new RiotUpstreamException('busy', 'E_RIOT_RATE_LIMITED', 429, 60)
    matchService.fetchAndStoreMatch = async (matchId) => {
      if (matchId === 'EUW1_12') throw busy
      throw new Exception('Summoner not found', { status: 404, code: 'E_SUMMONER_NOT_FOUND' })
    }
    await assert.rejects(() => matchService.update('busy-player', PlatformId.EUROPE), 'busy')
    assert.deepEqual(queued, ['EUW1_12', 'EUW1_13'])

    // Nothing Riot could give yet, and nothing else wrong: an empty sync, not a failed one.
    riotApiService.client = {
      matchV5: { getIdsByPuuid: async () => ['EUW1_14'] },
    } as unknown as typeof client
    assert.deepEqual(await matchService.update('early-player', PlatformId.EUROPE), [])
    assert.deepEqual(queued, ['EUW1_12', 'EUW1_13', 'EUW1_14'])
  })
})
