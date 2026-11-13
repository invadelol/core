import buildStatsService from '#services/build_stats_service'
import championStatsService from '#services/champion_stats_service'
import { RANKED_SOLO, REGIONS, platformSql, seedTiers } from '#services/ranked_stats'
import { rangeStart, rows, statsCache } from '#services/ranked_games_service'
import { seedGamesSql, type Filter, type Position, type RoleStat } from '#services/champion_stats'
import { areEventsCounted, countedPatches, isCounted } from '#services/stats_cells'
import { newestOf } from '../../inertia/lib/patches.js'

/**
 * The stats explorer (`/stats`): every champion of a role in one table, from the same crawled
 * games as the champion pages. The counts come from the pre-counted cells where they exist
 * (record, regions, early game, first blood: a sum of a few thousand rows); the averages of a game
 * (KDA, CS, damage, game length) from one read of the role's participant rows. Every answer is
 * kept a day, like the champion pages' (`stats_cache.ts`), and warmed for the default filters.
 */

export const VIEWS = [
  'overview',
  'early',
  'length',
  'firstblood',
  'items',
  'regions',
  'patch',
] as const
export type View = (typeof VIEWS)[number]

/** Game length buckets of the length view, in minutes: [from, to). */
export const LENGTHS = [
  [0, 20],
  [20, 25],
  [25, 30],
  [30, 35],
  [35, 999],
] as const

const num = (v: unknown) => Number(v)
const key = (f: Filter, position: Position) =>
  `${f.patch}:${f.bracket}:${f.region ?? ''}:${position}`
const cellsWhere = (f: Filter) => {
  const tiers = seedTiers(f.bracket)
  return `${tiers ? `AND seed_tier IN (${tiers})` : ''} ${platformSql(f.region).trimEnd()}`
}

export interface Averages {
  games: number
  kda: number
  csPerMin: number
  damage: number
  gold: number
  vision: number
  /** Seconds. */
  length: number
  /** Win rate by `LENGTHS` bucket, null under 30 games. */
  byLength: (number | null)[]
}

export interface Early {
  games: number
  /** At 10 and 15 minutes: the champion's averages and its gaps to the lane opponent. */
  at10: { cs: number; gold: number; xp: number; csDiff: number; goldDiff: number; xpDiff: number }
  at15: { cs: number; gold: number; xp: number; csDiff: number; goldDiff: number; xpDiff: number }
  /** Share of games ahead in gold at 10, and the win rate of those games. */
  ahead: number
  aheadWin: number | null
}

export interface FirstBlood {
  games: number
  kill: number
  assist: number
  victim: number
  /** Killer or assist. */
  involved: number
  involvedWin: number | null
}

export class StatsExplorerService {
  #averages = statsCache('explorer-averages', 32)
  #events = statsCache('explorer-events', 32)
  #regions = statsCache('explorer-regions', 32)
  #items = statsCache('explorer-items', 32)

  /** Each champion's averages in the role: KDA, CS a minute, damage, gold, vision, length. */
  averages(f: Filter, position: Position): Promise<Record<number, Averages>> {
    return this.#averages.get(key(f, position), async () => {
      const start = await rangeStart(f.patches)
      const found = await rows(
        `SELECT p.champion_id, intDiv(m.duration_sec, 60) AS minutes, count(), sum(p.win),
                sum(p.kills), sum(p.deaths), sum(p.assists), sum(p.total_cs), sum(p.gold_earned),
                sum(p.dmg_to_champ), sum(p.vision_score), sum(m.duration_sec)
         FROM (
           SELECT match_id, champion_id, win, kills, deaths, assists, total_cs, gold_earned,
                  dmg_to_champ, vision_score
           FROM participants
           WHERE queue_id = ${RANKED_SOLO} AND team_position = {position:String}
             AND game_start_ms >= {patchStart:UInt64}
             AND match_id IN (${seedGamesSql(f)})
           LIMIT 1 BY match_id, champion_id
         ) AS p
         INNER JOIN (
           SELECT match_id, any(duration_sec) AS duration_sec FROM matches
           WHERE queue_id = ${RANKED_SOLO} AND patch IN {patches:Array(String)}
           GROUP BY match_id
         ) AS m USING (match_id)
         WHERE m.duration_sec >= 300
         GROUP BY p.champion_id, minutes`,
        { patches: f.patches, position, patchStart: start },
        { max_execution_time: 30, max_threads: 2 }
      )
      const sums = new Map<number, number[]>()
      const buckets = new Map<number, number[][]>()
      for (const r of found) {
        const [c, minutes, g, w, k, d, a, cs, gold, dmg, vis, secs] = r.map(num)
        const s = sums.get(c) ?? new Array(10).fill(0)
        ;[g, w, k, d, a, cs, gold, dmg, vis, secs].forEach((v, i) => (s[i] += v))
        sums.set(c, s)
        const b = buckets.get(c) ?? LENGTHS.map(() => [0, 0])
        const at = LENGTHS.findIndex(([from, to]) => minutes >= from && minutes < to)
        if (at >= 0) {
          b[at][0] += g
          b[at][1] += w
        }
        buckets.set(c, b)
      }
      const out: Record<number, Averages> = {}
      for (const [c, [g, , k, d, a, cs, gold, dmg, vis, secs]] of sums) {
        out[c] = {
          games: g,
          kda: round2((k + a) / Math.max(d, 1)),
          csPerMin: round2(cs / Math.max(secs / 60, 1)),
          damage: Math.round(dmg / g),
          gold: Math.round(gold / g),
          vision: round2(vis / g),
          length: Math.round(secs / g),
          byLength: buckets.get(c)!.map(([bg, bw]) => (bg >= 30 ? round4(bw / bg) : null)),
        }
      }
      return out
    })
  }

  /** Each champion's early game and first blood in the role, from the counted cells (none until counted). */
  events(
    f: Filter,
    position: Position
  ): Promise<{ early: Record<number, Early>; firstBlood: Record<number, FirstBlood> }> {
    return this.#events.get(key(f, position), async () => {
      if (!(await areEventsCounted(f.patches))) return { early: {}, firstBlood: {} }
      const [early, fb] = await Promise.all([
        rows(
          `SELECT champion, minute, sum(games), sum(cs), sum(gold), sum(xp), sum(cs_diff),
                  sum(gold_diff), sum(xp_diff), sum(ahead), sum(ahead_wins)
           FROM stats_early
           WHERE patch IN {patches:Array(String)} AND position = {position:String} ${cellsWhere(f)}
           GROUP BY champion, minute`,
          { patches: f.patches, position }
        ),
        rows(
          `SELECT champion, sum(games), sum(kills), sum(assists), sum(victims), sum(involved_wins)
           FROM stats_first_blood
           WHERE patch IN {patches:Array(String)} AND position = {position:String} ${cellsWhere(f)}
           GROUP BY champion`,
          { patches: f.patches, position }
        ),
      ])
      const out: Record<number, Early> = {}
      for (const r of early) {
        const [c, minute, g, cs, gold, xp, csd, goldd, xpd, ahead, aheadWins] = r.map(num)
        if (!g) continue
        const e = (out[c] ??= {
          games: 0,
          at10: { cs: 0, gold: 0, xp: 0, csDiff: 0, goldDiff: 0, xpDiff: 0 },
          at15: { cs: 0, gold: 0, xp: 0, csDiff: 0, goldDiff: 0, xpDiff: 0 },
          ahead: 0,
          aheadWin: null,
        })
        const at = {
          cs: round1(cs / g),
          gold: Math.round(gold / g),
          xp: Math.round(xp / g),
          csDiff: round1(csd / g),
          goldDiff: Math.round(goldd / g),
          xpDiff: Math.round(xpd / g),
        }
        if (minute === 10) {
          e.at10 = at
          e.games = g
          e.ahead = round4(ahead / g)
          e.aheadWin = ahead >= 30 ? round4(aheadWins / ahead) : null
        } else if (minute === 15) e.at15 = at
      }
      const firstBlood: Record<number, FirstBlood> = {}
      for (const r of fb) {
        const [c, g, kills, assists, victims, involvedWins] = r.map(num)
        if (!g) continue
        const involved = kills + assists
        firstBlood[c] = {
          games: g,
          kill: round4(kills / g),
          assist: round4(assists / g),
          victim: round4(victims / g),
          involved: round4(involved / g),
          involvedWin: involved >= 30 ? round4(involvedWins / involved) : null,
        }
      }
      return { early: out, firstBlood }
    })
  }

  /** Each champion's games and wins in the role by region (`REGIONS`). */
  regions(
    f: Filter,
    position: Position
  ): Promise<Record<number, Record<string, [number, number]>>> {
    return this.#regions.get(key({ ...f, region: null }, position), async () => {
      const cells = await isCounted(f.patches)
      const tiers = seedTiers(f.bracket)
      const found = cells
        ? await rows(
            `SELECT champion, platform, sum(games), sum(wins) FROM stats_champion_roles
             WHERE patch IN {patches:Array(String)} AND position = {position:String}
               ${tiers ? `AND seed_tier IN (${tiers})` : ''}
             GROUP BY champion, platform`,
            { patches: f.patches, position }
          )
        : await rows(
            `SELECT p.champion_id, s.platform, count(), sum(p.win)
             FROM (
               SELECT match_id, champion_id, win FROM participant_items FINAL
               WHERE patch IN {patches:Array(String)} AND queue_id = ${RANKED_SOLO}
                 AND team_position = {position:String}
             ) AS p
             INNER JOIN (
               SELECT match_id, any(platform) AS platform FROM match_seed
               WHERE patch IN {patches:Array(String)} ${tiers ? `AND seed_tier IN (${tiers})` : ''}
               GROUP BY match_id
             ) AS s USING (match_id)
             GROUP BY p.champion_id, s.platform`,
            { patches: f.patches, position }
          )
      const regionOf = new Map(
        Object.entries(REGIONS).flatMap(([r, def]) => def.platforms.map((p) => [p, r]))
      )
      const out: Record<number, Record<string, [number, number]>> = {}
      for (const [c, platform, g, w] of found) {
        const region = regionOf.get(String(platform))
        if (!region) continue
        const byRegion = (out[num(c)] ??= {})
        const was = byRegion[region] ?? [0, 0]
        byRegion[region] = [was[0] + num(g), was[1] + num(w)]
      }
      return out
    })
  }

  /** Finished items bought in the role's games: games bought in and wins, most bought first. */
  items(f: Filter, position: Position) {
    return this.#items.get(key(f, position), async () => {
      const kinds = await buildStatsService.kinds(f.patches[0])
      const finished = new Set([...kinds.legendary, ...kinds.boots])
      const found = await rows(
        `SELECT i, count(), sum(win) FROM (
           SELECT match_id, win, purchases FROM participant_items FINAL
           WHERE patch IN {patches:Array(String)} AND queue_id = ${RANKED_SOLO}
             AND team_position = {position:String} AND match_id IN (${seedGamesSql(f)})
         )
         ARRAY JOIN arrayDistinct(purchases) AS i
         GROUP BY i`,
        { patches: f.patches, position },
        { max_execution_time: 30, max_threads: 2 }
      )
      return found
        .map(([i, g, w]) => ({ item: num(i), games: num(g), wins: num(w) }))
        .filter((r) => finished.has(r.item))
        .sort((a, b) => b.games - a.games)
    })
  }

  /** When the patch's cells were last counted (ms), or null; for a range, its newest patch's. */
  async updatedAt(patch: string) {
    const counted = await countedPatches()
    return counted.get(newestOf(patch)) ?? null
  }

  /** The role's champions of the summary, with each one's place on the patch (or range) before. */
  async roleRows(f: Filter, position: Position) {
    const [summary, previous] = await Promise.all([
      championStatsService.summary(f),
      championStatsService.previous(f),
    ])
    const before = new Map<number, RoleStat>()
    for (const r of previous?.roles ?? []) if (r.position === position) before.set(r.champion, r)
    return {
      summary,
      previousPatch: previous?.patch ?? null,
      rows: summary.roles
        .filter((r) => r.position === position)
        .map((r) => {
          const was = before.get(r.champion)
          return {
            champion: r.champion,
            games: r.games,
            win: r.win,
            pick: r.pick,
            ban: r.ban,
            roleShare: r.roleShare,
            tier: r.tier,
            rank: r.rank,
            before: was ? { win: was.win, pick: was.pick, ban: was.ban, rank: was.rank } : null,
          }
        }),
    }
  }
}

const round1 = (x: number) => Math.round(x * 10) / 10
const round2 = (x: number) => Math.round(x * 100) / 100
const round4 = (x: number) => Math.round(x * 10000) / 10000

export default new StatsExplorerService()
