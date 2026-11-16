import { test } from '@japa/runner'

test.group('Removed pages', () => {
  test('the live game page leads home, and a profile’s live tab to the profile', async ({
    client,
  }) => {
    const tool = await client.get('/live').redirects(0)
    tool.assertStatus(302)
    tool.assertHeader('location', '/')

    // Links already shared (the desktop app's Discord presence) keep their query.
    const tab = await client.get('/Someone-EUW/live?ref=discord').redirects(0)
    tab.assertStatus(302)
    tab.assertHeader('location', '/Someone-EUW?ref=discord')
  })

  test('the live game API is gone', async ({ client }) => {
    const lanes = await client.get('/api/lanes?pairs=TOP.122.86')
    lanes.assertStatus(404)
  })
})
