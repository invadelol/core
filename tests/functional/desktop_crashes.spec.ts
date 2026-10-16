import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import rateLimiter from '#services/desktop/rate_limiter'
import { DesktopSeed } from '#tests/fixtures/desktop_db'
import { desktopClient } from '#tests/fixtures/desktop_http'

const PATH = '/api/desktop/crashes'

/**
 * `POST /api/desktop/crashes` end to end (docs/desktop-sync.md §7): signed
 * like every desktop call, stored without the device, account or address.
 */
test.group('Desktop crash reports API', (group) => {
  group.tap((t) => t.tags(['@desktop']))
  const prefix = rateLimiter.prefix
  let seed: DesktopSeed
  let marker: string

  group.each.setup(() => {
    seed = new DesktopSeed()
    marker = `test ${randomUUID()}`
    rateLimiter.prefix = `desktop:rl:test:${randomUUID()}:`
  })
  group.each.teardown(async () => {
    rateLimiter.prefix = prefix
    await db.from('desktop_crash_report').whereLike('message', `${marker}%`).delete()
    await seed.cleanup()
  })

  const report = (message: string, extra: Record<string, unknown> = {}) => ({
    kind: 'panic',
    process: 'core',
    app: '0.3.2',
    os: 'windows',
    osVersion: '10.0.22631.4317',
    message,
    location: 'src/lcu.rs:120:9',
    at: Date.now() - 60_000,
    ...extra,
  })

  test('reports are stored as sent, and nothing ties them to the device', async ({
    client: http,
    assert,
  }) => {
    const credentials = await seed.device()
    const response = await desktopClient(http, credentials).post(PATH, {
      reports: [
        report(`${marker} called \`Option::unwrap()\` on a \`None\` value`),
        report(`${marker} TypeError: x is undefined`, {
          kind: 'error',
          process: 'overlay',
          location: '',
          osVersion: '',
        }),
      ],
    })
    response.assertStatus(202)
    response.assertBody({ stored: 2 })

    const rows = await db
      .from('desktop_crash_report')
      .whereLike('message', `${marker}%`)
      .orderBy('id')
    assert.lengthOf(rows, 2)
    assert.deepInclude(rows[0], {
      kind: 'panic',
      process: 'core',
      app: '0.3.2',
      os: 'windows',
      os_version: '10.0.22631.4317',
      location: 'src/lcu.rs:120:9',
    })
    assert.deepInclude(rows[1], { kind: 'error', process: 'overlay', location: '', os_version: '' })
    // Anonymous: no column could point back at a device, an account or an address.
    assert.sameMembers(Object.keys(rows[0]), [
      'id',
      'kind',
      'process',
      'app',
      'os',
      'os_version',
      'message',
      'location',
      'occurred_at',
      'received_at',
    ])
  })

  test('only a signed request from a known device gets in', async ({ client: http, assert }) => {
    const unsigned = await http.post(PATH).json({ reports: [report(`${marker} x`)] })
    unsigned.assertStatus(401)
    assert.equal(unsigned.body().errors[0].code, 'E_DEVICE_UNAUTHORIZED')
    const rows = await db.from('desktop_crash_report').whereLike('message', `${marker}%`)
    assert.lengthOf(rows, 0)
  })

  test('anything but 1-10 reports of the documented shape is refused', async ({
    client: http,
    assert,
  }) => {
    const credentials = await seed.device()
    const client = desktopClient(http, credentials)
    const bodies = [
      { reports: [] },
      { reports: Array.from({ length: 11 }, () => report(`${marker} x`)) },
      { reports: [report(`${marker} x`, { kind: 'segfault' })] },
      { reports: [report(`${marker} x`, { process: 'browser' })] },
      { reports: [report('x'.repeat(301))] },
      { reports: [report(`${marker} x`, { osVersion: 'Windows 11 Pro' })] },
      { reports: [report(`${marker} x`, { at: 'yesterday' })] },
    ]
    for (const body of bodies) {
      const response = await client.post(PATH, body)
      response.assertStatus(422)
      assert.equal(response.body().errors[0].code, 'E_VALIDATION_ERROR')
    }
    const rows = await db.from('desktop_crash_report').whereLike('message', `${marker}%`)
    assert.lengthOf(rows, 0)
  })

  test('a crash dated in the future is stored as received', async ({ client: http, assert }) => {
    const credentials = await seed.device()
    const before = Date.now()
    const response = await desktopClient(http, credentials).post(PATH, {
      reports: [report(`${marker} late clock`, { at: before + 86_400_000 })],
    })
    response.assertStatus(202)
    const [row] = await db.from('desktop_crash_report').whereLike('message', `${marker}%`)
    assert.isAtMost(new Date(row.occurred_at).getTime(), Date.now())
  })

  test('a device sends 20 batches an hour at most', async ({ client: http, assert }) => {
    const credentials = await seed.device()
    const client = desktopClient(http, credentials)
    for (let i = 0; i < 20; i++) {
      const response = await client.post(PATH, { reports: [report(`${marker} ${i}`)] })
      response.assertStatus(202)
    }
    const response = await client.post(PATH, { reports: [report(`${marker} 21`)] })
    response.assertStatus(429)
    assert.equal(response.body().errors[0].code, 'E_RATE_LIMITED')
  })
})
