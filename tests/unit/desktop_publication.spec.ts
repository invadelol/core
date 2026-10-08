import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { Exception } from '@adonisjs/core/exceptions'
import riotApiService from '#services/riot/api'
import ingestionService from '#services/analytics/ingestion_service'
import matchRepository from '#services/analytics/match_repository'
import summonerService from '#services/summoner_service'
import publicationService from '#services/desktop/publication_service'
import { RetryScheduler } from '#services/desktop/retry_scheduler'
import { uploadFacts } from '#services/desktop/conversion'
import DesktopDevice from '#models/desktop_device'
import MatchSource from '#models/match_source'
import { apiPuuids, makeUpload, riotMatch, UPLOADER_PARTICIPANT } from '#tests/fixtures/desktop'
import { DesktopSeed } from '#tests/fixtures/desktop_db'
import type { MatchUpload } from '#types/desktop'

/**
 * The publication policy (docs/desktop-sync.md §4.2) against the isolated
 * Postgres database, with everything outside it stubbed: the Riot client,
 * ClickHouse reads and writes, the R2 archive and the sampling dice.
 */
test.group('Desktop publication policy', (group) => {
  group.tap((t) => t.tags(['@desktop']))
  const client = riotApiService.client
  const ingestMatch = ingestionService.ingestMatch
  const ingestTimeline = ingestionService.ingestTimeline
  const existing = matchRepository.getExistingIds
  const facts = matchRepository.getFacts
  const upsert = summonerService.upsertFromParticipants
  const service = {
    championIds: publicationService.championIds,
    archive: publicationService.archive,
    sample: publicationService.sample,
    retries: publicationService.retries,
  }

  let seed: DesktopSeed
  let calls: { match: string[]; timeline: string[] }
  let ingested: { matches: any[]; timelines: any[] }

  group.each.setup(() => {
    seed = new DesktopSeed()
    calls = { match: [], timeline: [] }
    ingested = { matches: [], timelines: [] }
    ingestionService.ingestMatch = async (_id, match) => {
      ingested.matches.push(match)
      return { platform: 'EUW1', gameStartMs: Number(match.info.gameCreation) }
    }
    ingestionService.ingestTimeline = async (_id, _match, timeline) => {
      ingested.timelines.push(timeline)
    }
    matchRepository.getExistingIds = async () => new Set()
    matchRepository.getFacts = async () => null
    summonerService.upsertFromParticipants = async () => 0
    publicationService.championIds = async () => null
    publicationService.archive = async () => {}
    publicationService.sample = () => false
    publicationService.retries = new RetryScheduler([10, 20, 30])
  })

  group.each.teardown(async () => {
    publicationService.retries.clear()
    riotApiService.client = client
    ingestionService.ingestMatch = ingestMatch
    ingestionService.ingestTimeline = ingestTimeline
    matchRepository.getExistingIds = existing
    matchRepository.getFacts = facts
    summonerService.upsertFromParticipants = upsert
    Object.assign(publicationService, service)
    await seed.cleanup()
  })

  /** Riot answers with `answers` in turn: a match, or an error to throw. */
  function riot(...answers: unknown[]) {
    riotApiService.client = {
      matchV5: {
        getMatchById: async ({ matchId }: { matchId: string }) => {
          calls.match.push(matchId)
          const answer = answers.length > 1 ? answers.shift() : answers[0]
          if (answer instanceof Error) throw answer
          return answer
        },
        getMatchTimelineById: async ({ matchId }: { matchId: string }) => {
          calls.timeline.push(matchId)
          return { metadata: {}, info: { frames: [] } }
        },
      },
    } as unknown as typeof client
  }

  const notFound = () => new Exception('Not found', { status: 404 })

  /** A fresh game, its players stored, and a device linked to the uploader. */
  async function scenario(counters: { verifiedUploads?: number } = {}) {
    const upload = makeUpload({ fresh: true, gameId: 9e9 + Math.floor(Math.random() * 1e9) })
    const puuids = apiPuuids(upload)
    await seed.players(upload, puuids, [UPLOADER_PARTICIPANT])
    const { device } = await seed.device(counters)
    const uploader = upload.uploader.toLowerCase()
    await seed.link(device.id, puuids.get(uploader)!, upload.uploader)
    return { upload, puuids, device, uploader: puuids.get(uploader)! }
  }

  const send = (upload: MatchUpload, device: DesktopDevice, ip = '203.0.113.7') =>
    publicationService.upload(upload, { device, ip })

  async function statusOf(upload: MatchUpload, device: DesktopDevice, ip?: string) {
    const result = await send(upload, device, ip)
    return result.status
  }

  async function verifiedUploads(deviceId: string) {
    const row = await DesktopDevice.findOrFail(deviceId)
    return row.verifiedUploads
  }

  async function verificationOf(matchId: string) {
    const row = await MatchSource.findOrFail(matchId)
    return row.verification
  }

  test('an untrusted device costs one match-v5 call and publishes Riot’s game', async ({
    assert,
  }) => {
    const { upload, puuids, device } = await scenario()
    const match = riotMatch(upload, puuids)
    riot(match)

    const result = await send(upload, device)
    assert.equal(result.status, 'verified')
    assert.equal(result.lp, 'none')
    assert.match(result.url, /\/match\/EUW1_\d+$/)
    assert.deepEqual(calls, { match: [upload.matchId], timeline: [] })

    // Riot's data was stored, with the client's timeline in place of a second call.
    assert.strictEqual(ingested.matches[0], match)
    assert.equal(ingested.timelines[0].metadata.dataVersion, 'desktop-1')
    assert.equal(ingested.timelines[0].info.participants[0].puuid, match.info.participants[0].puuid)

    const source = await MatchSource.findOrFail(upload.matchId)
    assert.include(source.serialize(), { source: 'riot', verification: 'verified' })
    assert.equal(await verifiedUploads(device.id), 1)

    // Every participant's raw PUUID is now proven.
    const aliases = await db.from('riot_puuid_alias').whereIn('raw_puuid', seed.raws)
    assert.lengthOf(aliases, 10)
    for (const alias of aliases) {
      assert.equal(alias.status, 'verified')
      assert.equal(alias.puuid, puuids.get(alias.raw_puuid))
    }
  })

  test('a trusted device whose players are all known publishes for free', async ({ assert }) => {
    const { upload, puuids, device } = await scenario({ verifiedUploads: 5 })
    await seed.aliases(upload, puuids)
    riot(new Error('Riot must not be called'))

    const result = await send(upload, device)
    assert.equal(result.status, 'stored')
    assert.deepEqual(calls.match, [])

    const stored = ingested.matches[0]
    assert.equal(stored.metadata.dataVersion, 'desktop-1')
    assert.sameMembers(
      stored.info.participants.map((p: any) => p.puuid),
      [...puuids.values()]
    )
    const source = await MatchSource.findOrFail(upload.matchId)
    assert.include(source.serialize(), { source: 'desktop', verification: 'unverified' })
    assert.deepInclude(source.completeness, { pings: false, position: 'inferred' })
    assert.equal(source.firstDeviceId, device.id)
    assert.isFalse(publicationService.retries.has(`audit:${upload.matchId}`))
  })

  test('one trusted upload in ten is checked against Riot afterwards', async ({ assert }) => {
    const { upload, puuids, device } = await scenario({ verifiedUploads: 7 })
    await seed.aliases(upload, puuids)
    publicationService.sample = () => true
    riot(riotMatch(upload, puuids))

    assert.equal(await statusOf(upload, device), 'stored')
    assert.isTrue(publicationService.retries.has(`audit:${upload.matchId}`))

    matchRepository.getFacts = async () => {
      const { players, duration } = uploadFacts(upload)
      return { duration, mapId: 11, players }
    }
    await new Promise((resolve) => setTimeout(resolve, 60))
    assert.equal(await verificationOf(upload.matchId), 'verified')
    assert.equal(await verifiedUploads(device.id), 8)
  })

  test('a trusted device with an unknown player still goes through Riot', async ({ assert }) => {
    const { upload, puuids, device } = await scenario({ verifiedUploads: 9 })
    riot(riotMatch(upload, puuids))
    assert.equal(await statusOf(upload, device), 'verified')
    assert.lengthOf(calls.match, 1)
  })

  test('a game Riot has not published yet is deferred, then retried', async ({ assert }) => {
    const { upload, puuids, device } = await scenario()
    riot(notFound(), notFound(), riotMatch(upload, puuids))

    const result = await send(upload, device)
    assert.equal(result.status, 'deferred')
    assert.lengthOf(ingested.matches, 0)
    assert.isTrue(publicationService.retries.has(`publish:${upload.matchId}:${device.id}`))

    await new Promise((resolve) => setTimeout(resolve, 80))
    assert.lengthOf(calls.match, 3)
    assert.lengthOf(ingested.matches, 1)
    const row = await db
      .from('desktop_match_upload')
      .where('match_id', upload.matchId)
      .where('device_id', device.id)
      .first()
    assert.equal(row.status, 'verified')
  })

  test('the same device sending a game again is a duplicate', async ({ assert }) => {
    const { upload, puuids, device } = await scenario()
    riot(riotMatch(upload, puuids))
    await send(upload, device)
    const again = await send(upload, device)
    assert.equal(again.status, 'duplicate')
    assert.lengthOf(calls.match, 1)
    assert.lengthOf(ingested.matches, 1)
  })

  test('a game already stored from Riot judges the upload without a call', async ({ assert }) => {
    const { upload, device } = await scenario()
    riot(new Error('Riot must not be called'))
    matchRepository.getExistingIds = async (ids) => new Set(ids)
    matchRepository.getFacts = async () => {
      const { players, duration } = uploadFacts(upload)
      return { duration, mapId: 11, players }
    }

    assert.equal(await statusOf(upload, device), 'duplicate')
    assert.lengthOf(ingested.matches, 0)
    assert.equal(await verifiedUploads(device.id), 1)
  })

  test('a device Riot contradicts is revoked and its LP report dropped', async ({ assert }) => {
    const { upload, device } = await scenario()
    matchRepository.getExistingIds = async (ids) => new Set(ids)
    matchRepository.getFacts = async () => {
      const { players, duration } = uploadFacts(upload)
      players[0] = { ...players[0], kills: players[0].kills + 3 }
      return { duration, mapId: 11, players }
    }
    upload.lp = {
      queue: 'RANKED_SOLO_5x5',
      before: {
        tier: 'GOLD',
        division: 'II',
        lp: 40,
        wins: 10,
        losses: 9,
        at: upload.game.gameCreation,
      },
      after: { tier: 'GOLD', division: 'II', lp: 61, wins: 11, losses: 9, at: upload.capturedAt },
    }

    const result = await send(upload, device)
    assert.deepEqual([result.status, result.lp], ['duplicate', 'rejected'])
    const revoked = await DesktopDevice.findOrFail(device.id)
    assert.equal(revoked.mismatches, 1)
    assert.isNotNull(revoked.revokedAt)
  })

  test('a second device: agreement from elsewhere corroborates, disagreement is a conflict', async ({
    assert,
  }) => {
    const { upload, puuids, device } = await scenario({ verifiedUploads: 5 })
    await seed.aliases(upload, puuids)
    await send(upload, device, '198.51.100.1')

    // A teammate's device, linked to its own account.
    const teammate = upload.game.participantIdentities.find((i) => i.participantId === 4)!.player
    await seed.players(upload, puuids, [4])
    const second = await seed.device()
    await seed.link(second.device.id, puuids.get(teammate.puuid.toLowerCase())!, teammate.puuid)
    const theirs = structuredClone(upload)
    theirs.uploader = teammate.puuid
    assert.equal(await statusOf(theirs, second.device, '192.0.2.44'), 'duplicate')
    assert.equal(await verificationOf(upload.matchId), 'corroborated')

    // A third account's device reporting another build for the same game.
    const third = upload.game.participantIdentities.find((i) => i.participantId === 5)!.player
    await seed.players(upload, puuids, [5])
    const other = await seed.device()
    await seed.link(other.device.id, puuids.get(third.puuid.toLowerCase())!, third.puuid)
    const altered = structuredClone(upload)
    altered.uploader = third.puuid
    altered.game.participants[0].stats.item3 = 3078
    riot(notFound())
    const result = await send(altered, other.device, '192.0.2.99')
    assert.deepEqual([result.status, result.lp], ['duplicate', 'none'])
    assert.equal(await verificationOf(upload.matchId), 'conflict')
    assert.isTrue(publicationService.retries.has(`audit:${upload.matchId}`))
  })

  test('an uploader the device is not linked to is refused', async ({ assert }) => {
    const { upload } = await scenario()
    const { device } = await seed.device()
    const error = await send(upload, device).catch((caught) => caught)
    assert.equal(error.status, 403)
    assert.equal(error.code, 'E_NOT_LINKED')
  })

  test('a valid LP report is stored and refreshes the rank', async ({ assert }) => {
    const { upload, puuids, device, uploader } = await scenario()
    riot(riotMatch(upload, puuids))
    const after = upload.capturedAt - 30_000
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
      after: { tier: 'EMERALD', division: 'II', lp: 64, wins: 61, losses: 52, at: after },
    }

    const result = await send(upload, device)
    assert.equal(result.lp, 'stored')
    const change = await db.from('lp_change').where('match_id', upload.matchId).first()
    assert.include(change, { puuid: uploader, delta: 19, status: 'accepted' })
    const rank = await db
      .from('riot_rank')
      .where('puuid', uploader)
      .orderBy('fetched_at', 'desc')
      .first()
    assert.include(rank, { tier: 'EMERALD', division: 'II', league_points: 64, source: 'desktop' })
  })
})
