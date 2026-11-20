import { test } from '@japa/runner'

test.group('Removed pages', () => {
  test('the live game tool leads home: a live game is a profile’s Live section', async ({
    client,
  }) => {
    const tool = await client.get('/live').redirects(0)
    tool.assertStatus(302)
    tool.assertHeader('location', '/')
  })

  test('the live game API is gone', async ({ client }) => {
    const lanes = await client.get('/api/lanes?pairs=TOP.122.86')
    lanes.assertStatus(404)
  })
})
