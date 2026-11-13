import type { ClickHouseSettings } from '@clickhouse/client'
import clickhouse from 'adonisjs-clickhouse/services/main'
import { AnswerCache, PATCH_START_SQL, readyPatches } from '#services/ranked_stats'
import { StatsCache } from '#services/stats_cache'
import { patchRange, patchValue } from '../../inertia/lib/patches.js'

/**
 * The ranked games of our own ClickHouse (the crawler fills the same tables as the site), as
 * the rune, build and summoner spell statistics read them.
 */

/** How soon a new patch is noticed: the patch list is asked again this often. */
const PATCH_CHECK_MS = 10 * 60_000

const patches = new AnswerCache(1, PATCH_CHECK_MS)

export interface StoredPatch {
  patch: string
  /** Crawled ranked games of the patch. */
  games: number
}

/** Every patch with crawled games, newest first (a year of them at most). */
export function storedPatches(): Promise<StoredPatch[]> {
  return patches.get('stored', async () => {
    const found = await rows(`
      SELECT patch, count() FROM match_seed
      GROUP BY patch ORDER BY max(game_start_ms) DESC LIMIT 24
    `)
    return found.map(([patch, games]) => ({ patch: String(patch), games: Number(games) }))
  })
}

/**
 * The patches every patch menu offers, newest first: those with enough crawled games
 * (`PATCH_READY_GAMES`). The site and the desktop app read their menus from here.
 */
export async function shownPatches(): Promise<StoredPatch[]> {
  return readyPatches(await storedPatches())
}

/** The newest patch of the menus: every statistic defaults to it. */
export async function latestPatch(): Promise<string | null> {
  const [newest] = await shownPatches()
  return newest?.patch ?? null
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

/** When the oldest of `patches` started, in ms (`patchStart`, each patch asked once). */
export async function rangeStart(read: readonly string[]): Promise<number> {
  const found = await Promise.all(read.map((p) => patchStart(p)))
  return found.length ? Math.min(...found) : 0
}

/** The patches a statistic reads (newest first) and their address value (`16.20-16.22`). */
export interface PatchRead {
  patch: string
  patches: string[]
}

/**
 * The patches the API's `patch` asks for: one patch as it is (any stored patch, as always), a
 * range of the offered ones (`16.20-16.22`, `patchRange`), the newest offered patch without one
 * or when the range is not offered. Null while no patch is stored.
 */
export async function readPatches(value?: string | null): Promise<PatchRead | null> {
  if (value && !value.includes('-')) return { patch: value, patches: [value] }
  if (value) {
    const shown = await shownPatches()
    const range = patchRange(
      value,
      shown.map((p) => p.patch)
    )
    if (range) return { patch: patchValue(range), patches: range }
  }
  const latest = await latestPatch()
  return latest ? { patch: latest, patches: [latest] } : null
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

/** A query's rows as arrays (`JSONCompactEachRow`), with optional ClickHouse settings. */
export async function rows(
  query: string,
  params?: Record<string, unknown>,
  settings?: ClickHouseSettings
): Promise<unknown[][]> {
  const result = await clickhouse.query({
    query,
    query_params: params,
    format: 'JSONCompactEachRow',
    ...(settings ? { clickhouse_settings: settings } : {}),
  })
  return ((await result.json<unknown[]>()) ?? []) as unknown[][]
}
