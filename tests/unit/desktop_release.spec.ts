import { test } from '@japa/runner'
import net from 'node:net'
import {
  BUILT_IN_RELEASE,
  DESKTOP_PLATFORMS,
  DesktopReleases,
  desktopPlatform,
  fetchJson,
  isDesktopPlatform,
  parseFeed,
  parseRelease,
  releaseOf,
} from '#services/desktop_release'

const base = 'https://github.com/invadelol/releases/releases/download/v0.2.0'
const asset = (name: string) => ({ name, browser_download_url: `${base}/${name}` })
const API = 'https://api.github.com/repos/invadelol/releases/releases/latest'
const FEED = 'https://github.com/invadelol/releases/releases/latest/download/latest.json'

const payload = (version: string) => ({
  tag_name: `v${version}`,
  draft: false,
  assets: [
    `Invade_${version}_x64-setup.exe`,
    `Invade_${version}_aarch64.dmg`,
    `Invade_${version}_x64.dmg`,
  ].map((name) => ({
    name,
    browser_download_url: `https://github.com/invadelol/releases/releases/download/v${version}/${name}`,
  })),
})

const feed = (version: string) => ({
  version,
  platforms: {
    'windows-x86_64': {
      url: `https://github.com/invadelol/releases/releases/download/v${version}/Invade_${version}_x64-setup.exe`,
    },
    'darwin-aarch64': {
      url: `https://github.com/invadelol/releases/releases/download/v${version}/Invade_aarch64.app.tar.gz`,
    },
  },
})

const never = () => new Promise<never>(() => {})
const fail = (status: number) => () => Promise.reject(new Error(`answered ${status}`))

/** A reader that answers per URL and counts its calls. */
function reader(answers: Record<string, () => Promise<unknown>>) {
  const calls: string[] = []
  const read = (url: string) => {
    calls.push(url)
    return answers[url]?.() ?? Promise.reject(new Error('unexpected url'))
  }
  return { read, calls }
}

async function timed<T>(work: Promise<T>) {
  const started = performance.now()
  const value = await work
  return { value, ms: performance.now() - started }
}

test.group('Desktop release: parsing', () => {
  test('picks the installer of each platform and strips the tag prefix', ({ assert }) => {
    const release = parseRelease({
      tag_name: 'v0.2.0',
      draft: false,
      assets: [
        asset('latest.json'),
        asset('Invade_0.2.0_x64-setup.exe'),
        asset('Invade_0.2.0_x64-setup.exe.sig'),
        asset('Invade_0.2.0_aarch64.dmg'),
        asset('Invade_0.2.0_x64.dmg'),
        asset('Invade_aarch64.app.tar.gz'),
      ],
    })
    assert.equal(release?.version, '0.2.0')
    assert.deepEqual(release?.urls, {
      'windows': `${base}/Invade_0.2.0_x64-setup.exe`,
      'mac-arm': `${base}/Invade_0.2.0_aarch64.dmg`,
      'mac-intel': `${base}/Invade_0.2.0_x64.dmg`,
    })
  })

  test('leaves out platforms that are not built yet and refuses foreign hosts', ({ assert }) => {
    const release = parseRelease({
      tag_name: 'v0.2.0',
      assets: [
        asset('Invade_0.2.0_aarch64.dmg'),
        {
          name: 'Invade_0.2.0_x64-setup.exe',
          browser_download_url: 'https://evil.example/Invade_0.2.0_x64-setup.exe',
        },
      ],
    })
    assert.deepEqual(Object.keys(release!.urls), ['mac-arm'])
  })

  test('ignores drafts and malformed payloads', ({ assert }) => {
    assert.isNull(parseRelease({ tag_name: 'v1', draft: true, assets: [] }))
    assert.isNull(parseRelease(null))
    assert.isNull(parseRelease({ assets: [] }))
    assert.deepEqual(parseRelease({ tag_name: 'v1', assets: [null, 3, {}] })?.urls, {})
  })

  test('reads the update feed: its Windows setup, and the disk images by name', ({ assert }) => {
    const release = parseFeed(feed('0.4.0'))
    assert.equal(release?.version, '0.4.0')
    assert.deepEqual(release?.urls, releaseOf('0.4.0').urls)
  })

  test('refuses a feed that is malformed or points elsewhere', ({ assert }) => {
    assert.isNull(parseFeed(null))
    assert.isNull(parseFeed({ version: '../../x' }))
    const foreign = parseFeed({
      version: '0.4.0',
      platforms: { 'windows-x86_64': { url: 'https://evil.example/Invade_0.4.0_x64-setup.exe' } },
    })
    assert.notProperty(foreign!.urls, 'windows')
    const archive = parseFeed({
      version: '0.4.0',
      platforms: {
        'windows-x86_64': {
          url: 'https://github.com/invadelol/releases/releases/download/v0.4.0/Invade_0.4.0_x64.msi',
        },
      },
    })
    assert.notProperty(archive!.urls, 'windows')
  })

  test('the built-in release names a file for every platform', ({ assert }) => {
    for (const platform of DESKTOP_PLATFORMS) {
      assert.match(
        BUILT_IN_RELEASE.urls[platform],
        /^https:\/\/github\.com\/invadelol\/releases\/releases\/download\/v\d+\.\d+\.\d+\/Invade_/
      )
    }
    // Same names as the parser expects from GitHub.
    const parsed = parseRelease(payload(BUILT_IN_RELEASE.version))
    assert.deepEqual(parsed?.urls, BUILT_IN_RELEASE.urls)
  })

  test('only known platform ids and their aliases are accepted', ({ assert }) => {
    for (const id of DESKTOP_PLATFORMS) {
      assert.isTrue(isDesktopPlatform(id))
      assert.equal(desktopPlatform(id), id)
    }
    assert.equal(desktopPlatform('mac'), 'mac-arm')
    assert.equal(desktopPlatform('macOS'), 'mac-arm')
    assert.equal(desktopPlatform('Windows'), 'windows')
    assert.isNull(desktopPlatform('linux'))
    assert.isNull(desktopPlatform('../etc'))
    assert.isNull(desktopPlatform('constructor'))
    assert.isNull(desktopPlatform('__proto__'))
  })
})

test.group('Desktop release: reading GitHub', () => {
  test('answers from GitHub once it has answered', async ({ assert }) => {
    const { read, calls } = reader({ [API]: async () => payload('0.4.0') })
    const releases = new DesktopReleases({ read })
    const installer = await releases.installer('windows')
    assert.equal(installer.version, '0.4.0')
    assert.equal(installer.source, 'github')
    assert.match(installer.url, /v0\.4\.0\/Invade_0\.4\.0_x64-setup\.exe$/)
    await releases.installer('mac-arm')
    assert.deepEqual(calls, [API])
  })

  test('a GitHub that never answers costs a first visitor a moment, then the built-in release', async ({
    assert,
  }) => {
    const { read } = reader({ [API]: never, [FEED]: never })
    const releases = new DesktopReleases({ read, readTimeoutMs: 100, firstWaitMs: 50 })
    const { value, ms } = await timed(releases.installer('windows'))
    assert.equal(value.source, 'built-in')
    assert.equal(value.url, BUILT_IN_RELEASE.urls.windows)
    assert.isBelow(ms, 400)
  })

  test('a read that hangs is given up, so the next one can start', async ({ assert }) => {
    let answer: () => Promise<unknown> = never
    const releases = new DesktopReleases({
      read: (url) => (url === API ? answer() : never()),
      readTimeoutMs: 50,
      firstWaitMs: 20,
    })
    const start = Date.now()
    assert.isNull(await releases.latest(start))
    // Both reads time out, then the whole read is over: nothing stays pending.
    await new Promise((resolve) => setTimeout(resolve, 250))
    answer = async () => payload('0.4.1')
    // After the retry pause, a new read starts and answers.
    const later = start + 61_000
    assert.equal((await releases.latest(later))?.version, '0.4.1')
  })

  test('an old answer is served at once while a new one is read', async ({ assert }) => {
    let answer: () => Promise<unknown> = async () => payload('0.4.0')
    const releases = new DesktopReleases({
      read: (url) => (url === API ? answer() : never()),
      readTimeoutMs: 100,
      firstWaitMs: 50,
    })
    const start = Date.now()
    assert.equal((await releases.latest(start))?.version, '0.4.0')
    answer = never
    const { value, ms } = await timed(releases.latest(start + 6 * 60_000))
    assert.equal(value?.version, '0.4.0')
    assert.isBelow(ms, 20)
  })

  test('falls back to the update feed when the API refuses', async ({ assert }) => {
    const { read, calls } = reader({ [API]: fail(403), [FEED]: async () => feed('0.4.2') })
    const releases = new DesktopReleases({ read })
    const installer = await releases.installer('windows')
    assert.equal(installer.version, '0.4.2')
    assert.equal(installer.source, 'github')
    assert.deepEqual(calls, [API, FEED])
  })

  test('after a failure, GitHub is left alone for a minute', async ({ assert }) => {
    const { read, calls } = reader({ [API]: fail(500), [FEED]: fail(500) })
    const releases = new DesktopReleases({ read })
    const start = Date.now()
    assert.isNull(await releases.latest(start))
    assert.isNull(await releases.latest(start + 1_000))
    assert.lengthOf(calls, 2)
    assert.equal((await releases.installer('mac-intel', start + 2_000)).source, 'built-in')
    assert.lengthOf(calls, 2)
  })

  test('a platform missing from the newest release falls back on its own', async ({ assert }) => {
    const partial = payload('0.4.0')
    partial.assets = partial.assets.filter((a) => !a.name.endsWith('_x64.dmg'))
    const releases = new DesktopReleases({ read: async () => partial })
    assert.equal((await releases.installer('mac-arm')).version, '0.4.0')
    const intel = await releases.installer('mac-intel')
    assert.equal(intel.source, 'built-in')
    assert.equal(intel.url, BUILT_IN_RELEASE.urls['mac-intel'])
  })
})

test.group('Desktop release: the network', (group) => {
  let server: net.Server
  let port = 0
  const sockets = new Set<net.Socket>()
  group.setup(async () => {
    // Accepts connections and never answers, like a stalled upstream.
    server = net.createServer((socket) => sockets.add(socket))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    port = (server.address() as net.AddressInfo).port
    return () => {
      for (const socket of sockets) socket.destroy()
      return new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  test('a read of a server that never answers gives up on time', async ({ assert }) => {
    const started = performance.now()
    const error: Error = await fetchJson(`http://127.0.0.1:${port}/latest.json`, 200).then(
      () => new Error('answered'),
      (e: Error) => e
    )
    assert.match(error.message, /no answer within 200 ms/)
    assert.isBelow(performance.now() - started, 600)
  })
})
