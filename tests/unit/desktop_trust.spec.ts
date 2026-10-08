import { test } from '@japa/runner'
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
})
