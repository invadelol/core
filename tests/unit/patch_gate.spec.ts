import { test } from '@japa/runner'
import clickhouse from 'adonisjs-clickhouse/services/main'
import championStatsService from '#services/champion_stats_service'
import { latestPatch, shownPatches } from '#services/ranked_games_service'
import { PATCH_READY_GAMES, readyPatches } from '#services/ranked_stats'

test.group('Patch gate', () => {
  test('a patch is offered from PATCH_READY_GAMES crawled games, newest first', ({ assert }) => {
    const stored = [
      { patch: '16.22', games: PATCH_READY_GAMES - 1 },
      { patch: '16.21', games: 3_730_113 },
      { patch: '16.20', games: PATCH_READY_GAMES },
      { patch: '16.19', games: 4_000 },
    ]
    assert.deepEqual(
      readyPatches(stored).map((p) => p.patch),
      ['16.21', '16.20']
    )
    stored[0].games = PATCH_READY_GAMES
    assert.deepEqual(
      readyPatches(stored).map((p) => p.patch),
      ['16.22', '16.21', '16.20']
    )
  })

  test('a database with no ready patch offers its newest, an empty one none', ({ assert }) => {
    const stored = [
      { patch: '16.22', games: 1_200 },
      { patch: '16.21', games: 900 },
    ]
    assert.deepEqual(readyPatches(stored), [stored[0]])
    assert.deepEqual(readyPatches([]), [])
  })

  test('the menus, the default patch and the filters read the same list', async ({ assert }) => {
    const original = clickhouse.query
    const asked: string[] = []
    clickhouse.query = (async (options: { query: string }) => {
      asked.push(options.query)
      return {
        json: async () => [
          ['16.22', String(PATCH_READY_GAMES - 1)],
          ['16.21', '3730113'],
          ['16.20', '1042055'],
        ],
      }
    }) as unknown as typeof clickhouse.query
    try {
      assert.deepEqual(await shownPatches(), [
        { patch: '16.21', games: 3_730_113 },
        { patch: '16.20', games: 1_042_055 },
      ])
      assert.equal(await latestPatch(), '16.21')
      assert.deepEqual(await championStatsService.patches(), await shownPatches())
      // A patch still filling up is not offered: asking for it answers with the default.
      const early = await championStatsService.filter({ patch: '16.22' })
      assert.equal(early?.patch, '16.21')
      const older = await championStatsService.filter({ patch: '16.20' })
      assert.equal(older?.patch, '16.20')
      assert.lengthOf(asked, 1, 'one query for every reader, then the cached list')
      assert.include(asked[0], 'FROM match_seed')
    } finally {
      clickhouse.query = original
    }
  })
})
