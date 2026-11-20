import championStatsService from '#services/champion_stats_service'
import { RANKED_SOLO, seedTiers, platformSql } from '#services/ranked_stats'
import { rangeStart, rows, statsCache } from '#services/ranked_games_service'
import { seedGamesSql, type Filter, type Position, type RoleStat } from '#services/champion_stats'
import { areEventsCounted, countedPatches } from '#services/stats_cells'
import { newestOf } from '../../inertia/lib/patches.js'
import type { Metrics } from '../../inertia/lib/studio.js'

/**
 * The stats studio (`/stats`): every champion of a role (or of every role) ranked by one figure,
 * from the same crawled games as the champion pages. The champion list and its rates come from
 * the champion summary; the early game and first blood from the pre-counted cells; every other
 * figure (KDA, damage, farm, vision, objectives, pings, spells, game length) from one read of the
 * role's participant rows. Every answer is kept a day, like the champion pages'
 * (`stats_cache.ts`), and warmed for the default filters.
 */

/** The old explorer's views (`/stats?view=`), still answered as studio pages. */
export const VIEWS = [
  'overview',
  'table',
  'early',
  'length',
  'firstblood',
  'items',
  'regions',
  'patch',
] as const
export type View = (typeof VIEWS)[number]

/** Game length buckets, in minutes: [from, to). */
export const LENGTHS = [
  [0, 20],
  [20, 25],
  [25, 30],
  [30, 35],
  [35, 999],
] as const

/** A champion's figures need this many games in a bucket (a length, the games ahead at 10). */
const MIN_BUCKET = 30
/** A champion's early game or first blood figure needs this many games (as its rank does). */
const MIN_LANE = 100

const num = (v: unknown) => Number(v)
const key = (f: Filter, position: Position | null) =>
  `${f.patch}:${f.bracket}:${f.region ?? ''}:${position ?? 'ALL'}`
const cellsWhere = (f: Filter) => {
  const tiers = seedTiers(f.bracket)
  return `${tiers ? `AND seed_tier IN (${tiers})` : ''} ${platformSql(f.region).trimEnd()}`
}
const positionWhere = (position: Position | null, column = 'position') =>
  position ? `AND ${column} = {position:String}` : ''

/**
 * The win rate in games from `from` to `to` minutes (`LENGTHS`' bounds), from each bucket's
 * games and wins; null under 30 games.
 */
export function lengthWin(buckets: [number, number][], from: number, to: number) {
  let games = 0
  let wins = 0
  LENGTHS.forEach(([a, b], i) => {
    if (a >= from && b <= to) {
      games += buckets[i]?.[0] ?? 0
      wins += buckets[i]?.[1] ?? 0
    }
  })
  return games >= MIN_BUCKET ? round4(wins / games) : null
}

export interface Early {
  /** Games with a frame at 10 minutes, and at 15. */
  games: number
  games15: number
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

/** A champion of the studio's list: its record in the role, or in every role summed. */
export interface StudioRow {
  champion: number
  games: number
  win: number
  pick: number
  ban: number
  /** The role it is played in most (every role's list). */
  position: Position
  before: { win: number; pick: number; ban: number } | null
}

/**
 * The per-game sums of `studio()`, in the order the query returns them after the champion. Team
 * kills and team damage are the champion's team's, for its share of them.
 */
const SUMS = [
  'games',
  'wins',
  'kills',
  'deaths',
  'assists',
  'teamKills',
  'dmg',
  'teamDmg',
  'taken',
  'turret',
  'objective',
  'phys',
  'magic',
  'trueDmg',
  'cs',
  'jungle',
  'gold',
  'vision',
  'wards',
  'wardsKilled',
  'control',
  'pings',
  'missing',
  'omw',
  'getBack',
  'enemyVision',
  'allIn',
  'flash',
  'flashD',
  'secs',
  'dragons',
  'barons',
  'heralds',
  'towers',
  'inhibs',
] as const
type Sums = Record<(typeof SUMS)[number], number> & { buckets: [number, number][] }

const PING_COLUMNS = [
  'all_in_pings',
  'assist_pings',
  'command_pings',
  'danger_pings',
  'enemy_missing_pings',
  'enemy_vision_pings',
  'get_back_pings',
  'need_vision_pings',
  'on_my_way_pings',
  'push_pings',
  'vision_cleared_pings',
  'bait_pings',
  'hold_pings',
]
/** Riot's summoner spell id of Flash. */
const FLASH = 4

const side = (column: string) => `if(p.team_id = 100, m.t1_${column}, m.t2_${column})`

/** A champion's figures from its per-game sums (`SUMS`). */
function gameMetrics(s: Sums): Metrics {
  const g = Math.max(s.games, 1)
  const minutes = Math.max(s.secs / 60, 1)
  const mix = s.phys + s.magic + s.trueDmg
  const out: Metrics = {
    kda: round2((s.kills + s.assists) / Math.max(s.deaths, 1)),
    kills: round2(s.kills / g),
    deaths: round2(s.deaths / g),
    assists: round2(s.assists / g),
    kp: s.teamKills ? round4((s.kills + s.assists) / s.teamKills) : null,
    dmg: Math.round(s.dmg / g),
    dpm: Math.round(s.dmg / minutes),
    dmgShare: s.teamDmg ? round4(s.dmg / s.teamDmg) : null,
    taken: Math.round(s.taken / g),
    turret: Math.round(s.turret / g),
    objective: Math.round(s.objective / g),
    phys: mix ? round4(s.phys / mix) : null,
    magic: mix ? round4(s.magic / mix) : null,
    trueDmg: mix ? round4(s.trueDmg / mix) : null,
    csm: round2(s.cs / minutes),
    cs: round2(s.cs / g),
    jungle: round2(s.jungle / g),
    gpm: Math.round(s.gold / minutes),
    gold: Math.round(s.gold / g),
    vision: round2(s.vision / g),
    vpm: round2(s.vision / minutes),
    wards: round2(s.wards / g),
    wardsKilled: round2(s.wardsKilled / g),
    control: round2(s.control / g),
    length: Math.round(s.secs / g),
    under25: lengthWin(s.buckets, 0, 25),
    over25: lengthWin(s.buckets, 25, 999),
    pings: round2(s.pings / g),
    missing: round2(s.missing / g),
    omw: round2(s.omw / g),
    getBack: round2(s.getBack / g),
    enemyVision: round2(s.enemyVision / g),
    allIn: round2(s.allIn / g),
    flash: round4(s.flash / g),
    noFlash: round4(1 - s.flash / g),
    flashD: s.flash >= MIN_BUCKET ? round4(s.flashD / s.flash) : null,
    dragons: round2(s.dragons / g),
    barons: round2(s.barons / g),
    heralds: round2(s.heralds / g),
    towers: round2(s.towers / g),
    inhibs: round2(s.inhibs / g),
  }
  LENGTHS.forEach(([from, to], i) => {
    out[`len${i}` as 'len0'] = lengthWin(s.buckets, from, to)
  })
  return out
}

export class StatsExplorerService {
  #studio = statsCache('explorer-studio-v3', 48)
  #events = statsCache('explorer-events-v3', 48)

  /**
   * Each champion's per-game figures in the role (every role when `position` is null), and the
   * role's own (`all`): one read of the role's participant rows, joined to their games.
   */
  studio(
    f: Filter,
    position: Position | null
  ): Promise<{ champions: Record<number, Metrics>; all: Metrics }> {
    return this.#studio.get(key(f, position), async () => {
      const start = await rangeStart(f.patches)
      const buckets = LENGTHS.flatMap(([from, to]) => {
        const span = `m.duration_sec >= ${from * 60} AND m.duration_sec < ${to * 60}`
        return [`countIf(${span})`, `countIf(${span} AND p.win = 1)`]
      })
      const found = await rows(
        `SELECT p.champion_id, count(), sum(p.win),
                sum(p.kills), sum(p.deaths), sum(p.assists), sum(p.team_kills),
                sum(p.dmg_to_champ), sum(p.team_dmg), sum(p.dmg_taken), sum(p.dmg_to_turrets),
                sum(p.dmg_to_objectives), sum(p.physical_dmg_to_champ), sum(p.magic_dmg_to_champ),
                sum(p.true_dmg_to_champ), sum(p.total_cs), sum(p.neutral_minions_killed),
                sum(p.gold_earned), sum(p.vision_score), sum(p.wards_placed), sum(p.wards_killed),
                sum(p.vision_wards_bought), sum(p.pings), sum(p.enemy_missing_pings),
                sum(p.on_my_way_pings), sum(p.get_back_pings), sum(p.enemy_vision_pings),
                sum(p.all_in_pings),
                countIf(p.spell1 = ${FLASH} OR p.spell2 = ${FLASH}), countIf(p.spell1 = ${FLASH}),
                sum(m.duration_sec), sum(${side('dragons')}), sum(${side('barons')}),
                sum(${side('heralds')}), sum(${side('towers')}), sum(${side('inhibs')}),
                ${buckets.join(', ')}
         FROM (
           SELECT *,
                  sum(kills) OVER (PARTITION BY match_id, team_id) AS team_kills,
                  sum(dmg_to_champ) OVER (PARTITION BY match_id, team_id) AS team_dmg
           FROM (
             SELECT match_id, team_id, team_position, champion_id, win, kills, deaths, assists,
                    dmg_to_champ, dmg_taken, dmg_to_turrets, dmg_to_objectives,
                    physical_dmg_to_champ, magic_dmg_to_champ, true_dmg_to_champ, total_cs,
                    neutral_minions_killed, gold_earned, vision_score, wards_placed, wards_killed,
                    vision_wards_bought, ${PING_COLUMNS.join(' + ')} AS pings, enemy_missing_pings,
                    on_my_way_pings, get_back_pings, enemy_vision_pings, all_in_pings, spell1, spell2
             FROM participants
             WHERE queue_id = ${RANKED_SOLO} AND game_start_ms >= {patchStart:UInt64}
               AND match_id IN (${seedGamesSql(f)})
             LIMIT 1 BY match_id, champion_id
           )
         ) AS p
         INNER JOIN (
           SELECT match_id, any(duration_sec) AS duration_sec,
                  any(t1_dragons) AS t1_dragons, any(t2_dragons) AS t2_dragons,
                  any(t1_barons) AS t1_barons, any(t2_barons) AS t2_barons,
                  any(t1_heralds) AS t1_heralds, any(t2_heralds) AS t2_heralds,
                  any(t1_towers) AS t1_towers, any(t2_towers) AS t2_towers,
                  any(t1_inhibs) AS t1_inhibs, any(t2_inhibs) AS t2_inhibs
           FROM matches
           WHERE queue_id = ${RANKED_SOLO} AND patch IN {patches:Array(String)}
           GROUP BY match_id
         ) AS m USING (match_id)
         WHERE m.duration_sec >= 300 AND p.team_position != ''
           ${positionWhere(position, 'p.team_position')}
         GROUP BY p.champion_id`,
        { patches: f.patches, position, patchStart: start },
        { max_execution_time: 30, max_threads: 2 }
      )
      const total = emptySums()
      const champions: Record<number, Metrics> = {}
      for (const r of found) {
        const s = emptySums()
        SUMS.forEach((k, i) => (s[k] = num(r[i + 1])))
        s.buckets = LENGTHS.map((_, i) => [
          num(r[SUMS.length + 1 + i * 2]),
          num(r[SUMS.length + 2 + i * 2]),
        ])
        for (const k of SUMS) total[k] += s[k]
        s.buckets.forEach(([g, w], i) => {
          total.buckets[i][0] += g
          total.buckets[i][1] += w
        })
        champions[num(r[0])] = gameMetrics(s)
      }
      return { champions, all: gameMetrics(total) }
    })
  }

  /**
   * Each champion's early game and first blood in the role (every role when `position` is null),
   * from the counted cells (none until counted).
   */
  events(
    f: Filter,
    position: Position | null
  ): Promise<{ early: Record<number, Early>; firstBlood: Record<number, FirstBlood> }> {
    return this.#events.get(key(f, position), async () => {
      if (!(await areEventsCounted(f.patches))) return { early: {}, firstBlood: {} }
      const [early, fb] = await Promise.all([
        rows(
          `SELECT champion, minute, sum(games), sum(cs), sum(gold), sum(xp), sum(cs_diff),
                  sum(gold_diff), sum(xp_diff), sum(ahead), sum(ahead_wins)
           FROM stats_early
           WHERE patch IN {patches:Array(String)} ${positionWhere(position)} ${cellsWhere(f)}
           GROUP BY champion, minute`,
          { patches: f.patches, position }
        ),
        rows(
          `SELECT champion, sum(games), sum(kills), sum(assists), sum(victims), sum(involved_wins)
           FROM stats_first_blood
           WHERE patch IN {patches:Array(String)} ${positionWhere(position)} ${cellsWhere(f)}
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
          games15: 0,
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
          e.aheadWin = ahead >= MIN_BUCKET ? round4(aheadWins / ahead) : null
        } else if (minute === 15) {
          e.at15 = at
          e.games15 = g
        }
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
          involvedWin: involved >= MIN_BUCKET ? round4(involvedWins / involved) : null,
        }
      }
      return { early: out, firstBlood }
    })
  }

  /**
   * The lane figures of `events()` as the studio names them, per champion (each minute's from
   * `MIN_LANE` games at that minute), and the role's own (`all`: each figure weighted by the
   * champion's games).
   */
  async lane(
    f: Filter,
    position: Position | null
  ): Promise<{ champions: Record<number, Metrics>; all: Metrics }> {
    const { early, firstBlood } = await this.events(f, position)
    const champions: Record<number, Metrics> = {}
    const ids = new Set([...Object.keys(early), ...Object.keys(firstBlood)].map(Number))
    for (const c of ids) {
      const e = early[c]
      const b = firstBlood[c]
      champions[c] = {
        ...(e &&
          e.games >= MIN_LANE && {
            cs10: e.at10.cs,
            csd10: e.at10.csDiff,
            gd10: e.at10.goldDiff,
            xpd10: e.at10.xpDiff,
            ahead: e.ahead,
            aheadWin: e.aheadWin,
          }),
        ...(e &&
          e.games15 >= MIN_LANE && {
            cs15: e.at15.cs,
            csd15: e.at15.csDiff,
            gd15: e.at15.goldDiff,
            xpd15: e.at15.xpDiff,
          }),
        ...(b && b.games >= MIN_LANE && { fb: b.involved, fbKill: b.kill, fbVictim: b.victim }),
      }
    }
    const all: Metrics = {}
    const weigh = (
      keyOf: keyof Metrics & string,
      read: (c: number) => [value: number | null | undefined, games: number] | null
    ) => {
      let sum = 0
      let games = 0
      for (const c of ids) {
        const got = read(c)
        if (!got || got[0] === null || got[0] === undefined) continue
        sum += got[0] * got[1]
        games += got[1]
      }
      all[keyOf as 'gd10'] = games ? sum / games : null
    }
    for (const k of ['cs10', 'csd10', 'gd10', 'xpd10', 'ahead'] as const) {
      weigh(k, (c) => (early[c] ? [champions[c][k], early[c].games] : null))
    }
    for (const k of ['cs15', 'csd15', 'gd15', 'xpd15'] as const) {
      weigh(k, (c) => (early[c] ? [champions[c][k], early[c].games15] : null))
    }
    weigh('aheadWin', (c) =>
      early[c] ? [early[c].aheadWin, early[c].games * early[c].ahead] : null
    )
    for (const k of ['fb', 'fbKill', 'fbVictim'] as const) {
      weigh(k, (c) => (firstBlood[c] ? [champions[c][k], firstBlood[c].games] : null))
    }
    return { champions, all }
  }

  /** When the patch's cells were last counted (ms), or null; for a range, its newest patch's. */
  async updatedAt(patch: string) {
    const counted = await countedPatches()
    return counted.get(newestOf(patch)) ?? null
  }

  /**
   * The champions of the role (every role summed when `position` is null), with each one's rates
   * on the patch (or range) before.
   */
  async roleRows(f: Filter, position: Position | null) {
    const [summary, previous] = await Promise.all([
      championStatsService.summary(f),
      championStatsService.previous(f),
    ])
    return {
      summary,
      previousPatch: previous?.patch ?? null,
      rows: studioRows(summary.roles, previous?.roles ?? [], position),
    }
  }
}

/** A role's champions, or every role's summed per champion, with their rates before. */
export function studioRows(
  roles: readonly RoleStat[],
  before: readonly RoleStat[],
  position: Position | null
): StudioRow[] {
  const sum = (list: readonly RoleStat[]) => {
    const out = new Map<number, StudioRow & { wins: number; most: number }>()
    for (const r of list) {
      if (position && r.position !== position) continue
      const was = out.get(r.champion)
      if (!was) {
        out.set(r.champion, {
          champion: r.champion,
          games: r.games,
          wins: r.win * r.games,
          win: r.win,
          pick: r.pick,
          ban: r.ban,
          position: r.position,
          most: r.games,
          before: null,
        })
        continue
      }
      was.games += r.games
      was.wins += r.win * r.games
      was.pick += r.pick
      if (r.games > was.most) {
        was.most = r.games
        was.position = r.position
      }
    }
    for (const r of out.values()) {
      r.win = r.games ? round4(r.wins / r.games) : 0
      r.pick = round4(r.pick)
    }
    return out
  }
  const was = sum(before)
  return [...sum(roles).values()].map(({ wins: _wins, most: _most, ...r }) => {
    const b = was.get(r.champion)
    return { ...r, before: b ? { win: b.win, pick: b.pick, ban: b.ban } : null }
  })
}

function emptySums(): Sums {
  const s = Object.fromEntries(SUMS.map((k) => [k, 0])) as unknown as Sums
  s.buckets = LENGTHS.map(() => [0, 0])
  return s
}

const round1 = (x: number) => Math.round(x * 10) / 10
const round2 = (x: number) => Math.round(x * 100) / 100
const round4 = (x: number) => Math.round(x * 10000) / 10000

export default new StatsExplorerService()
