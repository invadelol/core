import { test } from '@japa/runner'
import cache from '@adonisjs/cache/services/main'
import drive from '@adonisjs/drive/services/main'

import riotAssets, { RiotAssetsService } from '#services/riot/assets'
import { gameData } from '#services/riot/asset_paths'
import { DDRAGON } from '#constants/assets'

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
const RELEASE = { cdragon: '16.20', ddragon: '16.20.1' }
const ROOT = gameData(RELEASE)

/**
 * Upstream, stubbed: Data Dragon's version list, one champion manifest and
 * one icon. Every request is counted, so a test can tell how often the proxy
 * actually went to Riot.
 */
function upstream(delay = 0) {
  const calls: string[] = []
  const files: Record<string, () => Response> = {
    [`${DDRAGON}/api/versions.json`]: () => Response.json(['16.20.1', '16.19.1']),
    [`${ROOT}/v1/champion-summary.json`]: () =>
      Response.json([
        {
          id: 266,
          name: 'Aatrox',
          squarePortraitPath: '/lol-game-data/assets/v1/champion-icons/266.png',
        },
      ]),
    [`${ROOT}/v1/champion-icons/266.png`]: () =>
      new Response(PNG, { headers: { 'content-type': 'image/png' } }),
  }
  const original = globalThis.fetch
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    calls.push(url)
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    return files[url]?.() ?? new Response('not found', { status: 404 })
  }) as typeof fetch
  return { calls, restore: () => (globalThis.fetch = original) }
}

test.group('Asset proxy', (group) => {
  let stub: ReturnType<typeof upstream>
  let disk: ReturnType<typeof drive.fake>

  group.each.setup(async () => {
    // A fresh process's view of upstream: no memoised releases, nothing hot, nothing mirrored.
    Object.assign(riotAssets, new RiotAssetsService())
    await cache.deleteMany({
      keys: ['riot:manifest:16.20:champion', 'riot:manifest:latest:champion'],
    })
    disk = drive.fake()
    return () => {
      stub?.restore()
      drive.restore()
    }
  })

  test('a pinned patch is immutable, validated and revalidates to 304', async ({
    client,
    assert,
  }) => {
    stub = upstream()
    const response = await client.get('/cdn/16.20/champion/266.png')

    response.assertStatus(200)
    response.assertHeader('content-type', 'image/png')
    response.assertHeader('cache-control', 'public, max-age=31536000, immutable')
    response.assertHeader('x-asset-source', 'riot')
    response.assertHeader('x-content-type-options', 'nosniff')
    response.assertHeader('access-control-allow-origin', '*')
    const etag = response.header('etag')!
    assert.match(etag, /^"[\w-]+"$/)
    assert.isString(response.header('last-modified'))
    assert.deepEqual(Buffer.from(response.response.body), PNG)

    const again = await client.get('/cdn/16.20/champion/266.png').header('if-none-match', etag)
    again.assertStatus(304)
  })

  test('without a patch, the live one under a day of cache', async ({ client }) => {
    stub = upstream()
    const response = await client.get('/cdn/champion/266.png')
    response.assertStatus(200)
    response.assertHeader('cache-control', 'public, max-age=86400, stale-while-revalidate=604800')
  })

  test('a patch outside the window is served live, not pinned', async ({ client }) => {
    stub = upstream()
    const response = await client.get('/cdn/9.1/champion/266.png')
    response.assertStatus(200)
    response.assertHeader('cache-control', 'public, max-age=86400, stale-while-revalidate=604800')
  })

  test('fetches upstream once per patch, mirrors it, and coalesces a burst', async ({
    client,
    assert,
  }) => {
    stub = upstream(50)
    const responses = await Promise.all(
      Array.from({ length: 12 }, () => client.get('/cdn/16.20/champion/266.png'))
    )
    for (const response of responses) response.assertStatus(200)

    const icon = `${ROOT}/v1/champion-icons/266.png`
    assert.equal(stub.calls.filter((url) => url === icon).length, 1)
    assert.equal(stub.calls.filter((url) => url.endsWith('versions.json')).length, 1)
    disk.assertExists('riot-assets/16.20/champion/266')

    // A new process (memory gone) reads the mirror, not Riot.
    Object.assign(riotAssets, new RiotAssetsService())
    await client.get('/cdn/16.20/champion/266.png')
    assert.equal(stub.calls.filter((url) => url === icon).length, 1)
  })

  test('an upstream failure is a placeholder, cached for a minute and never mirrored', async ({
    client,
  }) => {
    stub = upstream()
    const response = await client.get('/cdn/16.20/champion/999.png')

    response.assertStatus(200)
    response.assertHeader('x-asset-source', 'placeholder')
    response.assertHeader('cache-control', 'public, max-age=60')
    response.assertHeader('content-type', 'image/svg+xml; charset=utf-8')
    response.assertHeaderMissing('etag')
    disk.assertMissing('riot-assets/16.20/champion/999')
  })

  test('refuses anything outside the allow-list without touching upstream', async ({
    client,
    assert,
  }) => {
    stub = upstream()
    for (const path of [
      '/cdn/unknown/1.png',
      '/cdn/champion/Aatrox.png',
      '/cdn/16.20.1/champion/266.png',
      '/cdn/latest/champion/266.png',
      '/cdn/rank/wood.svg',
      '/cdn/names/unknown',
      '/cdn/names/constructor',
    ]) {
      const response = await client.get(path)
      response.assertStatus(404)
    }
    assert.deepEqual(stub.calls, [])
  })

  test('answers cross-origin requests from the desktop app', async ({ client }) => {
    stub = upstream()
    const response = await client
      .get('/cdn/16.20/champion/266.png')
      .header('origin', 'tauri://localhost')
    response.assertStatus(200)
    response.assertHeader('cross-origin-resource-policy', 'cross-origin')
  })
})
