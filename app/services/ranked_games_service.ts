import clickhouse from 'adonisjs-clickhouse/services/main'
import {
  AnswerCache,
  PATCH_READY_GAMES,
  PATCH_START_SQL,
  RANKED_SOLO,
} from '#services/ranked_stats'
import { StatsCache } from '#services/stats_cache'

/**
 * The ranked games of our own ClickHouse (the crawler fills the same tables as the site), as
 * the rune, build and summoner spell statistics read them.
 */

/** How soon a new patch is noticed: the default patch is asked again this often. */
const PATCH_CHECK_MS = 10 * 60_000

const patches = new AnswerCache(1, PATCH_CHECK_MS)

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

const starts = new AnswerCache(8, PATCH_CHECK_MS)

/**
 * When `patch`'s first game started, in ms (`PATCH_START_SQL`): the `{patchStart:UInt64}` of the
 * per-champion queries. Asked once per patch and kept as long as the default patch, instead of
 * two scans of `matches` and `match_seed` in every query.
 */
export function patchStart(patch: string): Promise<number> {
  return starts.get(patch, async () => {
    const [row] = await rows(`SELECT ${PATCH_START_SQL}`, { patch })
    return Number(row?.[0] ?? 0)
  })
}

/**
 * The statistics cache of one kind of answer, kept a day (`stats_cache.ts`). Its generation is
 * the default patch: once a new one has enough games, every answer is computed again.
 */
export function statsCache(namespace: string, maxLocal?: number) {
  return new StatsCache(namespace, {
    generation: async () => (await latestPatch()) ?? 'none',
    ...(maxLocal ? { maxLocal } : {}),
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
