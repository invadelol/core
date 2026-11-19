import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import db from '@adonisjs/lucid/services/db'
import rateLimiter from '#services/desktop/rate_limiter'
import drive from '@adonisjs/drive/services/main'
import env from '#start/env'
import betaService, { compareVersions } from '#services/desktop/beta_service'
import bugReportService, { likeness, postContent } from '#services/desktop/bug_report_service'
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
  await db.rawQuery(
    `ALTER TABLE admin.beta_build ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`
  )
  // 004_beta_feedback.sql
  await db.rawQuery(`CREATE TABLE IF NOT EXISTS admin.beta_rating (
    build_version text NOT NULL, device_id uuid NOT NULL, rating smallint NOT NULL, comment text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (build_version, device_id))`)
  await db.rawQuery(`CREATE TABLE IF NOT EXISTS admin.bug_report (
    id bigserial PRIMARY KEY, title text NOT NULL, body text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'open',
    priority text NOT NULL DEFAULT 'normal', source text NOT NULL DEFAULT 'manual', reporter text NOT NULL DEFAULT '',
    app_version text NOT NULL DEFAULT '', os text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(), page text NOT NULL DEFAULT '', area text NOT NULL DEFAULT '',
    in_game text NOT NULL DEFAULT '', diagnostics text NOT NULL DEFAULT '', device_id uuid, discord_url text, same_as text)`)
  await db.rawQuery(`CREATE TABLE IF NOT EXISTS admin.bug_file (
    id bigserial PRIMARY KEY, bug_id bigint NOT NULL REFERENCES admin.bug_report(id) ON DELETE CASCADE,
    kind text NOT NULL, name text NOT NULL, mime text NOT NULL, size integer NOT NULL, bytes bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now())`)
}

const ASSET = (name: string) => ({
  name,
  key: `beta/test/${name}`,
  size: 5,
  signature: `sig-${name}`,
})

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
      await db.from('admin.beta_rating').whereIn('build_version', versions).delete()
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
    shown.assertBody({ tester: false, label: null, builds: [], answers: [], ratings: [] })

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
    first.assertBody({ results: 1, note: true, rating: false })

    const second = await client.post(path, {
      version,
      results: [{ test: 'fold', verdict: 'works' }],
    })
    second.assertBody({ results: 1, note: false, rating: false })

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

  test('a rating with its comment replaces the earlier one and comes back', async ({
    client: http,
    assert,
  }) => {
    const version = await build(1)
    const { credentials } = await tester()
    const client = desktopClient(http, credentials)
    const path = '/api/desktop/beta/feedback'

    const rated = await client.post(path, { version, rating: 3, comment: 'Fine' })
    rated.assertBody({
      results: 0,
      note: false,
      rating: true,
    })
    await client.post(path, { version, rating: 5, comment: 'Great build' })
    const rows = await db.from('admin.beta_rating').where('build_version', version)
    assert.lengthOf(rows, 1)
    assert.include(rows[0], { rating: 5, comment: 'Great build' })
    const shown = await client.get('/api/desktop/beta')
    assert.deepInclude(shown.body().ratings, { version, rating: 5, comment: 'Great build' })
    const tooMany = await client.post(path, { version, rating: 6 })
    tooMany.assertStatus(422)
  })

  test('the build workflow uploads a package with the secret only', async ({
    client: http,
    assert,
  }) => {
    const fake = drive.fake()
    const secret = env.get('BETA_UPLOAD_SECRET')
    env.set('BETA_UPLOAD_SECRET', 'test-upload-secret')
    try {
      const version = `9.7.0-beta.${tag.replace(/[^0-9]/g, '').slice(0, 6) || '1'}`
      versions.push(version)
      const url = `/api/beta/upload?version=${version}&target=darwin-aarch64&name=Invade_aarch64.app.tar.gz`
      const signature = Buffer.from('untrusted comment: signature\nRWS…').toString('base64')

      const anonymous = await http.put(url).header('x-invade-signature', signature)
      anonymous.assertStatus(401)
      const wrong = await http
        .put(url)
        .header('authorization', 'Bearer nope')
        .header('x-invade-signature', signature)
      wrong.assertStatus(401)

      const upload = http
        .put(url)
        .header('authorization', 'Bearer test-upload-secret')
        .header('x-invade-signature', signature)
        .header('content-type', 'application/octet-stream')
      // Superagent would serialise a Buffer as JSON: send the bytes as they are.
      upload.request
        .serialize((bytes: Buffer) => bytes as unknown as string)
        .send(Buffer.from('tarball-bytes'))
      const ok = await upload
      ok.assertStatus(200)
      assert.include(ok.body(), { version, target: 'darwin-aarch64', size: 13 })

      const [row] = await db.from('admin.beta_build').where('version', version)
      assert.equal(row.state, 'draft')
      const asset = row.assets['darwin-aarch64']
      assert.equal(asset.name, 'Invade_aarch64.app.tar.gz')
      assert.equal(asset.signature, signature)
      assert.match(
        asset.key,
        new RegExp(`^beta/${version.replace(/\./g, '\\.')}/darwin-aarch64-[0-9a-f]{32}/`)
      )
      fake.assertExists(asset.key)

      const bad = await http
        .put(`/api/beta/upload?version=nope&target=darwin-aarch64&name=x.tar.gz`)
        .header('authorization', 'Bearer test-upload-secret')
        .header('x-invade-signature', signature)
      bad.assertStatus(422)
    } finally {
      env.set('BETA_UPLOAD_SECRET', secret as any)
      drive.restore()
    }
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

test.group('Desktop bug reports', (group) => {
  group.tap((t) => t.tags(['@desktop']))
  const prefix = rateLimiter.prefix
  const post = bugReportService.post.bind(bugReportService)
  const threads = bugReportService.threads.bind(bugReportService)
  let seed: DesktopSeed
  let ids: number[]

  group.setup(adminSchema)
  group.each.setup(() => {
    seed = new DesktopSeed()
    ids = []
    rateLimiter.prefix = `desktop:rl:test:${randomUUID()}:`
  })
  group.each.teardown(async () => {
    rateLimiter.prefix = prefix
    bugReportService.post = post
    bugReportService.threads = threads
    if (ids.length) await db.from('admin.bug_report').whereIn('id', ids).delete()
    await seed.cleanup()
  })

  const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64')

  test('a report is kept with its screenshot, and posted only when asked', async ({
    client: http,
    assert,
  }) => {
    const credentials = await seed.device()
    const client = desktopClient(http, credentials)
    const posted: any[] = []
    bugReportService.post = async (report) => {
      posted.push(report)
      return 'https://discord.com/channels/1/2'
    }
    Object.defineProperty(bugReportService, 'canPost', { value: true, configurable: true })
    try {
      const kept = await client.post('/api/desktop/reports', {
        title: 'LP graph stops at yesterday',
        body: 'My last two games are missing.',
        page: 'Profile',
        area: 'Profile & stats',
        diagnostics: 'C:/Users/someone/AppData/…',
        screenshot: PNG,
      })
      kept.assertStatus(200)
      assert.include(kept.body(), { discordUrl: null, discordError: false })
      ids.push(kept.body().id)
      assert.lengthOf(posted, 0)

      const shared = await client.post('/api/desktop/reports', {
        title: 'Overlay snaps back',
        body: 'It goes back to the corner.',
        area: 'Overlay',
        discord: true,
      })
      ids.push(shared.body().id)
      assert.include(shared.body(), { discordUrl: 'https://discord.com/channels/1/2' })
      assert.lengthOf(posted, 1)

      const [row] = await db.from('admin.bug_report').where('id', kept.body().id)
      assert.include(row, { source: 'app', page: 'Profile', area: 'Profile & stats' })
      assert.include(row.diagnostics, 'AppData')
      const files = await db.from('admin.bug_file').where('bug_id', kept.body().id)
      assert.lengthOf(files, 1)
      assert.include(files[0], { kind: 'screenshot', mime: 'image/png' })
    } finally {
      delete (bugReportService as any).canPost
    }
  })

  test('works without a device, refuses bad files and a missing title', async ({
    client: http,
  }) => {
    const anonymous = await http
      .post('/api/desktop/reports')
      .json({ title: 'Crash', body: 'It closed.' })
    anonymous.assertStatus(200)
    ids.push(anonymous.body().id)
    const untitled = await http.post('/api/desktop/reports').json({ body: 'No title' })
    untitled.assertStatus(422)
    const badImage = await http
      .post('/api/desktop/reports')
      .json({ title: 'x', body: 'y', screenshot: Buffer.from('not an image').toString('base64') })
    badImage.assertStatus(422)
    const badClip = await http
      .post('/api/desktop/reports')
      .json({ title: 'x', body: 'y', clip: { name: 'a.exe', data: PNG } })
    badClip.assertStatus(422)
  })

  test('the similar post is the forum title sharing most words', async ({
    client: http,
    assert,
  }) => {
    bugReportService.threads = async () => [
      { id: '11', name: 'LP graph misses the last games', guildId: '9', players: 3 },
      { id: '12', name: 'Overlay disappears after alt tab', guildId: '9', players: 1 },
    ]
    const match = await http
      .get('/api/desktop/reports/similar')
      .qs({ q: 'LP graph stops at yesterday' })
    match.assertStatus(200)
    assert.deepEqual(match.body().match, {
      id: '11',
      title: 'LP graph misses the last games',
      url: 'https://discord.com/channels/9/11',
      players: 3,
    })
    const none = await http.get('/api/desktop/reports/similar').qs({ q: 'Recording has no sound' })
    assert.isNull(none.body().match)
  })
})

test.group('Bug report text', () => {
  test('likeness needs two shared words', ({ assert }) => {
    assert.equal(likeness('overlay', 'Overlay disappears'), 0)
    assert.isAbove(likeness('scouting overlay empty', 'Scouting overlay is empty in ARAM'), 0.5)
  })

  test('the post fits in a Discord message and keeps the facts', ({ assert }) => {
    const content = postContent(
      {
        body: 'x'.repeat(5000),
        appVersion: '0.3.9',
        os: 'Windows',
        page: 'Profile',
        inGame: 'Ranked Solo, Ahri, 14:32',
      },
      false
    )
    assert.isAtMost(content.length, 2000)
    assert.include(content, '**Version** 0.3.9 · **System** Windows · **Where** Profile')
    assert.include(content, '**In game** Ranked Solo, Ahri, 14:32')
  })
})
