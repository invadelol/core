import { createReadStream } from 'node:fs'
import { mkdir, rm, rmdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { Readable } from 'node:stream'
import app from '@adonisjs/core/services/app'
import drive from '@adonisjs/drive/services/main'
import env from '#start/env'

/**
 * Where clip videos and their posters live, behind one interface: the local disk (development,
 * or a server with a mounted volume) or the object storage the site already uses for other files
 * (`@adonisjs/drive`'s default disk: Cloudflare R2 in production, MinIO locally). Chosen by
 * `CLIPS_STORAGE` (`local`, the default, or `drive`).
 */
export interface ClipFile {
  /** The bytes from `start` to `end` (inclusive) of a file of `size` bytes. */
  stream: Readable
  size: number
  start: number
  end: number
}

export interface ClipStore {
  readonly kind: 'local' | 'drive'
  put(key: string, bytes: Buffer, contentType: string): Promise<void>
  /** A local file to stream (with a byte range), or null when it is missing. */
  read(key: string, range?: { start: number; end?: number }): Promise<ClipFile | null>
  /** An address the browser fetches itself (object storage), instead of streaming through here. */
  url(key: string): Promise<string | null>
  delete(key: string): Promise<void>
}

const SAFE_KEY = /^clips\/[A-Za-z0-9]{10,16}\/(video\.mp4|poster\.jpg)$/

function checked(key: string) {
  if (!SAFE_KEY.test(key)) throw new Error(`clip storage: unexpected key ${key}`)
  return key
}

/** Files under one folder (`CLIPS_DIR`, default `storage/` in the app's root: `storage/clips/<id>/…`). */
export class LocalClipStore implements ClipStore {
  readonly kind = 'local' as const
  constructor(private root: string) {}

  private path(key: string) {
    return join(this.root, checked(key))
  }

  async put(key: string, bytes: Buffer) {
    const path = this.path(key)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, bytes)
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

  async url() {
    return null
  }

  async delete(key: string) {
    await rm(this.path(key), { force: true })
    // The clip's folder goes once it is empty.
    await rmdir(dirname(this.path(key))).catch(() => {})
  }
}

/** The site's object storage; the browser fetches a short-lived signed address. */
export class DriveClipStore implements ClipStore {
  readonly kind = 'drive' as const

  async put(key: string, bytes: Buffer, contentType: string) {
    await drive.use().put(checked(key), bytes, { contentType })
  }

  async read() {
    return null
  }

  async url(key: string) {
    return drive.use().getSignedUrl(checked(key), { expiresIn: '1h' })
  }

  async delete(key: string) {
    await drive.use().delete(checked(key))
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
