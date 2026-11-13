import { test } from '@japa/runner'
import clickhouse from 'adonisjs-clickhouse/services/main'
import { StatsRepository } from '#services/analytics/stats_repository'
import { notRemake } from '#services/analytics/remakes'
import { REMAKE_SECONDS, isRemake } from '../../inertia/lib/match.js'

/** Runs `run` with every ClickHouse query captured and answered with no rows. */
async function captured(run: () => Promise<unknown>) {
  const original = clickhouse.query
  const queries: string[] = []
  clickhouse.query = (async (options: { query: string }) => {
    queries.push(options.query)
    return { json: async () => [] }
  }) as unknown as typeof clickhouse.query
  try {
    await run()
  } finally {
    clickhouse.query = original
  }
  return queries
}

test.group('Remakes', () => {
  test('a game that ended before five minutes is a remake', ({ assert }) => {
    assert.equal(REMAKE_SECONDS, 300)
    assert.isTrue(isRemake({ duration: 0 }))
    assert.isTrue(isRemake({ duration: 192 }))
    assert.isTrue(isRemake({ duration: 299 }))
    assert.isFalse(isRemake({ duration: 300 }))
    assert.isFalse(isRemake({ duration: 1840 }))
  })

  test('the condition reads the remakes of the given players by match id', ({ assert }) => {
    const one = notRemake("it's")
    assert.include(one, 'match_id NOT IN')
    assert.include(one, `duration_sec < ${REMAKE_SECONDS}`)
    assert.include(one, "PREWHERE puuid IN ('it\\'s')")
    assert.include(notRemake(['a', 'b']), "PREWHERE puuid IN ('a','b')")
  })

  test('every profile summary leaves remakes out before its window', async ({ assert }) => {
    const repo = new StatsRepository()
    const queries = await captured(async () => {
      await repo.getSummonerActivity('me')
      await repo.getSummonerFriends('me')
      await repo.getSummonerStats('me', { count: 20 })
      await repo.getSummonerChampionStats('me', 50)
      await repo.getRecentGames(['me', 'you'], 10)
      await repo.getSeasonPool('me', { sinceMs: 0, queueIds: [420] })
    })
    assert.lengthOf(queries, 8)
    for (const sql of queries) {
      assert.include(sql, `duration_sec < ${REMAKE_SECONDS}`)
      const limit = sql.indexOf('LIMIT')
      if (limit >= 0) assert.isBelow(sql.indexOf('match_id NOT IN'), limit)
    }
  })
})
