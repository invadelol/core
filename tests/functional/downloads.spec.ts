import { test } from '@japa/runner'
import { BUILT_IN_RELEASE, desktopReleases } from '#services/desktop_release'

const url = (name: string) =>
  `https://github.com/invadelol/releases/releases/download/v0.4.0/${name}`

test.group('Desktop downloads', (group) => {
  const latest = desktopReleases.latest
  group.each.teardown(() => {
    desktopReleases.latest = latest
  })

  test('redirects to the newest installer for the platform', async ({ client }) => {
    desktopReleases.latest = async () => ({
      version: '0.4.0',
      urls: { windows: url('Invade_0.4.0_x64-setup.exe') },
    })
    const response = await client.get('/download/windows').redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', url('Invade_0.4.0_x64-setup.exe'))
  })

  test('a Mac link without a chip goes to the Apple Silicon installer', async ({ client }) => {
    desktopReleases.latest = async () => ({
      version: '0.4.0',
      urls: { 'mac-arm': url('Invade_0.4.0_aarch64.dmg') },
    })
    const response = await client.get('/download/mac').redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', url('Invade_0.4.0_aarch64.dmg'))
  })

  test('without an answer from GitHub, the built-in release is served', async ({ client }) => {
    desktopReleases.latest = async () => null
    const offline = await client.get('/download/windows').redirects(0)
    offline.assertStatus(302)
    offline.assertHeader('location', BUILT_IN_RELEASE.urls.windows)

    desktopReleases.latest = async () => ({ version: '0.4.0', urls: {} })
    const missing = await client.get('/download/mac-intel').redirects(0)
    missing.assertStatus(302)
    missing.assertHeader('location', BUILT_IN_RELEASE.urls['mac-intel'])
  })

  test('the redirect is never cached on the way', async ({ client, assert }) => {
    desktopReleases.latest = async () => null
    const response = await client.get('/download/windows').redirects(0)
    assert.notInclude(String(response.header('cache-control')), 'public')
  })

  test('unknown platforms are not found', async ({ client }) => {
    const response = await client.get('/download/linux').redirects(0)
    response.assertStatus(404)
  })

  test('a bare /download leads to the app page, keeping its tag', async ({ client }) => {
    const response = await client.get('/download?ref=discord').redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/app?ref=discord')
  })
})
