import { test } from '@japa/runner'
import pickStatsService from '#services/pick_stats_service'

test.group('Pick stats', (group) => {
  const forRole = pickStatsService.forRole
  group.each.teardown(() => {
    pickStatsService.forRole = forRole
  })

  test('brackets sent as a plain comma list are each read, in order', async ({
    client,
    assert,
  }) => {
    let asked: string[] = []
    pickStatsService.forRole = async (_champion, _role, brackets) => {
      asked = brackets
      return Object.fromEntries(
        brackets.map((b) => [b, { runes: null, builds: null, summoners: null }])
      )
    }

    // A literal comma, as the desktop app sends it: the query parser makes it a list.
    const response = await client.get('/api/picks/157/support?brackets=emerald,emerald_plus,all')
    response.assertStatus(200)
    assert.deepEqual(asked, ['emerald', 'emerald_plus', 'all'])
    assert.deepEqual(Object.keys(response.body().brackets), ['emerald', 'emerald_plus', 'all'])

    const encoded = await client.get('/api/picks/157/support?brackets=diamond%2Call')
    encoded.assertStatus(200)
    assert.deepEqual(asked, ['diamond', 'all'])
  })

  test('an unknown bracket or more than five are refused', async ({ client }) => {
    pickStatsService.forRole = async () => ({})
    const unknown = await client.get('/api/picks/157/support?brackets=emerald,bogus')
    unknown.assertStatus(422)
    const six = await client.get(
      '/api/picks/157/support?brackets=iron,bronze,silver,gold,platinum,emerald'
    )
    six.assertStatus(422)
  })
})
