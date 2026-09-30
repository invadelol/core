import logger from '@adonisjs/core/services/logger'

/**
 * Where the desktop app's installers come from.
 *
 * The site sends people to `/download/:platform`, which redirects to the newest
 * installer, so nobody has to land on GitHub and pick a file. The release list is
 * fetched from the public API and held for a few minutes: the API allows 60
 * anonymous requests an hour per IP, and a launch day would exceed that.
 */

export const DESKTOP_PLATFORMS = ['windows', 'mac-arm', 'mac-intel'] as const
export type DesktopPlatform = (typeof DESKTOP_PLATFORMS)[number]

const LATEST_URL = 'https://api.github.com/repos/invadelol/releases/releases/latest'
const FRESH_MS = 5 * 60_000
/** A failed refresh keeps serving the last good answer for this long. */
const STALE_MS = 24 * 60 * 60_000
const TIMEOUT_MS = 4_000

/** Installer file names, as produced by the Tauri bundler (`Invade_<version>_<suffix>`). */
const ASSET_PATTERNS: Record<DesktopPlatform, RegExp> = {
  'windows': /^Invade_.+_x64-setup\.exe$/,
  'mac-arm': /^Invade_.+_aarch64\.dmg$/,
  'mac-intel': /^Invade_.+_x64\.dmg$/,
}

interface ReleaseAsset {
  name: string
  browser_download_url: string
}

export interface DesktopRelease {
  version: string
  urls: Partial<Record<DesktopPlatform, string>>
}

export function isDesktopPlatform(value: string): value is DesktopPlatform {
  return (DESKTOP_PLATFORMS as readonly string[]).includes(value)
}

/** Maps a GitHub release payload to the installer of each platform. */
export function parseRelease(payload: unknown): DesktopRelease | null {
  const release = payload as { tag_name?: unknown; draft?: unknown; assets?: unknown } | null
  if (!release || release.draft || typeof release.tag_name !== 'string') return null
  const assets = Array.isArray(release.assets) ? (release.assets as ReleaseAsset[]) : []
  const urls: DesktopRelease['urls'] = {}
  for (const platform of DESKTOP_PLATFORMS) {
    const asset = assets.find((a) => ASSET_PATTERNS[platform].test(a.name))
    // Only ever redirect to a file on the releases repo.
    if (asset?.browser_download_url?.startsWith('https://github.com/invadelol/releases/')) {
      urls[platform] = asset.browser_download_url
    }
  }
  return { version: release.tag_name.replace(/^v/, ''), urls }
}

class DesktopReleases {
  #cached: { release: DesktopRelease; at: number } | null = null
  #inflight: Promise<DesktopRelease | null> | null = null

  /** The newest release, from memory when it is recent. Null when none is available. */
  async latest(now = Date.now()): Promise<DesktopRelease | null> {
    if (this.#cached && now - this.#cached.at < FRESH_MS) return this.#cached.release
    this.#inflight ??= this.#refresh(now).finally(() => (this.#inflight = null))
    const fresh = await this.#inflight
    if (fresh) return fresh
    return this.#cached && now - this.#cached.at < STALE_MS ? this.#cached.release : null
  }

  async #refresh(now: number): Promise<DesktopRelease | null> {
    try {
      const response = await fetch(LATEST_URL, {
        headers: { 'accept': 'application/vnd.github+json', 'user-agent': 'invade.lol' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`GitHub answered ${response.status}`)
      const release = parseRelease(await response.json())
      if (release) this.#cached = { release, at: now }
      return release
    } catch (error) {
      logger.warn({ err: error }, 'could not read the latest desktop release')
      return null
    }
  }

  /** Forgets what was read; for tests. */
  reset() {
    this.#cached = null
    this.#inflight = null
  }
}

export const desktopReleases = new DesktopReleases()
