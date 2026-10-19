import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import db from '@adonisjs/lucid/services/db'
import rateLimiter from '#services/desktop/rate_limiter'
import betaService, { compareVersions } from '#services/desktop/beta_service'
import { DesktopSeed } from '#tests/fixtures/desktop_db'
import { desktopClient, signedHeaders } from '#tests/fixtures/desktop_http'

/**
 * The admin dashboard owns the `admin` schema and migrates it itself
 * (invadelol/admin, migrations/001_admin.sql and 003_beta.sql). These are the
 * parts core reads and writes, made here when the test database lacks them.
 */
async function adminSchema() {
  await db.rawQuery(`CREATE SCHEMA IF NOT EXISTS admin`)
  await db.rawQuery(`CREATE TABLE IF NOT EXISTS admin.entitlement (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, user_id uuid, puuid text,
    label text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz,
    revoked_at timestamptz)`)
  await db.rawQuery(`CREATE OR REPLACE VIEW admin.active_entitlement AS
    SELECT kind, user_id, puuid, expires_at FROM admin.entitlement
    WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`)
  await db.rawQuery(`CREATE TABLE IF NOT EXISTS admin.beta_build (
    version text PRIMARY KEY, title text NOT NULL DEFAULT '', changes jsonb NOT NULL DEFAULT '[]',
    tests jsonb NOT NULL DEFAULT '[]', known jsonb NOT NULL DEFAULT '[]', assets jsonb NOT NULL DEFAULT '{}',
    state text NOT NULL DEFAULT 'draft', published_at timestamptz)`)
  await db.rawQuery(`CREATE OR REPLACE VIEW admin.live_beta_build AS
    SELECT version, title, changes, tests, known, assets, published_at FROM admin.beta_build WHERE state = 'live'`)
  await db.rawQuery(`CREATE TABLE IF NOT EXISTS admin.beta_device (
    device_id uuid PRIMARY KEY, puuid text NOT NULL, label text NOT NULL, app text NOT NULL, os text NOT NULL,
    first_seen_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now())`)
  await db.rawQuery(`CREATE TABLE IF NOT EXISTS admin.beta_result (
    build_version text NOT NULL, device_id uuid NOT NULL, test_id text NOT NULL, verdict text NOT NULL,
    note text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (build_version, device_id, test_id))`)
  await db.rawQuery(`CREATE TABLE IF NOT EXISTS admin.beta_note (
    id bigserial PRIMARY KEY, build_version text NOT NULL, device_id uuid NOT NULL, body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL DEFAULT 'open')`)
}

const ASSET = (name: string) => ({ name, assetId: 42, size: 5, signature: `sig-${name}` })

test.group('Desktop beta API', (group) => {
  group.tap((t) => t.tags(['@desktop']))
  const prefix = rateLimiter.prefix
  const open = betaService.open.bind(betaService)
  let seed: DesktopSeed
  let tag: string
  let versions: string[]

  group.setup(adminSchema)
  group.each.setup(() => {
    seed = new DesktopSeed()
    tag = randomUUID().slice(0, 8)
    versions = []
    rateLimiter.prefix = `desktop:rl:test:${randomUUID()}:`
  })
  group.each.teardown(async () => {
    rateLimiter.prefix = prefix
    betaService.open = open
    if (versions.length) {
      await db.from('admin.beta_build').whereIn('version', versions).delete()
      await db.from('admin.beta_result').whereIn('build_version', versions).delete()
      await db.from('admin.beta_note').whereIn('build_version', versions).delete()
    }
    if (seed.devices.length) {
      await db.from('admin.beta_device').whereIn('device_id', seed.devices).delete()
    }
    if (seed.puuids.length)
      await db.from('admin.entitlement').whereIn('puuid', seed.puuids).delete()
    await seed.cleanup()
  })

  /** A build, `live` unless said otherwise; versions are unique per test. */
  async function build(minor: number, extra: Record<string, unknown> = {}) {
    const version = `9.${minor}.0-beta.${tag.replace(/[^0-9]/g, '').slice(0, 6) || '1'}`
    versions.push(version)
    await db.table('admin.beta_build').insert({
      version,
      title: `Build ${minor}`,
      changes: JSON.stringify([{ text: 'Overlay folds to its bar' }]),
      tests: JSON.stringify([
        { id: 'fold', title: 'Fold an overlay', detail: 'Click its bar' },
        { id: 'keys', title: 'Show on a key' },
      ]),
      known: JSON.stringify([{ text: 'Mac mini: no overlay' }]),
      assets: JSON.stringify({ 'windows-x86_64': ASSET(`Invade_${version}_x64-setup.exe`) }),
      state: 'live',
      published_at: new Date(),
      ...extra,
    })
    return version
  }

  /** A device linked to a stored player, with a beta grant unless `granted` is false. */
  async function tester(granted = true) {
    const credentials = await seed.device()
    const player = await seed.player()
    await seed.link(credentials.device.id, player.puuid, null)
    if (granted) {
      await db.table('admin.entitlement').insert({ kind: 'beta', puuid: player.puuid, label: 'x' })
    }
    return { credentials, player }
  }

  test('a device without a beta grant sees nothing and gets nothing', async ({
    client: http,
    assert,
  }) => {
    await build(1)
    const { credentials } = await tester(false)
    const client = desktopClient(http, credentials)

    const shown = await client.get('/api/desktop/beta')
    shown.assertStatus(200)
    shown.assertBody({ tester: false, label: null, builds: [], answers: [] })

    const feed = await client.get('/api/desktop/beta/feed/windows-x86_64')
    feed.assertStatus(403)
    assert.equal(feed.body().errors[0].code, 'E_NOT_BETA')

    const sent = await client.post('/api/desktop/beta/feedback', {
      version: versions[0],
      note: 'hello',
    })
    sent.assertStatus(403)
    assert.lengthOf(await db.from('admin.beta_note').whereIn('build_version', versions), 0)
  })

  test('a tester sees live builds newest first, without installer details', async ({
    client: http,
    assert,
  }) => {
    const older = await build(1)
    const newer = await build(2)
    await build(3, { state: 'draft' })
    const { credentials, player } = await tester()

    const path = '/api/desktop/beta'
    const shown = await http.get(path).headers({
      ...signedHeaders(credentials, 'GET', path),
      'User-Agent': `Invade/${older} (windows)`,
    })
    shown.assertStatus(200)
    const body = shown.body()
    assert.isTrue(body.tester)
    assert.equal(body.label, `${player.game_name}#${player.tag_line}`)
    const mine = body.builds.filter((b: any) => versions.includes(b.version))
    assert.deepEqual(
      mine.map((b: any) => b.version),
      [newer, older]
    )
    assert.deepEqual(mine[0].platforms, ['windows-x86_64'])
    assert.notProperty(mine[0], 'assets')
    assert.equal(mine[0].tests[0].id, 'fold')

    const [row] = await db.from('admin.beta_device').where('device_id', credentials.device.id)
    assert.include(row, { puuid: player.puuid, app: older, os: 'windows' })
  })

  test('the feed offers the newest build for the target, through a short-lived link', async ({
    client: http,
    assert,
  }) => {
    await build(1)
    const newest = await build(2)
    const { credentials } = await tester()
    const client = desktopClient(http, credentials)

    const feed = await client.get('/api/desktop/beta/feed/windows-x86_64')
    feed.assertStatus(200)
    assert.equal(feed.body().version, newest)
    assert.equal(feed.body().signature, `sig-Invade_${newest}_x64-setup.exe`)
    assert.match(feed.body().url, /\/api\/desktop\/beta\/download\/[\w-]+\.[\w-]{43}$/)

    // No build carries a macOS installer.
    const none = await client.get('/api/desktop/beta/feed/darwin-aarch64')
    if (!(await betaService.newestFor('darwin-aarch64'))) none.assertStatus(204)

    const bad = await client.get('/api/desktop/beta/feed/linux-x86_64')
    bad.assertStatus(422)
  })

  test('a download link streams the installer, and only while it and the grant last', async ({
    client: http,
    assert,
  }) => {
    const version = await build(1)
    const { credentials, player } = await tester()
    betaService.open = async () => ({ stream: Readable.from([Buffer.from('MZ...')]), length: 5 })

    const token = betaService.downloadToken(version, 'windows-x86_64', credentials.device.id)
    const ok = await http.get(`/api/desktop/beta/download/${token}`)
    ok.assertStatus(200)
    assert.equal(ok.header('content-type'), 'application/octet-stream')
    assert.include(ok.header('content-disposition'), `Invade_${version}_x64-setup.exe`)

    const tampered = token.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'))
    const statusTampered401 = await http.get(`/api/desktop/beta/download/${tampered}`)
    statusTampered401.assertStatus(401)

    const expired = betaService.downloadToken(
      version,
      'windows-x86_64',
      credentials.device.id,
      Date.now() - 31 * 60_000
    )
    const statusExpired401 = await http.get(`/api/desktop/beta/download/${expired}`)
    statusExpired401.assertStatus(401)

    // No installer for that target in this build.
    const mac = betaService.downloadToken(version, 'darwin-aarch64', credentials.device.id)
    const statusMac404 = await http.get(`/api/desktop/beta/download/${mac}`)
    statusMac404.assertStatus(404)

    await db
      .from('admin.entitlement')
      .where('puuid', player.puuid)
      .update({ revoked_at: new Date() })
    const statusToken403 = await http.get(`/api/desktop/beta/download/${token}`)
    statusToken403.assertStatus(403)
  })

  test('verdicts replace earlier ones, unknown tests are ignored, notes are kept', async ({
    client: http,
    assert,
  }) => {
    const version = await build(1)
    const { credentials } = await tester()
    const client = desktopClient(http, credentials)
    const path = '/api/desktop/beta/feedback'

    const first = await client.post(path, {
      version,
      results: [
        { test: 'fold', verdict: 'broken', note: 'The bar stays open' },
        { test: 'ghost', verdict: 'works' },
      ],
      note: 'Crashed once when alt-tabbing',
    })
    first.assertStatus(200)
    first.assertBody({ results: 1, note: true })

    const second = await client.post(path, {
      version,
      results: [{ test: 'fold', verdict: 'works' }],
    })
    second.assertBody({ results: 1, note: false })

    const rows = await db.from('admin.beta_result').where('build_version', version)
    assert.lengthOf(rows, 1)
    assert.include(rows[0], { test_id: 'fold', verdict: 'works', note: '' })
    const notes = await db.from('admin.beta_note').where('build_version', version)
    assert.deepEqual(
      notes.map((n) => n.body),
      ['Crashed once when alt-tabbing']
    )

    const shown = await client.get('/api/desktop/beta')
    assert.deepInclude(shown.body().answers, { version, test: 'fold', verdict: 'works', note: '' })

    const unknown = await client.post(path, { version: '9.99.0-beta.1', note: 'x' })
    unknown.assertStatus(404)
    const invalid = await client.post(path, {
      version,
      results: [{ test: 'fold', verdict: 'meh' }],
    })
    invalid.assertStatus(422)
  })
})

test.group('Beta versions', () => {
  test('sort like semver, prereleases before their release', ({ assert }) => {
    const sorted = [
      '0.3.5',
      '0.3.5-beta.10',
      '0.3.4',
      '0.3.5-beta.2',
      '0.3.5-alpha.1',
      '0.4.0-beta.1',
    ].sort(compareVersions)
    assert.deepEqual(sorted, [
      '0.3.4',
      '0.3.5-alpha.1',
      '0.3.5-beta.2',
      '0.3.5-beta.10',
      '0.3.5',
      '0.4.0-beta.1',
    ])
  })
})
