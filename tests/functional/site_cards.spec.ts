import { test } from '@japa/runner'

test.group('Site share cards', () => {
  test('the home card is a JPEG with an ETag, a 304 when it matches', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/og/home.jpg?v=1')
    response.assertStatus(200)
    response.assertHeader('content-type', 'image/jpeg')
    const etag = response.header('etag')
    assert.match(etag, /^"[\w-]+"$/)
    const again = await client.get('/og/home.jpg?v=1').header('if-none-match', etag)
    again.assertStatus(304)
  })

  test('an unknown champion, role, view, league, pro or team is not found', async ({ client }) => {
    for (const path of [
      '/og/champion/not-a-champion/mid.jpg',
      '/og/tier-list/carry.jpg',
      '/og/stats/everything.jpg',
      '/og/pros/not-a-league.jpg',
      '/og/pro/not-a-pro-anywhere.jpg',
      '/og/team/not-a-team-anywhere.jpg',
      '/og/tier-list/mid.png',
    ]) {
      const response = await client.get(path)
      response.assertStatus(404)
    }
  })
})
