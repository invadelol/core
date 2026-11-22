import logger from '@adonisjs/core/services/logger'

/**
 * Where the desktop app's installers come from.
 *
 * The site sends people to `/download/:platform`, which redirects to the newest
 * installer, so nobody has to land on GitHub and pick a file. A download must
 * never wait on GitHub: the newest release is read in the background and kept
 * in memory, every request answers from what is known at that moment, and a
 * release built into the site covers the time before the first answer (or a
 * GitHub outage). Any installer of the releases repo is a fine landing: the
 * app updates itself on its first launch.
 */

export const DESKTOP_PLATFORMS = ['windows', 'mac-arm', 'mac-intel'] as const
export type DesktopPlatform = (typeof DESKTOP_PLATFORMS)[number]

/** Shorter names people type or share. A Mac means Apple Silicon, as on the site's buttons. */
const ALIASES: Record<string, DesktopPlatform> = {
  mac: 'mac-arm',
  macos: 'mac-arm',
}

const REPOSITORY = 'https://github.com/invadelol/releases/'
const DOWNLOADS = `${REPOSITORY}releases/download/`
/** The release list. Anonymous calls are limited to 60 an hour per IP. */
const API_URL = 'https://api.github.com/repos/invadelol/releases/releases/latest'
/** The app's own update feed: a plain file download, outside the API's hourly limit. */
const FEED_URL = `${REPOSITORY}releases/latest/download/latest.json`

/** How long an answer is used before it is read again in the background. */
const FRESH_MS = 5 * 60_000
/** After a failed read, the next one waits this long, so an outage does not burn the API limit. */
const RETRY_MS = 60_000
/** Each read of GitHub gives up after this long, whatever the network does. */
const READ_TIMEOUT_MS = 3_000
/** Right after a start nothing is known yet: a download waits this long at most for GitHub. */
const FIRST_WAIT_MS = 700

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

/** The installers of a version, by the bundler's file names. */
export function releaseOf(
  version: string
): DesktopRelease & { urls: Record<DesktopPlatform, string> } {
  const base = `${DOWNLOADS}v${version}/Invade_${version}`
  return {
    version,
    urls: {
      'windows': `${base}_x64-setup.exe`,
      'mac-arm': `${base}_aarch64.dmg`,
      'mac-intel': `${base}_x64.dmg`,
    },
  }
}

/**
 * A published release whose installers exist on every platform: where a download goes
 * while GitHub has not answered yet. Moving it to a newer release is optional.
 */
export const BUILT_IN_RELEASE = releaseOf('0.3.8')

export function isDesktopPlatform(value: string): value is DesktopPlatform {
  return (DESKTOP_PLATFORMS as readonly string[]).includes(value)
}

/** The platform a `/download/:platform` segment names, aliases included, or null. */
export function desktopPlatform(value: string): DesktopPlatform | null {
  const id = value.toLowerCase()
  if (isDesktopPlatform(id)) return id
  return Object.hasOwn(ALIASES, id) ? ALIASES[id] : null
}

/** Only ever redirect to a file on the releases repo. */
function ownDownload(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith(DOWNLOADS) && !url.includes('..')
}

/** Maps a GitHub release payload to the installer of each platform. */
export function parseRelease(payload: unknown): DesktopRelease | null {
  const release = payload as { tag_name?: unknown; draft?: unknown; assets?: unknown } | null
  if (!release || release.draft || typeof release.tag_name !== 'string') return null
  const assets = Array.isArray(release.assets) ? (release.assets as ReleaseAsset[]) : []
  const urls: DesktopRelease['urls'] = {}
  for (const platform of DESKTOP_PLATFORMS) {
    const asset = assets.find((a) => ASSET_PATTERNS[platform].test(a?.name))
    if (ownDownload(asset?.browser_download_url)) urls[platform] = asset.browser_download_url
  }
  return { version: release.tag_name.replace(/^v/, ''), urls }
}

/**
 * Maps the update feed (`latest.json`) to installers. The feed names the Windows setup
 * itself; it lists update archives for macOS, so the disk images take the bundler's names.
 */
export function parseFeed(payload: unknown): DesktopRelease | null {
  const feed = payload as {
    version?: unknown
    platforms?: Record<string, { url?: unknown }>
  } | null
  if (!feed || typeof feed.version !== 'string') return null
  const version = feed.version.replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+$/.test(version)) return null
  const windows = feed.platforms?.['windows-x86_64']?.url
  const named = releaseOf(version)
  return {
    version,
    urls: {
      ...(ownDownload(windows) && ASSET_PATTERNS.windows.test(windows.split('/').pop()!)
        ? { windows }
        : {}),
      'mac-arm': named.urls['mac-arm'],
      'mac-intel': named.urls['mac-intel'],
    },
  }
}

/**
 * Settles within `ms` whatever `work` does. The timer is ours and holds the controller, so
 * the abort always fires, and the race settles even if the work never does: nothing that
 * waits on the network can be left waiting for good.
 */
export async function withDeadline<T>(
  ms: number,
  what: string,
  work: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController()
  let timer: NodeJS.Timeout | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${what}: no answer within ${ms} ms`)
      controller.abort(error)
      reject(error)
    }, ms)
  })
  const running = work(controller.signal)
  try {
    return await Promise.race([running, deadline])
  } finally {
    clearTimeout(timer)
    // Work that lost the race is dropped without an unhandled rejection.
    running.catch(() => {})
  }
}

/** Reads a JSON document from GitHub within `ms`. */
export function fetchJson(url: string, ms: number): Promise<unknown> {
  const host = new URL(url).host
  return withDeadline(ms, host, async (signal) => {
    const response = await fetch(url, {
      headers: { 'accept': 'application/vnd.github+json', 'user-agent': 'invade.lol' },
      signal,
    })
    if (!response.ok) throw new Error(`${host} answered ${response.status}`)
    return response.json() as Promise<unknown>
  })
}

interface Options {
  /** Reads one JSON document; GitHub in production, a stand-in in tests. */
  read: (url: string, ms: number) => Promise<unknown>
  readTimeoutMs: number
  firstWaitMs: number
}

export class DesktopReleases {
  #known: { release: DesktopRelease; at: number } | null = null
  #reading: Promise<DesktopRelease | null> | null = null
  #retryAt = 0
  #failing = false
  #options: Options

  constructor(options: Partial<Options> = {}) {
    this.#options = {
      read: fetchJson,
      readTimeoutMs: READ_TIMEOUT_MS,
      firstWaitMs: FIRST_WAIT_MS,
      ...options,
    }
  }

  /**
   * The newest release GitHub has told us about, without waiting on it: an old answer is
   * used while a new one is read in the background. Only before the very first answer does
   * this wait, and never longer than a moment. Null when nothing is known yet.
   */
  async latest(now = Date.now()): Promise<DesktopRelease | null> {
    const known = this.#known
    if (known && now - known.at < FRESH_MS) return known.release
    const reading = this.#refresh(now)
    if (known) return known.release
    let timer: NodeJS.Timeout | undefined
    const pause = new Promise<null>(
      (resolve) => (timer = setTimeout(resolve, this.#options.firstWaitMs, null))
    )
    try {
      return await Promise.race([reading, pause])
    } finally {
      clearTimeout(timer)
    }
  }

  /** Where a download of `platform` goes right now: never waits on GitHub for long. */
  async installer(platform: DesktopPlatform, now = Date.now()) {
    const release = await this.latest(now)
    const url = release?.urls[platform]
    if (release && url) return { version: release.version, url, source: 'github' as const }
    return {
      version: BUILT_IN_RELEASE.version,
      url: BUILT_IN_RELEASE.urls[platform],
      source: 'built-in' as const,
    }
  }

  /** Starts a background read unless one is running or a failure asks to wait. */
  #refresh(now: number): Promise<DesktopRelease | null> {
    if (this.#reading) return this.#reading
    if (now < this.#retryAt) return Promise.resolve(null)
    const started = Date.now()
    // Two reads at most, each with its own timeout; the whole is bounded again here.
    const whole = 2.5 * this.#options.readTimeoutMs
    this.#reading = withDeadline(whole, 'desktop release', () => this.#readRelease())
      .then((release) => {
        this.#known = { release, at: Date.now() }
        this.#retryAt = 0
        if (this.#failing) logger.info({ version: release.version }, 'desktop release read again')
        this.#failing = false
        return release
      })
      .catch((error) => {
        this.#retryAt = Date.now() + RETRY_MS
        this.#failing = true
        logger.warn(
          { err: error, ms: Date.now() - started, serving: this.#known?.release.version ?? null },
          'could not read the latest desktop release'
        )
        return null
      })
      .finally(() => (this.#reading = null))
    return this.#reading
  }

  /** The release list first (it names every file), then the update feed. */
  async #readRelease(): Promise<DesktopRelease> {
    let apiError: unknown
    try {
      const release = parseRelease(await this.#options.read(API_URL, this.#options.readTimeoutMs))
      if (release && Object.keys(release.urls).length) return release
      apiError = new Error('the latest release has no installer')
    } catch (error) {
      apiError = error
    }
    try {
      const release = parseFeed(await this.#options.read(FEED_URL, this.#options.readTimeoutMs))
      if (release) return release
      throw new Error('the update feed is malformed')
    } catch (error) {
      throw new AggregateError([apiError, error], 'GitHub could not be read')
    }
  }

  /** Forgets what was read; for tests. */
  reset() {
    this.#known = null
    this.#reading = null
    this.#retryAt = 0
    this.#failing = false
  }
}

export const desktopReleases = new DesktopReleases()
