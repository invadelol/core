import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Readable } from 'node:stream'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import { withDeadline } from '#services/desktop_release'
import type DesktopDevice from '#models/desktop_device'

/**
 * Beta builds of the desktop app (docs/desktop-sync.md §8). The admin
 * dashboard writes the builds and the grants in its own `admin` schema; core
 * only reads them, and serves a build to a device linked to a Riot account
 * with a live `beta` grant. Installers are uploaded by the build workflow into
 * core's object storage under an unguessable key and streamed through core, so
 * nobody else can download them.
 */

/** Update targets the app asks for, as the Tauri updater names them. */
export const BETA_TARGETS = ['windows-x86_64', 'darwin-aarch64', 'darwin-x86_64'] as const
export type BetaTarget = (typeof BETA_TARGETS)[number]

/** How long a download link in the feed stays valid. */
const LINK_SECONDS = 30 * 60
/** How long opening an installer in storage may take before the download is refused. */
const OPEN_TIMEOUT_MS = 15_000
/** Builds sent to the app: the newest few, so a tester on an older one still sees its notes. */
const BUILDS_SENT = 5

export interface BetaAsset {
  name: string
  /** Object storage key (since v1.6). */
  key: string
  size: number
  signature: string
}

/** Largest package the build workflow may upload. */
export const BETA_UPLOAD_MAX_BYTES = 200 * 1024 * 1024

/** `Invade_0.3.5-beta.1_x64-setup.exe`, `Invade_aarch64.app.tar.gz`: a plain file name. */
export const BETA_PACKAGE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/

export const BETA_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$/

export interface BetaBuild {
  version: string
  title: string
  changes: { text: string }[]
  tests: { id: string; title: string; detail?: string }[]
  known: { text: string }[]
  assets: Partial<Record<BetaTarget, BetaAsset>>
  publishedAt: string | null
}

export interface Tester {
  puuid: string
  label: string
}

/** Semver order, prereleases before their release (0.3.5-beta.2 < 0.3.5-beta.10 < 0.3.5). */
export function compareVersions(a: string, b: string) {
  const [coreA, preA] = a.split('-', 2) as [string, string | undefined]
  const [coreB, preB] = b.split('-', 2) as [string, string | undefined]
  const numsA = coreA.split('.').map(Number)
  const numsB = coreB.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((numsA[i] ?? 0) !== (numsB[i] ?? 0)) return (numsA[i] ?? 0) < (numsB[i] ?? 0) ? -1 : 1
  }
  if (preA === preB) return 0
  if (preA === undefined) return 1
  if (preB === undefined) return -1
  const partsA = preA.split('.')
  const partsB = preB.split('.')
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const x = partsA[i]
    const y = partsB[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    if (x === y) continue
    const nx = /^\d+$/.test(x) ? Number(x) : null
    const ny = /^\d+$/.test(y) ? Number(y) : null
    if (nx !== null && ny !== null) return nx < ny ? -1 : 1
    if (nx !== null) return -1
    if (ny !== null) return 1
    return x < y ? -1 : 1
  }
  return 0
}

/** `Invade/0.3.5-beta.1 (windows)` → version and OS, as every desktop request says. */
export function userAgentApp(userAgent: string | undefined) {
  const match = /^Invade\/([0-9A-Za-z.+-]{1,32}) \((macos|windows)\)/.exec(userAgent ?? '')
  return match ? { app: match[1], os: match[2] } : null
}

function rowToBuild(row: any): BetaBuild {
  return {
    version: row.version,
    title: row.title,
    changes: row.changes ?? [],
    tests: row.tests ?? [],
    known: row.known ?? [],
    assets: row.assets ?? {},
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
  }
}

export class BetaService {
  /** Whether the admin schema is on this database (it is not in every environment). */
  #ready: { at: number; ok: boolean } | null = null

  async available() {
    if (this.#ready && Date.now() - this.#ready.at < 60_000) return this.#ready.ok
    try {
      const result = await db.rawQuery(
        `SELECT to_regclass('admin.live_beta_build') IS NOT NULL AND to_regclass('admin.active_entitlement') IS NOT NULL AS ok`
      )
      this.#ready = { at: Date.now(), ok: !!result.rows[0]?.ok }
    } catch {
      this.#ready = { at: Date.now(), ok: false }
    }
    return this.#ready.ok
  }

  /** The beta tester behind a device: one of its linked accounts holds a live grant. */
  async testerOf(deviceId: string): Promise<Tester | null> {
    if (!(await this.available())) return null
    try {
      const result = await db.rawQuery(
        `SELECT a.puuid, coalesce(p.game_name || '#' || p.tag_line, a.puuid) AS label
         FROM desktop_device_account a
         JOIN admin.active_entitlement e ON e.kind = 'beta' AND e.puuid = a.puuid
         LEFT JOIN riot_player p ON p.puuid = a.puuid
         WHERE a.device_id = ?
         ORDER BY a.puuid LIMIT 1`,
        [deviceId]
      )
      const row = result.rows[0]
      return row ? { puuid: row.puuid, label: row.label } : null
    } catch (error) {
      // A missing grant on the admin schema must not break the app's other calls.
      logger.warn({ err: error }, 'beta: tester lookup failed')
      return null
    }
  }

  /** Whether a Riot account holds a live beta grant: its profile shows "Beta tester". */
  async isTester(puuid: string) {
    if (!(await this.available())) return false
    try {
      const result = await db.rawQuery(
        `SELECT 1 FROM admin.active_entitlement WHERE kind = 'beta' AND puuid = ? LIMIT 1`,
        [puuid]
      )
      return result.rows.length > 0
    } catch {
      return false
    }
  }

  /** Live builds, newest first. */
  async builds(limit = BUILDS_SENT): Promise<BetaBuild[]> {
    if (!(await this.available())) return []
    const result = await db.rawQuery(
      `SELECT version, title, changes, tests, known, assets, published_at FROM admin.live_beta_build`
    )
    return result.rows
      .map(rowToBuild)
      .sort((a: BetaBuild, b: BetaBuild) => compareVersions(b.version, a.version))
      .slice(0, limit)
  }

  async build(version: string) {
    const builds = await this.builds(1000)
    return builds.find((build) => build.version === version) ?? null
  }

  /** Remembers which build a tester runs, for the admin's Beta page. Best effort. */
  async seen(device: DesktopDevice, tester: Tester, app: string, os: string) {
    try {
      await db.rawQuery(
        `INSERT INTO admin.beta_device (device_id, puuid, label, app, os)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (device_id) DO UPDATE
           SET puuid = EXCLUDED.puuid, label = EXCLUDED.label, app = EXCLUDED.app, os = EXCLUDED.os, last_seen_at = now()`,
        [device.id, tester.puuid, tester.label, app, os]
      )
    } catch (error) {
      logger.warn({ err: error }, 'beta: could not record the tester device')
    }
  }

  /** The newest live build that has an installer for `target`. */
  async newestFor(target: BetaTarget) {
    const builds = await this.builds(1000)
    return builds.find((build) => build.assets[target]) ?? null
  }

  /** A download link bound to this build, target and device, valid for 30 minutes. */
  downloadToken(version: string, target: BetaTarget, deviceId: string, now = Date.now()) {
    const expires = Math.floor(now / 1000) + LINK_SECONDS
    const payload = Buffer.from(`${version}|${target}|${deviceId}|${expires}`).toString('base64url')
    return `${payload}.${this.#mac(payload)}`
  }

  readToken(token: string, now = Date.now()) {
    const [payload, mac] = token.split('.')
    if (!payload || !mac || mac.length !== 43) return null
    const expected = Buffer.from(this.#mac(payload))
    const given = Buffer.from(mac)
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
    const [version, target, deviceId, expires] = Buffer.from(payload, 'base64url')
      .toString('utf8')
      .split('|')
    if (!BETA_TARGETS.includes(target as BetaTarget)) return null
    if (!(Number(expires) * 1000 > now)) return null
    return { version, target: target as BetaTarget, deviceId }
  }

  #mac(payload: string) {
    return createHmac('sha256', env.get('APP_KEY'))
      .update(`beta-download\n${payload}`)
      .digest('base64url')
  }

  /** The Tauri updater's "dynamic" answer for one target. */
  feed(build: BetaBuild, target: BetaTarget, deviceId: string, origin: string) {
    const asset = build.assets[target]!
    return {
      version: build.version,
      notes: build.title || `Invade ${build.version}`,
      pub_date: build.publishedAt ?? new Date().toISOString(),
      url: `${origin}/api/desktop/beta/download/${this.downloadToken(build.version, target, deviceId)}`,
      signature: asset.signature,
    }
  }

  /** Streams an installer from object storage. Null when it cannot be read. */
  async open(asset: BetaAsset): Promise<{ stream: Readable; length: number | null } | null> {
    if (!asset.key) return null
    let opening: Promise<Readable> | undefined
    try {
      const disk = drive.use()
      opening = disk.getStream(asset.key)
      // Storage that never answers costs the tester a short wait, not a request held open.
      const stream = await withDeadline(OPEN_TIMEOUT_MS, 'beta installer', () => opening!)
      return { stream, length: asset.size || null }
    } catch (error) {
      // A stream that opens after the deadline is closed, not left holding a connection.
      opening?.then((late) => late.destroy()).catch(() => {})
      logger.warn({ err: error, asset: asset.name }, 'beta: installer read failed')
      return null
    }
  }

  /** Whether a request carries the build workflow's upload secret. */
  uploadAllowed(header: string | undefined) {
    const secret = env.get('BETA_UPLOAD_SECRET')
    if (!secret || !header?.startsWith('Bearer ')) return false
    const given = createHash('sha256').update(header.slice(7)).digest()
    const expected = createHash('sha256').update(secret).digest()
    return timingSafeEqual(given, expected)
  }

  /**
   * Stores one package from the build workflow and records it on its build, which is created as
   * a draft when the admin has not written it yet. A new upload for the same target replaces the
   * old one (its object is removed once the row points at the new one).
   */
  async upload(
    version: string,
    target: BetaTarget,
    name: string,
    signature: string,
    body: Readable
  ) {
    const key = `beta/${version}/${target}-${randomBytes(16).toString('hex')}/${name}`
    // Read whole (a package is a few tens of MB): object storage wants a known length.
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of body) {
      size += (chunk as Buffer).length
      if (size > BETA_UPLOAD_MAX_BYTES) throw new Error('beta: package too large')
      chunks.push(chunk as Buffer)
    }
    await drive.use().put(key, Buffer.concat(chunks), { contentType: 'application/octet-stream' })
    const asset: BetaAsset = { name, key, size, signature }
    const previous = await db.rawQuery(
      `SELECT assets -> ? AS old FROM admin.beta_build WHERE version = ?`,
      [target, version]
    )
    await db.rawQuery(
      `INSERT INTO admin.beta_build (version, assets) VALUES (?, jsonb_build_object(?::text, ?::jsonb))
       ON CONFLICT (version) DO UPDATE SET assets = admin.beta_build.assets || EXCLUDED.assets, updated_at = now()`,
      [version, target, JSON.stringify(asset)]
    )
    const old = previous.rows[0]?.old as BetaAsset | null | undefined
    if (old?.key && old.key !== key)
      await drive
        .use()
        .delete(old.key)
        .catch(() => {})
    return asset
  }

  /** A tester's rating of a build (1 to 5) and its comment; a new one replaces the old one. */
  async rate(deviceId: string, version: string, rating: number, comment: string) {
    await db.rawQuery(
      `INSERT INTO admin.beta_rating (build_version, device_id, rating, comment) VALUES (?, ?, ?, ?)
       ON CONFLICT (build_version, device_id) DO UPDATE
         SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = now()`,
      [version, deviceId, rating, comment]
    )
  }

  /** This device's own ratings of these builds. */
  async ratings(deviceId: string, versions: string[]) {
    if (!versions.length) return []
    try {
      const result = await db.rawQuery(
        `SELECT build_version AS version, rating, comment FROM admin.beta_rating
         WHERE device_id = ? AND build_version IN (${versions.map(() => '?').join(', ')})`,
        [deviceId, ...versions]
      )
      return result.rows as { version: string; rating: number; comment: string }[]
    } catch {
      // Before the admin's ratings migration ran.
      return []
    }
  }

  /** A tester's verdicts on a build's tests; a new answer replaces the old one. */
  async results(
    deviceId: string,
    build: BetaBuild,
    results: { test: string; verdict: 'works' | 'broken' | 'skipped'; note?: string }[]
  ) {
    const known = new Set(build.tests.map((test) => test.id))
    const kept = results.filter((result) => known.has(result.test))
    for (const result of kept) {
      await db.rawQuery(
        `INSERT INTO admin.beta_result (build_version, device_id, test_id, verdict, note)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (build_version, device_id, test_id) DO UPDATE
           SET verdict = EXCLUDED.verdict, note = EXCLUDED.note, updated_at = now()`,
        [build.version, deviceId, result.test, result.verdict, result.note ?? '']
      )
    }
    return kept.length
  }

  async note(deviceId: string, version: string, body: string) {
    await db.rawQuery(
      `INSERT INTO admin.beta_note (build_version, device_id, body) VALUES (?, ?, ?)`,
      [version, deviceId, body]
    )
  }

  /** This device's own answers, so the panel shows what was already sent. */
  async answers(deviceId: string, versions: string[]) {
    if (!versions.length) return []
    const result = await db.rawQuery(
      `SELECT build_version AS version, test_id AS test, verdict, note FROM admin.beta_result
       WHERE device_id = ? AND build_version IN (${versions.map(() => '?').join(', ')})`,
      [deviceId, ...versions]
    )
    return result.rows as { version: string; test: string; verdict: string; note: string }[]
  }
}

export default new BetaService()
