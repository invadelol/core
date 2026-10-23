import logger from '@adonisjs/core/services/logger'
import buildStatsService from '#services/build_stats_service'
import championStatsService from '#services/champion_stats_service'
import runeStatsService from '#services/rune_stats_service'
import spellStatsService from '#services/spell_stats_service'
import { latestPatch } from '#services/ranked_games_service'
import type { Position, RoleStat } from '#services/champion_stats'
import type { Role } from '#services/ranked_stats'

/**
 * Answers the default champion pages before anyone asks: the champion list and tier list, and
 * the build and statistics tabs of every champion in its main role (default rank, newest patch,
 * every region).
 * Runs at start, when a new patch becomes the default, and every few hours; an answer already
 * fresh in the stats cache costs nothing, so a run mostly refreshes what went stale.
 */

const SERVICE_ROLE: Record<Position, Role> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MIDDLE: 'mid',
  BOTTOM: 'adc',
  UTILITY: 'support',
}

/** Champions warmed at once: a run never takes more than this share of ClickHouse. */
const CONCURRENCY = 2

export async function warmStats() {
  const filter = await championStatsService.filter({})
  if (!filter) return { champions: 0 }
  await championStatsService.patches()
  const summary = await championStatsService.summary(filter)
  await championStatsService.previous(filter)

  const main = new Map<number, RoleStat>()
  for (const r of summary.roles) {
    const best = main.get(r.champion)
    if (!best || r.games > best.games) main.set(r.champion, r)
  }
  const queue = [...main.values()]
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const role = SERVICE_ROLE[r.position]
      await Promise.all([
        buildStatsService.forRole(r.champion, role, filter.bracket, filter.patch),
        runeStatsService.forRole(r.champion, role, filter.bracket, filter.patch),
        spellStatsService.forRole(r.champion, role, filter.bracket, filter.patch),
        championStatsService.skills(filter, r.champion, r.position),
        championStatsService.matchups(filter, r.champion, r.position),
        championStatsService.byRank(filter, r.champion, r.position),
        championStatsService.trend(filter, r.champion, r.position),
        championStatsService.profile(filter, r.champion, r.position),
      ]).catch((error) =>
        logger.warn({ err: error, champion: r.champion }, 'stats warm-up of a champion failed')
      )
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return { champions: main.size }
}

/** How often the default patch is checked, and how often a run happens anyway. */
const CHECK_MS = 10 * 60_000
const EVERY_MS = 6 * 3600_000

/** Warms now (after `delayMs`), on every new default patch and every six hours. */
export function startStatsWarmer(delayMs = 60_000) {
  let running = false
  let lastPatch: string | null = null
  let lastRun = 0
  const tick = async () => {
    if (running) return
    const patch = await latestPatch().catch(() => null)
    if (!patch || (patch === lastPatch && Date.now() - lastRun < EVERY_MS)) return
    running = true
    const started = Date.now()
    try {
      const { champions } = await warmStats()
      lastPatch = patch
      lastRun = started
      logger.info({ patch, champions, ms: Date.now() - started }, 'stats warmed')
    } catch (error) {
      logger.warn({ err: error }, 'stats warm-up failed')
    } finally {
      running = false
    }
  }
  setTimeout(tick, delayMs).unref()
  setInterval(tick, CHECK_MS).unref()
}
