import clickhouse from 'adonisjs-clickhouse/services/main'
import { AnswerCache, PATCH_READY_GAMES, RANKED_SOLO } from '#services/ranked_stats'

/**
 * The ranked games of our own ClickHouse (the crawler fills the same tables as the site), as
 * the rune, build and summoner spell statistics read them.
 */

const patches = new AnswerCache(1)

/** The newest patch with enough ranked games: every statistic defaults to it. */
export function latestPatch(): Promise<string | null> {
  return patches.get('patch', async () => {
    const [row] = await rows(`
          SELECT patch FROM matches
          WHERE queue_id = ${RANKED_SOLO}
          GROUP BY patch HAVING count() >= ${PATCH_READY_GAMES}
          ORDER BY max(game_start_ms) DESC LIMIT 1
        `)
    return row ? String(row[0]) : null
  })
}

/** A query's rows as arrays (`JSONCompactEachRow`). */
export async function rows(query: string, params?: Record<string, unknown>): Promise<unknown[][]> {
  const result = await clickhouse.query({
    query,
    query_params: params,
    format: 'JSONCompactEachRow',
  })
  return ((await result.json<unknown[]>()) ?? []) as unknown[][]
}
