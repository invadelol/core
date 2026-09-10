import { readFile, stat } from 'node:fs/promises'
import { join, normalize, sep, extname } from 'node:path'
import { createHash } from 'node:crypto'
import { brotliCompress, gzip, constants } from 'node:zlib'
import { promisify } from 'node:util'

const brotli = promisify(brotliCompress)
const deflate = promisify(gzip)

/**
 * Serves the built front-end from memory, already compressed.
 *
 * Vite writes content-hashed filenames, so a given URL under `/assets` always
 * refers to the same bytes for as long as it exists. Two things follow, and
 * this service exists to take both:
 *
 * 1. The bytes can be compressed once, at the highest Brotli setting, and
 *    reused for every subsequent request. Compressing per request would be far
 *    too slow at quality 11; compressing never — which is what we did before —
 *    means shipping roughly three times the bytes on every cold load.
 * 2. The response can be marked `immutable`, so a returning browser reuses it
 *    without a revalidation round trip. `serve-static` defaults to
 *    `max-age=0`, which costs one conditional request per asset per page view
 *    even though the answer is always 304.
 */

/** Encodings we can answer with, best first. */
const ENCODINGS = ['br', 'gzip'] as const
type Encoding = (typeof ENCODINGS)[number]

export interface AssetEntry {
  identity: Buffer
  encoded: Partial<Record<Encoding, Buffer>>
  contentType: string
  etag: string
  immutable: boolean
}

const CONTENT_TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

/** Already-compressed formats: running Brotli over them only wastes time. */
const INCOMPRESSIBLE = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.gif',
  '.woff',
  '.woff2',
  '.ico',
])

/** Below this, framing overhead outweighs anything compression saves. */
const MIN_COMPRESS_BYTES = 512

/** Where Vite writes its content-hashed output, relative to the public root. */
const HASHED_OUTPUT_DIR = 'assets'

/** A single asset larger than this stays on disk rather than in the heap. */
const MAX_CACHED_BYTES = 8 * 1024 * 1024

export class StaticAssetService {
  #root: string
  #entries = new Map<string, AssetEntry>()
  #inFlight = new Map<string, Promise<AssetEntry | null>>()

  constructor(root: string) {
    this.#root = normalize(root)
  }

  /**
   * The entry for a URL path, or null when it is not a file we serve.
   *
   * Concurrent first-hits on the same asset share one read-and-compress, so a
   * cold start never compresses the same bundle twice.
   */
  async find(urlPath: string): Promise<AssetEntry | null> {
    const relative = this.#resolve(urlPath)
    if (!relative) return null

    const cached = this.#entries.get(relative)
    if (cached) return cached

    const pending = this.#inFlight.get(relative)
    if (pending) return pending

    const load = this.#load(relative)
      .catch(() => null)
      .finally(() => this.#inFlight.delete(relative))

    this.#inFlight.set(relative, load)
    return load
  }

  /**
   * Maps a URL path to a path inside the root, or null if it escapes it.
   *
   * Everything is rejected unless it resolves to a real path under the root:
   * `..` segments, encoded separators and absolute paths all fail here.
   */
  #resolve(urlPath: string): string | null {
    let decoded: string
    try {
      decoded = decodeURIComponent(urlPath)
    } catch {
      return null
    }

    if (decoded.includes('\0')) return null

    const relative = normalize(decoded.replace(/^\/+/, ''))
    if (!relative || relative === '.') return null
    if (relative.startsWith('..') || relative.startsWith(sep) || relative.includes(`..${sep}`)) {
      return null
    }

    // The Vite manifest describes the build; it is not part of it.
    if (relative.startsWith(`${HASHED_OUTPUT_DIR}${sep}.vite`)) return null

    return relative
  }

  async #load(relative: string): Promise<AssetEntry | null> {
    const absolute = join(this.#root, relative)
    if (!absolute.startsWith(this.#root + sep)) return null

    const info = await stat(absolute).catch(() => null)
    if (!info?.isFile() || info.size > MAX_CACHED_BYTES) return null

    const identity = await readFile(absolute)
    const extension = extname(relative).toLowerCase()

    const encoded: Partial<Record<Encoding, Buffer>> = {}
    if (identity.length >= MIN_COMPRESS_BYTES && !INCOMPRESSIBLE.has(extension)) {
      // Quality 11 is far too slow to do per request, and exactly right to do
      // once for bytes that never change.
      const [br, gz] = await Promise.all([
        brotli(identity, {
          params: {
            [constants.BROTLI_PARAM_QUALITY]: 11,
            [constants.BROTLI_PARAM_SIZE_HINT]: identity.length,
          },
        }),
        deflate(identity, { level: 9 }),
      ])
      if (br.length < identity.length) encoded.br = br
      if (gz.length < identity.length) encoded.gzip = gz
    }

    const entry: AssetEntry = {
      identity,
      encoded,
      contentType: CONTENT_TYPES[extension] ?? 'application/octet-stream',
      etag: `"${createHash('sha1').update(identity).digest('base64url')}"`,
      // Only Vite's build output may be called immutable, and it is decided by
      // where the file lives rather than by what its name looks like. Vite
      // content-hashes everything it writes to this directory, so the URL and
      // the bytes are bound together. Guessing from the filename instead would
      // pin a stable name such as `inter-latin-400.woff2` for a year, and a
      // replacement would never reach anyone who had already loaded it.
      immutable: relative.startsWith(`${HASHED_OUTPUT_DIR}${sep}`),
    }

    this.#entries.set(relative, entry)
    return entry
  }

  /** Best encoding the client accepts, or null to send the raw bytes. */
  static negotiate(entry: AssetEntry, accepted: string | undefined): Encoding | null {
    if (!accepted) return null
    const header = accepted.toLowerCase()
    for (const encoding of ENCODINGS) {
      if (!entry.encoded[encoding]) continue
      // Skip anything the client explicitly refused with q=0.
      const refused = new RegExp(`(^|,)\\s*${encoding}\\s*;\\s*q=0(\\.0+)?\\s*(,|$)`).test(header)
      if (!refused && (header.includes(encoding) || header.includes('*'))) return encoding
    }
    return null
  }
}
