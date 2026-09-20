import { test } from '@japa/runner'
import clickhouse from 'adonisjs-clickhouse/services/main'
import { StatsRepository } from '#services/analytics/stats_repository'
import { getChampionStatsValidator } from '#validators/summoner'

test.group('Champion explorer filters', () => {
  test('filters before limiting games and returns numeric best kills and play time', async ({
    assert,
  }) => {
    const original = clickhouse.query
    let sql = ''
    clickhouse.query = (async (options: { query: string }) => {
      sql = options.query
      return {
        json: async () => [[45, '5', '4', 0.8, 4.2, 6.8, 3, 5.4, 4.3, 453, 618, '11', '6758']],
      }
    }) as unknown as typeof clickhouse.query
    try {
      const rows = await new StatsRepository().getSummonerChampionStats('player', 50, {
        queueIds: [420, 440],
        role: 'SUPPORT',
      })
      const window = sql.slice(sql.indexOf('WITH my_matches'), sql.indexOf('mine AS'))
      assert.include(window, 'queue_id IN (420,440)')
      assert.include(window, "team_position = 'UTILITY'")
      assert.isBelow(window.indexOf('team_position'), window.indexOf('LIMIT 50'))
      assert.equal(rows[0].maxKills, 11)
      assert.equal(rows[0].duration, 6758)
      assert.equal(rows[0].games, 5)
    } finally {
      clickhouse.query = original
    }
  })

  test('all queues and roles do not narrow the champion pool', async ({ assert }) => {
    const original = clickhouse.query
    let sql = ''
    clickhouse.query = (async (options: { query: string }) => {
      sql = options.query
      return { json: async () => [] }
    }) as unknown as typeof clickhouse.query
    try {
      assert.deepEqual(
        await new StatsRepository().getSummonerChampionStats('player', 100, { role: 'all' }),
        []
      )
      assert.notInclude(sql, 'queue_id IN')
      assert.notInclude(sql, 'team_position =')
    } finally {
      clickhouse.query = original
    }
  })

  test('rejects unsupported queues, roles, and oversized samples', async ({ assert }) => {
    for (const payload of [{ type: 'bad' }, { role: 'INVALID' }, { count: 101 }]) {
      await assert.rejects(() => getChampionStatsValidator.validate(payload))
    }
    assert.deepEqual(
      await getChampionStatsValidator.validate({ type: 'ranked', role: 'SUPPORT', count: 100 }),
      { type: 'ranked', role: 'SUPPORT', count: 100 }
    )
  })
})
