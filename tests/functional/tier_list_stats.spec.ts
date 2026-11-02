import { test } from '@japa/runner'
import championStatsService from '#services/champion_stats_service'
import { tierListReport } from '#services/tier_list_stats'
import type { Filter } from '#services/champion_stats'

const PATCHES = [
  { patch: '16.21', games: 2_700_000 },
  { patch: '16.20', games: 1_000_000 },
]

test.group('Tier list stats', (group) => {
  const { filter, tierList } = championStatsService
  group.each.teardown(() => {
    championStatsService.filter = filter
    championStatsService.tierList = tierList
  })

  /** Filters as the service fills them, an unknown patch answered with the newest. */
  function stub() {
    const asked: unknown[] = []
    championStatsService.filter = async (input) => {
      asked.push(input)
      const patch = PATCHES.some((p) => p.patch === input.patch) ? String(input.patch) : '16.21'
      return { patch, bracket: input.rank, region: input.region ?? null } as Filter
    }
    championStatsService.tierList = async (f) =>
      tierListReport(
        {
          patch: f.patch,
          bracket: f.bracket,
          region: f.region,
          games: 10,
          roles: [],
          ranked: {} as never,
        },
        null,
        PATCHES
      )
    return asked
  }

  test('answers every role for a bracket and patch, all ranks by default', async ({
    client,
    assert,
  }) => {
    const asked = stub()
    const response = await client.get('/api/tier-list?bracket=emerald_plus&patch=16.20&region=euw')
    response.assertStatus(200)
    assert.deepEqual(asked[0], { rank: 'emerald_plus', patch: '16.20', region: 'euw' })
    assert.include(response.body(), { patch: '16.20', bracket: 'emerald_plus', region: 'euw' })
    assert.deepEqual(response.body().patches, PATCHES)
    // An older patch is kept longer.
    assert.include(response.header('cache-control'), 'max-age=21600')

    const newest = await client.get('/api/tier-list')
    newest.assertStatus(200)
    assert.include(newest.body(), { patch: '16.21', bracket: 'all' })
    assert.include(newest.header('cache-control'), 'max-age=1800')
  })

  test('a malformed patch or an unknown bracket is refused', async ({ client }) => {
    stub()
    const patch = await client.get('/api/tier-list?patch=16.21.1')
    patch.assertStatus(422)
    const bracket = await client.get('/api/tier-list?bracket=bogus')
    bracket.assertStatus(422)
  })

  test('no stored games yet answers 404', async ({ client }) => {
    stub()
    championStatsService.filter = async () => null
    const response = await client.get('/api/tier-list')
    response.assertStatus(404)
  })
})
