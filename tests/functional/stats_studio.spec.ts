import { test } from '@japa/runner'

test.group('Stats studio', () => {
  test("the old explorer's addresses move to their page, filters kept", async ({ client }) => {
    const early = await client.get('/stats?view=early&role=mid').redirects(0)
    early.assertStatus(301)
    early.assertHeader('location', '/stats/gold-lead-10?role=mid')
    const sorted = await client.get('/stats?view=table&sort=ahead').redirects(0)
    sorted.assertStatus(301)
    sorted.assertHeader('location', '/stats/ahead-at-10')
    const overview = await client.get('/stats?view=overview&rank=all').redirects(0)
    overview.assertStatus(301)
    overview.assertHeader('location', '/stats?rank=all')
  })

  test('a statistic the studio does not have is not found', async ({ client }) => {
    const response = await client.get('/stats/nope')
    response.assertStatus(404)
  })
})
