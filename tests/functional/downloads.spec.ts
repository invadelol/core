import { test } from '@japa/runner'
import { desktopReleases } from '#services/desktop_release'

test.group('Desktop downloads', (group) => {
  const latest = desktopReleases.latest
  group.each.teardown(() => {
    desktopReleases.latest = latest
  })

  test('redirects to the newest installer for the platform', async ({ client }) => {
    desktopReleases.latest = async () => ({
      version: '0.2.0',
      urls: { windows: 'https://github.com/invadelol/releases/releases/download/v0.2.0/a.exe' },
    })
    const response = await client.get('/download/windows').redirects(0)
    response.assertStatus(302)
    response.assertHeader(
      'location',
      'https://github.com/invadelol/releases/releases/download/v0.2.0/a.exe'
    )
  })

  test('reports an unavailable build instead of redirecting nowhere', async ({ client }) => {
    desktopReleases.latest = async () => ({ version: '0.2.0', urls: {} })
    const missing = await client.get('/download/mac-intel').redirects(0)
    missing.assertStatus(503)
    desktopReleases.latest = async () => null
    const offline = await client.get('/download/windows').redirects(0)
    offline.assertStatus(503)
  })

  test('unknown platforms are not found', async ({ client }) => {
    const response = await client.get('/download/linux').redirects(0)
    response.assertStatus(404)
  })
})
