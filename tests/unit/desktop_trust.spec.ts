import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import deviceService, { TRUST, isTrusted } from '#services/desktop/device_service'
import DesktopDevice from '#models/desktop_device'
import { DesktopSeed, TRUSTED } from '#tests/fixtures/desktop_db'

const NOW = DateTime.fromISO('2026-10-08T12:00:00Z')

function device(overrides: Partial<DesktopDevice> = {}) {
  return {
    verifiedUploads: 5,
    verifiedDays: 3,
    mismatches: 0,
    createdAt: NOW.minus({ days: 3 }),
    revokedAt: null,
    ...overrides,
  } as DesktopDevice
}

test.group('Desktop device trust (§1.2)', (group) => {
  group.tap((t) => t.tags(['@desktop']))

  test('is earned by 5 verified games on 3 days, from a device 3 days old', ({ assert }) => {
    assert.deepEqual(TRUST, { verifiedUploads: 5, verifiedDays: 3, minAgeDays: 3 })
    assert.isTrue(isTrusted(device(), NOW))
    assert.isFalse(isTrusted(device({ verifiedUploads: 4 }), NOW))
    assert.isFalse(isTrusted(device({ verifiedDays: 2 }), NOW))
    assert.isFalse(isTrusted(device({ verifiedUploads: 50, verifiedDays: 2 }), NOW))
    assert.isFalse(isTrusted(device({ createdAt: NOW.minus({ days: 2, hours: 23 }) }), NOW))
    assert.isFalse(isTrusted(device({ mismatches: 1 }), NOW))
    assert.isFalse(isTrusted(device({ revokedAt: NOW }), NOW))
  })
})

test.group('Desktop device trust and rollback (database)', (group) => {
  group.tap((t) => t.tags(['@desktop']))
  let seed: DesktopSeed

  group.each.setup(() => {
    seed = new DesktopSeed()
  })
  group.each.teardown(async () => {
    await seed.cleanup()
  })

  test('verified games count distinct days, not uploads', async ({ assert }) => {
    const { device: fresh } = await seed.device()
    await deviceService.verified(fresh.id)
    await deviceService.verified(fresh.id)
    let row = await DesktopDevice.findOrFail(fresh.id)
    assert.deepEqual([row.verifiedUploads, row.verifiedDays], [2, 1])

    await db
      .from('desktop_device')
      .where('id', fresh.id)
      .update({ last_verified_on: DateTime.utc().minus({ days: 1 }).toISODate() })
    await deviceService.verified(fresh.id)
    row = await DesktopDevice.findOrFail(fresh.id)
    assert.deepEqual([row.verifiedUploads, row.verifiedDays], [3, 2])
    assert.isFalse(isTrusted(row))

    const { device: seasoned } = await seed.device(TRUSTED)
    assert.isTrue(isTrusted(seasoned))
  })

  test('a mismatch revokes the device and undoes everything it wrote', async ({ assert }) => {
    const { device: liar } = await seed.device(TRUSTED)
    const { device: honest } = await seed.device(TRUSTED)
    const player = await seed.player()
    const matchId = `EUW1_${Date.now()}`
    seed.matchIds.push(matchId)
    const raw = randomUUID()
    seed.raws.push(raw)
    const at = (minutes: number) => new Date(Date.now() - minutes * 60_000)

    await db.table('riot_rank').multiInsert([
      // Riot's own row, and another device's: both stay.
      {
        puuid: player.puuid,
        queue_type: 'RANKED_SOLO_5x5',
        tier: 'SILVER',
        division: 'I',
        league_points: 10,
        wins: 1,
        losses: 1,
        fetched_at: at(60),
      },
      {
        puuid: player.puuid,
        queue_type: 'RANKED_FLEX_SR',
        tier: 'GOLD',
        division: 'I',
        league_points: 10,
        wins: 1,
        losses: null,
        fetched_at: at(30),
        source: 'desktop',
        device_id: honest.id,
      },
      {
        puuid: player.puuid,
        queue_type: 'RANKED_SOLO_5x5',
        tier: 'DIAMOND',
        division: 'I',
        league_points: 10,
        wins: 2,
        losses: null,
        fetched_at: at(5),
        source: 'desktop',
        device_id: liar.id,
      },
    ])
    await db.table('riot_rank_confirmed').insert({
      puuid: player.puuid,
      queue_type: 'RANKED_SOLO_5x5',
      confirmed_at: at(1),
      device_id: liar.id,
    })
    await db.table('player_mastery').insert({
      puuid: player.puuid,
      entries: JSON.stringify([]),
      observed_at: at(1),
      source: 'desktop',
      device_id: liar.id,
    })
    await db.table('player_observation').insert({
      raw_puuid: raw,
      game_name: player.game_name,
      tag_line: 'TST',
      platform: 'EUW1',
      observed_at: at(1),
      device_id: liar.id,
      payload_hash: 'a'.repeat(64),
      puuid: player.puuid,
      status: 'applied',
    })
    await db.table('match_source').insert({
      match_id: matchId,
      source: 'desktop',
      verification: 'unverified',
      first_device_id: liar.id,
    })
    await db.table('lp_change').insert({
      match_id: matchId,
      puuid: player.puuid,
      queue: 'RANKED_SOLO_5x5',
      before_tier: 'GOLD',
      before_division: 'I',
      before_lp: 90,
      before_wins: 1,
      before_losses: 1,
      before_at: at(40),
      after_tier: 'PLATINUM',
      after_division: 'IV',
      after_lp: 10,
      after_wins: 2,
      after_losses: 1,
      after_at: at(5),
      delta: 20,
      device_id: liar.id,
    })

    const rollback = await deviceService.mismatch(liar.id, `player:${player.puuid}`, ['tier'])
    assert.deepEqual(rollback, { matches: [matchId], players: [player.puuid] })

    const revoked = await DesktopDevice.findOrFail(liar.id)
    assert.equal(revoked.mismatches, 1)
    assert.equal(revoked.revokedReason, 'mismatch')
    const ranks = await db.from('riot_rank').where('puuid', player.puuid).orderBy('fetched_at')
    assert.deepEqual(
      ranks.map((row) => row.tier),
      ['SILVER', 'GOLD']
    )
    assert.lengthOf(await db.from('riot_rank_confirmed').where('device_id', liar.id), 0)
    assert.lengthOf(await db.from('player_mastery').where('device_id', liar.id), 0)
    const [observation, source, change, other] = await Promise.all([
      db.from('player_observation').where('raw_puuid', raw).first(),
      db.from('match_source').where('match_id', matchId).first(),
      db.from('lp_change').where('match_id', matchId).first(),
      DesktopDevice.findOrFail(honest.id),
    ])
    assert.equal(observation.status, 'conflict')
    assert.equal(source.verification, 'conflict')
    assert.equal(change.status, 'conflict')
    assert.isNull(other.revokedAt)
  })
})
