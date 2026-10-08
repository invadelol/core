import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import riotApiService from '#services/riot/api'
import summonerService from '#services/summoner_service'
import playerInsightsService from '#services/player_insights_service'
import resolveService from '#services/desktop/resolve_service'
import playerSnapshotService from '#services/desktop/player_snapshot_service'
import { RetryScheduler } from '#services/desktop/retry_scheduler'
import * as snapshotHooks from '#services/desktop/snapshot_hooks'
import DesktopDevice from '#models/desktop_device'
import Summoner from '#models/summoner'
import { apiPuuid } from '#tests/fixtures/desktop'
import { DesktopSeed, TRUSTED } from '#tests/fixtures/desktop_db'
import type { PlayerStatus } from '#services/desktop/player_snapshot_service'

/**
 * Player snapshots (docs/desktop-sync.md §6) against the isolated Postgres
 * database, with Riot stubbed: identity mapping, staging, the trust and
 * apply rules, the league-v4 and mastery savings, and the audit that rolls
 * a lying device back.
 */
test.group('Desktop player snapshots', (group) => {
  group.tap((t) => t.tags(['@desktop']))
  const client = riotApiService.client
  const mastery = playerInsightsService.mastery
  const service = {
    championIds: playerSnapshotService.championIds,
    sample: playerSnapshotService.sample,
    audits: playerSnapshotService.audits,
  }
  let seed: DesktopSeed
  let leagueCalls: string[]

  group.each.setup(() => {
    seed = new DesktopSeed()
    leagueCalls = []
    playerSnapshotService.championIds = async () => null
    playerSnapshotService.sample = () => false
    playerSnapshotService.audits = new RetryScheduler([10, 20])
    riotApiService.client = {
      league: {
        getEntriesByPUUID: async ({ puuid }: { puuid: string }) => {
          leagueCalls.push(puuid)
          return []
        },
      },
    } as unknown as typeof client
  })

  group.each.teardown(async () => {
    await snapshotHooks.settled()
    playerSnapshotService.audits.clear()
    riotApiService.client = client
    playerInsightsService.mastery = mastery
    Object.assign(playerSnapshotService, service)
    await seed.cleanup()
  })

  const minutesAgo = (minutes: number) => Date.now() - minutes * 60_000

  /** A player as the desktop app reports it; tracked for cleanup. */
  function snapshot(overrides: Record<string, unknown> = {}) {
    const rawPuuid = (overrides.rawPuuid as string) ?? randomUUID()
    if (/^[0-9a-f-]{36}$/i.test(rawPuuid)) seed.raws.push(rawPuuid)
    return {
      gameName: `Nobody${Math.random().toString(36).slice(2, 8)}`,
      tagLine: 'TST',
      profileIconId: 4568,
      summonerLevel: 245,
      privacy: 'PUBLIC',
      self: false,
      context: 'profile',
      observedAt: minutesAgo(1),
      ranks: [
        {
          queue: 'RANKED_SOLO_5x5',
          tier: 'EMERALD',
          division: 'II',
          lp: 64,
          wins: 61,
          losses: null,
        },
      ],
      mastery: [
        { championId: 45, championLevel: 38, championPoints: 402115, lastPlayTime: minutesAgo(90) },
        {
          championId: 103,
          championLevel: 12,
          championPoints: 90210,
          lastPlayTime: minutesAgo(900),
        },
      ],
      ...overrides,
      rawPuuid,
    }
  }

  async function report(
    device: DesktopDevice,
    players: Array<Record<string, unknown>>,
    ip = '203.0.113.7'
  ) {
    const { results } = await playerSnapshotService.ingest(
      { schema: 1, platform: 'EUW1', app: '0.2.7', players: players as any },
      { device, ip }
    )
    return results
  }

  async function statusOf(device: DesktopDevice, player: Record<string, unknown>, ip?: string) {
    const [result] = await report(device, [player], ip)
    return result.status as PlayerStatus
  }

  const ranksOf = (puuid: string) =>
    db.from('riot_rank').where('puuid', puuid).orderBy('fetched_at', 'desc')
  const newestRank = (puuid: string) => ranksOf(puuid).first()
  const storedPlayer = (puuid: string) => Summoner.findOrFail(puuid)

  async function rank(puuid: string, minutes: number, overrides: Record<string, unknown> = {}) {
    await db.table('riot_rank').insert({
      puuid,
      queue_type: 'RANKED_SOLO_5x5',
      tier: 'EMERALD',
      division: 'II',
      league_points: 64,
      wins: 61,
      losses: 52,
      fetched_at: new Date(minutesAgo(minutes)),
      ...overrides,
    })
  }

  test('maps by alias first, then by Riot ID on the platform, else stages', async ({ assert }) => {
    const { device } = await seed.device(TRUSTED)
    const [aliased, named] = [await seed.player(), await seed.player()]
    const raw = randomUUID()
    await db.table('riot_puuid_alias').insert({
      raw_puuid: raw,
      puuid: aliased.puuid,
      game_name: aliased.game_name,
      tag_line: 'TST',
      status: 'asserted',
    })

    const results = await report(device, [
      // Carries the other player's Riot ID, but its raw PUUID is known: the alias wins.
      snapshot({ rawPuuid: raw, gameName: named.game_name }),
      snapshot({ gameName: named.game_name }),
      snapshot({ gameName: 'Unknown', tagLine: 'NOPE' }),
      snapshot({ rawPuuid: 'nope' }),
    ])
    assert.deepEqual(
      results.map((r) => r.status),
      ['applied', 'applied', 'staged', 'rejected']
    )
    assert.deepInclude(results[3], { code: 'E_INVALID_PLAYER', message: 'rawPuuid is not a UUID' })
    assert.lengthOf(await ranksOf(aliased.puuid), 1)
    assert.lengthOf(await ranksOf(named.puuid), 1)

    // The Riot ID match is remembered, as §3 does for game participants.
    const learned = await db
      .from('riot_puuid_alias')
      .where('raw_puuid', results[1].rawPuuid)
      .first()
    assert.include(learned, { puuid: named.puuid, status: 'asserted' })
    const staged = await db
      .from('player_observation')
      .where('raw_puuid', results[2].rawPuuid)
      .first()
    assert.include(staged, { status: 'staged', puuid: null })
  })

  test('a staged snapshot is applied when core learns the Riot ID, if recent', async ({
    assert,
  }) => {
    const { device } = await seed.device(TRUSTED)
    const fresh = snapshot({ gameName: 'Later', tagLine: 'EUW' })
    const old = snapshot({ gameName: 'Older', tagLine: 'EUW' })
    assert.deepEqual(
      await report(device, [fresh, old]).then((results) => results.map((r) => r.status)),
      ['staged', 'staged']
    )
    // Past 24 hours a staged report is not worth applying.
    await db
      .from('player_observation')
      .where('raw_puuid', old.rawPuuid)
      .update({ observed_at: new Date(minutesAgo(25 * 60)) })

    // The website resolves the Riot ID: account-v1 and summoner-v4, stubbed.
    const puuid = apiPuuid()
    seed.puuids.push(puuid)
    riotApiService.client = {
      account: { getByRiotId: async () => ({ puuid, gameName: 'Later', tagLine: 'EUW' }) },
      summoner: { getByPUUID: async () => ({ profileIconId: 1, summonerLevel: 10 }) },
    } as unknown as typeof client
    await summonerService.resolveAndUpsert('Later-EUW', 'EUW1')
    await snapshotHooks.settled()

    const applied = await db.from('player_observation').where('raw_puuid', fresh.rawPuuid).first()
    assert.include(applied, { status: 'applied', puuid })
    const [row] = await ranksOf(puuid)
    assert.include(row, {
      source: 'desktop',
      tier: 'EMERALD',
      league_points: 64,
      device_id: device.id,
    })
    const alias = await db.from('riot_puuid_alias').where('raw_puuid', fresh.rawPuuid).first()
    assert.include(alias, { puuid, status: 'asserted' })

    // Participants of a stored game teach Riot IDs too; the stale one stays staged.
    const otherPuuid = apiPuuid()
    seed.puuids.push(otherPuuid)
    await summonerService.upsertFromParticipants(
      [
        {
          puuid: otherPuuid,
          gameName: 'Older',
          tagLine: 'EUW',
          profileIconId: 1,
          summonerLevel: 1,
        },
      ],
      'EUW1'
    )
    await snapshotHooks.settled()
    const kept = await db.from('player_observation').where('raw_puuid', old.rawPuuid).first()
    assert.equal(kept.status, 'staged')
  })

  test('ranks: newer is applied, the same is confirmed, older is stale', async ({ assert }) => {
    const { device } = await seed.device(TRUSTED)
    const player = await seed.player()
    const base = {
      gameName: player.game_name,
      profileIconId: null,
      summonerLevel: null,
      mastery: null,
    }

    // Riot said the same thing an hour ago: only the confirmation moves.
    await rank(player.puuid, 60)
    const same = snapshot({ ...base, observedAt: minutesAgo(2) })
    assert.equal(await statusOf(device, same), 'unchanged')
    assert.lengthOf(await ranksOf(player.puuid), 1)
    const confirmed = await db.from('riot_rank_confirmed').where('puuid', player.puuid)
    assert.lengthOf(confirmed, 2)
    const solo = confirmed.find((row) => row.queue_type === 'RANKED_SOLO_5x5')
    assert.equal(new Date(solo.confirmed_at).getTime(), same.observedAt)
    // No flex rank anywhere: seen unranked there.
    assert.isTrue(confirmed.some((row) => row.queue_type === 'RANKED_FLEX_SR'))

    // Newer and different: a desktop row, other players' losses unknown.
    const newer = snapshot({
      ...base,
      rawPuuid: same.rawPuuid,
      observedAt: minutesAgo(1),
      ranks: [{ queue: 'RANKED_SOLO_5x5', tier: 'EMERALD', division: 'II', lp: 83, wins: 62 }],
    })
    assert.equal(await statusOf(device, newer), 'applied')
    const [latest] = await ranksOf(player.puuid)
    assert.include(latest, { league_points: 83, wins: 62, losses: null, source: 'desktop' })
    assert.equal(new Date(latest.fetched_at).getTime(), newer.observedAt)

    // Riot read the rank since: a report from before that read changes nothing,
    // even from another device. (Same raw PUUID: it is the same player.)
    await rank(player.puuid, 0, { league_points: 99, wins: 63, losses: 53 })
    const { device: other } = await seed.device(TRUSTED)
    const older = { ...newer, observedAt: minutesAgo(0.5) }
    assert.equal(await statusOf(other, older), 'stale')
    const kept = await newestRank(player.puuid)
    assert.equal(kept.league_points, 99)

    // And a report older than the one core holds for that raw PUUID is stale outright.
    assert.equal(await statusOf(device, { ...newer, observedAt: minutesAgo(5) }), 'stale')
  })

  test('the account itself keeps its losses', async ({ assert }) => {
    const { device } = await seed.device()
    const player = await seed.player()
    const raw = randomUUID()
    await seed.link(device.id, player.puuid, raw)
    const own = snapshot({
      rawPuuid: raw,
      gameName: player.game_name,
      self: true,
      context: 'self',
      ranks: [
        { queue: 'RANKED_SOLO_5x5', tier: 'GOLD', division: 'I', lp: 12, wins: 40, losses: 38 },
      ],
    })
    // An untrusted device still applies its own linked account.
    assert.equal(await statusOf(device, own), 'applied')
    assert.include(await newestRank(player.puuid), { tier: 'GOLD', wins: 40, losses: 38 })
  })

  test('icon and level only when newer than the last refresh', async ({ assert }) => {
    const { device } = await seed.device(TRUSTED)
    const player = await seed.player()
    const fresh = snapshot({ gameName: player.game_name, ranks: null, mastery: null })
    assert.equal(await statusOf(device, fresh), 'applied')
    const updated = await Summoner.findOrFail(player.puuid)
    assert.deepEqual([updated.profileIconId, updated.summonerLevel], [4568, 245])
    const history = await db.from('riot_player_history').where('puuid', player.puuid)
    assert.lengthOf(history, 1)

    // Riot refreshed the profile after this report was taken.
    await db
      .from('riot_player')
      .where('puuid', player.puuid)
      .update({ last_refresh_at: new Date() })
    const behind = { ...fresh, profileIconId: 1, observedAt: minutesAgo(0.5) }
    assert.equal(await statusOf(device, behind), 'stale')
    const unchanged = await storedPlayer(player.puuid)
    assert.equal(unchanged.profileIconId, 4568)
  })

  test('a different Riot ID is a rename only through a verified alias', async ({ assert }) => {
    const { device } = await seed.device(TRUSTED)
    const player = await seed.player()
    const raw = randomUUID()
    await db.table('riot_puuid_alias').insert({
      raw_puuid: raw,
      puuid: player.puuid,
      game_name: player.game_name,
      tag_line: 'TST',
      status: 'asserted',
    })
    const renamed = {
      rawPuuid: raw,
      gameName: 'Renamed',
      tagLine: 'NEW',
      ranks: null,
      mastery: null,
    }

    await report(device, [snapshot(renamed)])
    const notRenamed = await storedPlayer(player.puuid)
    assert.equal(notRenamed.gameName, player.game_name)

    await db.from('riot_puuid_alias').where('raw_puuid', raw).update({ status: 'verified' })
    await report(device, [snapshot({ ...renamed, observedAt: minutesAgo(0.5) })])
    const stored = await Summoner.findOrFail(player.puuid)
    assert.deepEqual([stored.gameName, stored.tagLine], ['Renamed', 'NEW'])
    const history = await db
      .from('riot_player_history')
      .where('puuid', player.puuid)
      .orderBy('observed_at', 'desc')
      .first()
    assert.include(history, { game_name: 'Renamed', tag_line: 'NEW' })
  })

  test('an untrusted device is held until another network agrees', async ({ assert }) => {
    const [first, second, third] = [await seed.device(), await seed.device(), await seed.device()]
    const player = await seed.player()
    const report1 = snapshot({ gameName: player.game_name })
    assert.equal(await statusOf(first.device, report1, '198.51.100.1'), 'held')
    assert.lengthOf(await ranksOf(player.puuid), 0)

    // Same device again, or another device on the same network: still held.
    const again = { ...report1, observedAt: minutesAgo(0.8) }
    assert.equal(await statusOf(first.device, again, '198.51.100.1'), 'held')
    assert.equal(
      await statusOf(second.device, { ...report1, observedAt: minutesAgo(0.6) }, '198.51.100.1'),
      'held'
    )

    // Another device elsewhere sees the same rank: corroborated, applied.
    assert.equal(
      await statusOf(third.device, { ...report1, observedAt: minutesAgo(0.4) }, '192.0.2.50'),
      'applied'
    )
    assert.lengthOf(await ranksOf(player.puuid), 1)
  })

  test('a rank too far from one stored within a day is held, even when trusted', async ({
    assert,
  }) => {
    const { device } = await seed.device(TRUSTED)
    const player = await seed.player()
    await rank(player.puuid, 120)
    const forged = snapshot({
      gameName: player.game_name,
      ranks: [{ queue: 'RANKED_SOLO_5x5', tier: 'CHALLENGER', division: 'I', lp: 900, wins: 62 }],
    })
    assert.equal(await statusOf(device, forged), 'held')
    assert.lengthOf(await ranksOf(player.puuid), 1)
  })

  test('mastery: a fresh snapshot stands in for the top ten, not for the full list', async ({
    assert,
  }) => {
    const { device } = await seed.device(TRUSTED)
    const player = await seed.player()
    let riotReads = 0
    playerInsightsService.mastery = async () => {
      riotReads++
      return [
        {
          championId: 1,
          championLevel: 5,
          championPoints: 10,
          lastPlayTime: 1,
          source: 'riot' as const,
          observedAt: Date.now(),
        },
      ]
    }

    assert.equal(await statusOf(device, snapshot({ gameName: player.game_name })), 'applied')
    const top = await playerInsightsService.top(player.puuid, 5)
    assert.deepEqual(
      top.map((entry) => [entry.championId, entry.source]),
      [
        [45, 'desktop'],
        [103, 'desktop'],
      ]
    )
    assert.isNumber(top[0].observedAt)
    assert.equal(riotReads, 0)

    // More than the snapshot holds: Riot, as before.
    await playerInsightsService.top(player.puuid, 11)
    assert.equal(riotReads, 1)

    // A day later the snapshot no longer counts.
    await db
      .from('player_mastery')
      .where('puuid', player.puuid)
      .update({ observed_at: new Date(minutesAgo(25 * 60)) })
    const [first] = await playerInsightsService.top(player.puuid, 5)
    assert.equal(first.source, 'riot')
    assert.equal(riotReads, 2)
  })

  test('league-v4 is skipped while the newest rank or its confirmation is fresh', async ({
    assert,
  }) => {
    const player = await seed.player()
    const summoner = await Summoner.findOrFail(player.puuid)

    // A desktop rank from two minutes ago: no call.
    await rank(player.puuid, 2, { source: 'desktop', losses: null })
    const fresh = await resolveService.ranks(summoner)
    assert.lengthOf(leagueCalls, 0)
    assert.deepInclude(fresh.byQueue.get('RANKED_SOLO_5x5'), { source: 'desktop', losses: null })

    // An old row, confirmed a minute ago: no call either.
    const other = await seed.player()
    await rank(other.puuid, 3 * 24 * 60)
    await db.table('riot_rank_confirmed').insert({
      puuid: other.puuid,
      queue_type: 'RANKED_SOLO_5x5',
      confirmed_at: new Date(minutesAgo(1)),
    })
    await resolveService.ranks(await Summoner.findOrFail(other.puuid))
    assert.lengthOf(leagueCalls, 0)

    // Nothing known for twenty minutes: league-v4.
    const stale = await seed.player()
    await rank(stale.puuid, 20)
    await resolveService.ranks(await Summoner.findOrFail(stale.puuid))
    assert.deepEqual(leagueCalls, [stale.puuid])
    assert.isTrue(await summonerService.ranksFresh(player.puuid, { minutes: 3 }))
    assert.isFalse(await summonerService.ranksFresh(stale.puuid, { minutes: 10 }))
  })

  test('Riot reads supersede desktop rows and confirm unchanged ones', async ({ assert }) => {
    const player = await seed.player()
    await rank(player.puuid, 5, { source: 'desktop', losses: null })
    const entry = {
      queueType: 'RANKED_SOLO_5x5',
      tier: 'EMERALD',
      rank: 'II',
      leaguePoints: 64,
      wins: 61,
      losses: 52,
    }
    await summonerService.storeRanks(player.puuid, [entry])
    const [latest] = await ranksOf(player.puuid)
    assert.include(latest, { source: 'riot', losses: 52 })

    await summonerService.storeRanks(player.puuid, [entry])
    assert.lengthOf(await ranksOf(player.puuid), 2)
    const confirmation = await db.from('riot_rank_confirmed').where('puuid', player.puuid).first()
    assert.isNull(confirmation.device_id)
  })

  test('a sampled snapshot Riot contradicts revokes the device and undoes its data', async ({
    assert,
  }) => {
    const { device } = await seed.device(TRUSTED)
    const player = await seed.player()
    await rank(player.puuid, 3 * 24 * 60, { tier: 'SILVER', division: 'I' })
    playerSnapshotService.sample = () => true
    riotApiService.client = {
      league: {
        getEntriesByPUUID: async ({ puuid }: { puuid: string }) => {
          leagueCalls.push(puuid)
          return [
            {
              queueType: 'RANKED_SOLO_5x5',
              tier: 'SILVER',
              rank: 'I',
              leaguePoints: 64,
              wins: 61,
              losses: 52,
            },
          ]
        },
      },
    } as unknown as typeof client

    // An Emerald claim for a Silver player, from a device that earned trust.
    const claim = snapshot({ gameName: player.game_name })
    assert.equal(await statusOf(device, claim), 'applied')
    assert.isTrue(playerSnapshotService.audits.has(`player:${player.puuid}:${claim.observedAt}`))
    await new Promise((resolve) => setTimeout(resolve, 60))

    assert.deepEqual(leagueCalls, [player.puuid])
    const revoked = await DesktopDevice.findOrFail(device.id)
    assert.equal(revoked.mismatches, 1)
    assert.isNotNull(revoked.revokedAt)
    const rows = await ranksOf(player.puuid)
    assert.isFalse(rows.some((row) => row.device_id === device.id))
    // Riot's own answer to the audit stays, and so does the older Riot row.
    assert.include(rows[0], { tier: 'SILVER', source: 'riot' })
    assert.lengthOf(await db.from('player_mastery').where('device_id', device.id), 0)
    const observation = await db
      .from('player_observation')
      .where('raw_puuid', claim.rawPuuid)
      .first()
    assert.equal(observation.status, 'conflict')
  })

  test('an honest sampled snapshot leaves the device alone', async ({ assert }) => {
    const { device } = await seed.device(TRUSTED)
    const player = await seed.player()
    playerSnapshotService.sample = () => true
    riotApiService.client = {
      league: {
        getEntriesByPUUID: async () => [
          {
            queueType: 'RANKED_SOLO_5x5',
            tier: 'EMERALD',
            rank: 'II',
            leaguePoints: 70,
            wins: 61,
            losses: 52,
          },
        ],
      },
    } as unknown as typeof client
    assert.equal(await statusOf(device, snapshot({ gameName: player.game_name })), 'applied')
    await new Promise((resolve) => setTimeout(resolve, 60))
    const kept = await DesktopDevice.findOrFail(device.id)
    assert.isNull(kept.revokedAt)
    assert.equal(kept.mismatches, 0)
  })

  test('freshness: the newest applied report of the player', async ({ assert }) => {
    const { device } = await seed.device(TRUSTED)
    const player = await seed.player()
    assert.isNull(await playerSnapshotService.lastObservedAt(player.puuid))
    const seen = snapshot({ gameName: player.game_name })
    await report(device, [seen])
    const at = await playerSnapshotService.lastObservedAt(player.puuid)
    assert.equal(at?.toMillis(), seen.observedAt)
    assert.isTrue(at! < DateTime.now())
  })
})
