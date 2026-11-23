import { createHmac, timingSafeEqual } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, rm, rmdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { Readable } from 'node:stream'
import app from '@adonisjs/core/services/app'
import drive from '@adonisjs/drive/services/main'
import env from '#start/env'
import { accountOrigin } from '#services/accounts/session_service'

/**
 * Where clip videos and their posters live, behind one interface: Cloudflare R2's clip bucket
 * (`CLIPS_STORAGE=drive`: the `clips` disk, `CLIPS_BUCKET`, default `invade-clips`, on the site's
 * R2 key and endpoint) or the local disk (development, the default). The app sends both files
 * straight to the storage on short-lived signed addresses, and browsers read them on signed
 * addresses too; the local disk stands in with addresses core signs and serves itself.
 */
export type ClipFileKind = 'video' | 'poster'

export const CLIP_FILES: Record<ClipFileKind, { name: string; type: string }> = {
  video: { name: 'video.mp4', type: 'video/mp4' },
  poster: { name: 'poster.jpg', type: 'image/jpeg' },
}

export const clipKey = (id: string, kind: ClipFileKind) => `clips/${id}/${CLIP_FILES[kind].name}`

/** How long a signed address lasts: an upload of a large clip on a slow line, a page left open. */
const UPLOAD_SECONDS = 30 * 60
const READ_SECONDS = 60 * 60

export interface ClipFile {
  /** The bytes from `start` to `end` (inclusive) of a file of `size` bytes. */
  stream: Readable
  size: number
  start: number
  end: number
}

export interface ClipStore {
  readonly kind: 'local' | 'drive'
  /** Where the app sends a file (a signed `PUT`). */
  uploadUrl(key: string, contentType: string): Promise<string>
  /** The file's size and its first bytes (what the checks read), or null when it is missing. */
  head(key: string, bytes: number): Promise<{ size: number; start: Buffer } | null>
  /** Where a browser reads a file: a signed address of the storage, or null to stream it here. */
  url(key: string): Promise<string | null>
  /** A local file to stream (with a byte range), or null when it is missing. */
  read(key: string, range?: { start: number; end?: number }): Promise<ClipFile | null>
  put(key: string, bytes: Buffer): Promise<void>
  delete(key: string): Promise<void>
}

const SAFE_KEY = /^clips\/[A-Za-z0-9]{10,16}\/(video\.mp4|poster\.jpg)$/

function checked(key: string) {
  if (!SAFE_KEY.test(key)) throw new Error(`clip storage: unexpected key ${key}`)
  return key
}

/* ── Local uploads: an address core signs and takes itself ─────────── */

const sign = (key: string, expires: number) =>
  createHmac('sha256', env.get('APP_KEY'))
    .update(`clip-upload:${key}:${expires}`)
    .digest('base64url')

/** `/api/clips/upload?key=…&expires=…&sig=…`, valid for `UPLOAD_SECONDS`. */
export function localUploadPath(key: string, now = Date.now()) {
  const expires = Math.floor(now / 1000) + UPLOAD_SECONDS
  const query = new URLSearchParams({ key: checked(key), expires: String(expires) })
  query.set('sig', sign(key, expires))
  return `/api/clips/upload?${query}`
}

/** The key a local upload address is for, when its signature holds and it has not expired. */
export function localUploadKey(query: Record<string, unknown>): string | null {
  const { key, expires, sig } = query
  if (typeof key !== 'string' || !SAFE_KEY.test(key) || typeof sig !== 'string') return null
  const when = Number(expires)
  if (!Number.isInteger(when) || when * 1000 < Date.now()) return null
  const expected = Buffer.from(sign(key, when))
  const given = Buffer.from(sig)
  return expected.length === given.length && timingSafeEqual(expected, given) ? key : null
}

/** Files under one folder (`CLIPS_DIR`, default `storage/` in the app's root: `storage/clips/<id>/…`). */
export class LocalClipStore implements ClipStore {
  readonly kind = 'local' as const
  constructor(private root: string) {}

  private path(key: string) {
    return join(this.root, checked(key))
  }

  async uploadUrl(key: string) {
    return `${accountOrigin()}${localUploadPath(key)}`
  }

  async head(key: string, bytes: number) {
    const path = this.path(key)
    const info = await stat(path).catch(() => null)
    if (!info?.isFile()) return null
    const file = await open(path, 'r')
    try {
      const start = Buffer.alloc(Math.min(bytes, info.size))
      await file.read(start, 0, start.length, 0)
      return { size: info.size, start }
    } finally {
      await file.close()
    }
  }

  async url() {
    return null
  }

  async read(key: string, range?: { start: number; end?: number }) {
    const path = this.path(key)
    const info = await stat(path).catch(() => null)
    if (!info?.isFile()) return null
    const size = info.size
    const start = Math.min(Math.max(0, range?.start ?? 0), Math.max(0, size - 1))
    const end = Math.min(range?.end ?? size - 1, size - 1)
    return { stream: createReadStream(path, { start, end }), size, start, end }
  }

  async put(key: string, bytes: Buffer) {
    const path = this.path(key)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, bytes)
  }

  async delete(key: string) {
    await rm(this.path(key), { force: true })
    // The clip's folder goes once it is empty.
    await rmdir(dirname(this.path(key))).catch(() => {})
  }
}

/** R2's clip bucket (the `clips` disk): the app and browsers use signed addresses. */
export class DriveClipStore implements ClipStore {
  readonly kind = 'drive' as const
  private disk = () => drive.use('clips')

  async uploadUrl(key: string, contentType: string) {
    return this.disk().getSignedUploadUrl(checked(key), {
      expiresIn: `${UPLOAD_SECONDS}s`,
      contentType,
    })
  }

  async head(key: string, bytes: number) {
    const disk = this.disk()
    if (!(await disk.exists(checked(key)))) return null
    const meta = await disk.getMetaData(key)
    const stream = await disk.getStream(key)
    const chunks: Buffer[] = []
    let read = 0
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer)
      read += (chunk as Buffer).length
      if (read >= bytes) break
    }
    if ('destroy' in stream && typeof stream.destroy === 'function') stream.destroy()
    return { size: meta.contentLength, start: Buffer.concat(chunks).subarray(0, bytes) }
  }

  async url(key: string) {
    return this.disk().getSignedUrl(checked(key), { expiresIn: `${READ_SECONDS}s` })
  }

  async read() {
    return null
  }

  async put(key: string, bytes: Buffer) {
    await this.disk().put(checked(key), bytes)
  }

  async delete(key: string) {
    await this.disk().delete(checked(key))
  }
}

let store: ClipStore | null = null

export function clipStore(): ClipStore {
  if (store) return store
  store =
    env.get('CLIPS_STORAGE') === 'drive'
      ? new DriveClipStore()
      : new LocalClipStore(resolve(env.get('CLIPS_DIR') || app.makePath('storage')))
  return store
}

/** Tests: another store, or the configured one again with null. */
export function useClipStore(next: ClipStore | null) {
  store = next
}
