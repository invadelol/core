import logger from '@adonisjs/core/services/logger'
import redis from '@adonisjs/redis/services/main'
import clickhouse from 'adonisjs-clickhouse/services/main'
import { AnswerCache } from '#services/ranked_stats'
import { rows } from '#services/ranked_games_service'
import {
  cellCountsSql,
  countedPatchesSql,
  lanePairCellsSql,
  roleCellsSql,
} from '#services/champion_stats'

/**
 * The pre-counted champion statistics (migration 0013): each patch's crawled games counted per
 * seed tier and platform, so every filter of the champion pages and of the desktop app's
 * matchups is a sum of a few thousand rows. A patch is counted into the `_next` tables, then
 * swapped in; the newest patches again every hour (the crawler keeps adding games), the older
 * ones every day. A patch not counted yet is read from the games as before.
 */

/** Counted again this often: the patches still filling up, and the others. */
const LIVE_EVERY_MS = 3600_000
const OLD_EVERY_MS = 24 * 3600_000
/** The newest patches, counted hourly. */
const LIVE_PATCHES = 2
/** One count at a time across processes (a deploy runs two for a moment). */
const LOCK = 'stats:cells:refresh'
const LOCK_MS = 30 * 60_000
const CHECK_MS = 10 * 60_000

const TABLES = ['stats_lane_pairs', 'stats_champion_roles', 'stats_cell_counts'] as const

/** Long statements report progress so the HTTP connection is never idle long enough to drop. */
const LONG = {
  send_progress_in_http_headers: 1,
  http_headers_progress_interval_ms: '10000',
  max_execution_time: 0,
  max_threads: 2,
} as const

const counted = new AnswerCache(1, 60_000)

/** When each counted patch was last counted (ms); none while the tables cannot be read. */
export function countedPatches(): Promise<Map<string, number>> {
  return counted.get('counted', async () => {
    const found = await rows(countedPatchesSql()).catch((error) => {
      logger.warn({ err: error }, 'stats cells unreadable: reading the games')
      return []
    })
    return new Map(found.map(([patch, at]) => [String(patch), Number(at) * 1000]))
  })
}

/** Whether `patch` is read from the counted cells. */
export async function isCounted(patch: string) {
  const done = await countedPatches()
  return done.has(patch)
}

const command = (query: string, params?: Record<string, unknown>) =>
  clickhouse.command({ query, query_params: params, clickhouse_settings: LONG })

/** Counts one patch's crawled games into the cells and swaps them in. */
export async function countPatch(patch: string) {
  if (!/^\d{1,2}\.\d{1,2}$/.test(patch)) throw new Error(`not a patch: ${patch}`)
  const partition = `'${patch}'`
  for (const table of TABLES) await command(`ALTER TABLE ${table}_next DROP PARTITION ${partition}`)
  const found = await rows(
    'SELECT DISTINCT platform FROM match_seed WHERE patch = {patch:String}',
    { patch }
  )
  for (const platform of found.map(([p]) => String(p))) {
    await command(`INSERT INTO stats_lane_pairs_next ${lanePairCellsSql()}`, {
      patch,
      platform,
      prefix: `${platform}_`,
    })
  }
  await command(`INSERT INTO stats_champion_roles_next ${roleCellsSql()}`, { patch })
  await command(`INSERT INTO stats_cell_counts_next ${cellCountsSql()}`, { patch })
  // The cell counts last: they mark the patch as counted.
  for (const table of TABLES) {
    await command(`ALTER TABLE ${table} REPLACE PARTITION ${partition} FROM ${table}_next`)
    await command(`ALTER TABLE ${table}_next DROP PARTITION ${partition}`)
  }
}

/**
 * Counts the patches that are due: never counted, or counted longer ago than their period. The
 * patch list is the patch menu's (`patches`), newest first.
 */
export async function countDuePatches(patches: string[]) {
  const done = await countedPatches()
  const counts: { patch: string; ms: number }[] = []
  for (const [i, patch] of patches.entries()) {
    const at = done.get(patch)
    const every = i < LIVE_PATCHES ? LIVE_EVERY_MS : OLD_EVERY_MS
    if (at && Date.now() - at < every) continue
    const started = Date.now()
    await countPatch(patch)
    counts.push({ patch, ms: Date.now() - started })
  }
  return counts
}

/** Counts the due patches now (after `delayMs`) and every ten minutes, one process at a time. */
export function startCellCounter(list: () => Promise<{ patch: string }[]>, delayMs = 30_000) {
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    let locked = false
    try {
      locked = (await redis.set(LOCK, '1', 'PX', LOCK_MS, 'NX')) === 'OK'
      if (!locked) return
      const patches = await list()
      const counts = await countDuePatches(patches.map((p) => p.patch))
      if (counts.length) logger.info({ counts }, 'stats cells counted')
    } catch (error) {
      logger.warn({ err: error }, 'stats cells count failed')
    } finally {
      if (locked) await redis.del(LOCK).catch(() => {})
      running = false
    }
  }
  setTimeout(tick, delayMs).unref()
  setInterval(tick, CHECK_MS).unref()
}
