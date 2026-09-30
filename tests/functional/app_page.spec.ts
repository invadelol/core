import { test } from '@japa/runner'
import { desktopReleases } from '#services/desktop_release'

test.group('Desktop app page', (group) => {
  const latest = desktopReleases.latest
  group.each.teardown(() => {
    desktopReleases.latest = latest
  })

  test('renders with the newest version and its own social card', async ({ client }) => {
    desktopReleases.latest = async () => ({ version: '0.2.2', urls: {} })
    const response = await client.get('/app')
    response.assertStatus(200)
    response.assertTextIncludes('Invade for desktop')
    response.assertTextIncludes('0.2.2')
    response.assertTextIncludes('property="og:type" content="website"')
    response.assertTextIncludes('https://invade.lol/landing/og.png')
  })

  test('still renders when the release cannot be read', async ({ client }) => {
    desktopReleases.latest = async () => null
    const response = await client.get('/app')
    response.assertStatus(200)
    response.assertTextIncludes('Invade for desktop')
  })
})
