import type { Position } from '#services/champion_stats'
import { RANKED_SOLO, round } from '#services/ranked_stats'
import {
  bump,
  delta,
  gate,
  placeTiers,
  seedTierJoinSql,
  tierIndex,
  topOf,
} from '#services/tier_lists'

/**
 * The duo tier list (`/tier-list/duos`), the pure half of `tier_lists_service.ts`: champions
 * played together on one team in two roles (bot and support, mid and jungle, top and jungle),
 * from each crawled game's lineup (`match_lineups`, as a champion's teammates are read), every
 * pair at once. A pair's synergy is its win rate together against what both champions win
 * overall in their role (`summary`).
 */

/** The lane pairs a duo can be, as the address names them. */
export const DUO_LANES = {
  bot: ['BOTTOM', 'UTILITY'],
  mid: ['MIDDLE', 'JUNGLE'],
  top: ['TOP', 'JUNGLE'],
} as const satisfies Record<string, readonly [Position, Position]>
export type DuoLane = keyof typeof DUO_LANES

export function duoLaneOf(value: unknown): DuoLane | null {
  const s = String(value ?? '').toLowerCase()
  return s in DUO_LANES ? (s as DuoLane) : null
}

/** A pair is listed from this share of the filter's games (and `MIN_PAIR_GAMES`). */
const PAIR_SHARE = 0.0003
const MIN_PAIR_GAMES = 30
/** A grid cell shows a win rate from this share of a listed pair's games. */
const CELL_SHARE = 0.4
/** A win rate is pulled toward the average by this many games before it is ranked. */
const PRIOR_GAMES = 1500
/** The grid's champions on each side. */
const GRID = 8

/**
 * Every pair of teammates in the duo roles of one patch's crawled games (`{patch:String}`), each
 * game read once: seed tier, first role, second role, first champion, second champion, games,
 * wins of their team. The lineups merged as read (`FINAL`), joined to each game's seed tier and
 * winner by game id, as the lane pair cells are counted. A row per seed tier: any bracket is a
 * sum of them, and a range of patches a sum of patches.
 */
export function duoRowsSql(region: string | null) {
  const pairs = Object.values(DUO_LANES)
    .map(([a, b]) => `(a.3 = '${a}' AND x.3 = '${b}')`)
    .join(' OR ')
  return `
    SELECT s.seed_tier AS tier, a.3 AS pa, b.3 AS pb, a.4 AS ca, b.4 AS cb, count(),
           sum(if(a.2 = 100, m.t1_win, m.t2_win))
    FROM (
      SELECT match_id, players FROM match_lineups FINAL WHERE patch = {patch:String}
    ) AS l
    ${seedTierJoinSql(region)}
    INNER JOIN (
      SELECT match_id, t1_win, t2_win FROM matches
      WHERE patch = {patch:String} AND queue_id = ${RANKED_SOLO}
    ) AS m USING (match_id)
    ARRAY JOIN l.players AS a
    ARRAY JOIN arrayFilter(x -> x.2 = a.2 AND (${pairs}), l.players) AS b
    GROUP BY tier, pa, pb, ca, cb
    SETTINGS join_algorithm = 'full_sorting_merge'
  `
}

/** One row of `duoRowsSql`: tier, first role, second role, champions, games, wins. */
export type DuoRow = [string, string, string, number, number, number, number]

/** One patch's pairs per seed tier (cached as they are): tier, lane pair, champion, champion, games, wins. */
export type DuoBlob = [number, number, number, number, number, number][]

const LANES = Object.keys(DUO_LANES) as DuoLane[]

export function duoBlob(rows: DuoRow[]): DuoBlob {
  const out: DuoBlob = []
  for (const [name, pa, pb, a, b, games, wins] of rows) {
    const t = tierIndex(name)
    const lane = LANES.findIndex((k) => DUO_LANES[k][0] === pa && DUO_LANES[k][1] === pb)
    if (t >= 0 && lane >= 0) out.push([t, lane, a, b, games, wins])
  }
  return out
}

/** The counts of a filter: per lane pair, champion, champion, games, wins. */
export type DuoCounts = Partial<Record<DuoLane, [number, number, number, number][]>>

/** A filter's pairs: its patches' blobs summed over the bracket's seed tiers. */
export function duoCounts(blobs: DuoBlob[], tiers: Set<number>): DuoCounts {
  const sums = new Map<string, [number, number, number, number, number]>()
  for (const blob of blobs) {
    for (const [t, lane, a, b, g, w] of blob) {
      if (!tiers.has(t)) continue
      const at = `${lane}:${a}:${b}`
      const r = sums.get(at) ?? [lane, a, b, 0, 0]
      r[3] += g
      r[4] += w
      sums.set(at, r)
    }
  }
  const out: DuoCounts = {}
  for (const [lane, a, b, g, w] of sums.values()) (out[LANES[lane]] ??= []).push([a, b, g, w])
  return out
}

/** A pair as the tier list shows it. */
export interface DuoTierRow {
  /** The champion in the first role (the bot, the mid, the top) and in the second. */
  a: number
  b: number
  games: number
  win: number
  /** Win rate together minus the average of both champions' win rates in their role. */
  synergy: number | null
  /** Each one's win rate in its role (every game, every partner); null when not in the summary. */
  aWin: number | null
  bWin: number | null
  /** Share of the first champion's duo games played with this partner. */
  share: number
  /** 0 S+ … 5 D among the listed pairs. */
  tier: number
  /** Change of the pair's win rate since the patch before; null without enough games. */
  delta: number | null
}

export interface DuoView {
  lane: DuoLane
  positions: readonly [Position, Position]
  /** Games of the pairs (one per team and game). */
  games: number
  rows: DuoTierRow[]
  /** The most played champions of each role and their win rate together (null: too few games). */
  grid: { a: number[]; b: number[]; cells: ({ win: number; games: number } | null)[][] }
  minGames: number
  minCellGames: number
}

/**
 * The pairs of one lane pair, ranked against each other. `roleWin` gives a champion's win rate in
 * a role (the filter's summary), for the synergy; `previous` is the patch before's counts.
 */
export function duoView(
  counts: DuoCounts,
  previous: DuoCounts | null,
  lane: DuoLane,
  roleWin: (champion: number, position: Position) => number | null
): DuoView {
  const positions = DUO_LANES[lane]
  const pairs = counts[lane] ?? []
  const was = new Map(
    (previous?.[lane] ?? []).map(([a, b, games, wins]) => [`${a}:${b}`, { games, wins }])
  )
  const games = pairs.reduce((n, p) => n + p[2], 0)
  const minGames = gate(games, PAIR_SHARE, MIN_PAIR_GAMES)
  const minCellGames = Math.max(10, Math.round(minGames * CELL_SHARE))
  const ofA = new Map<number, number>()
  const ofB = new Map<number, number>()
  for (const [a, b, g] of pairs) {
    bump(ofA, a, g)
    bump(ofB, b, g)
  }
  const listed = pairs
    .filter(([, , g]) => g >= minGames)
    .map(([a, b, g, w]) => ({ a, b, games: g, wins: w }))
  const tiers = placeTiers(listed, minGames, PRIOR_GAMES)
  const rows: DuoTierRow[] = [...tiers].map(([p, tier]) => {
    const aWin = roleWin(p.a, positions[0])
    const bWin = roleWin(p.b, positions[1])
    const win = round(p.wins / p.games)
    return {
      a: p.a,
      b: p.b,
      games: p.games,
      win,
      synergy: aWin !== null && bWin !== null ? round(win - (aWin + bWin) / 2) : null,
      aWin,
      bWin,
      share: round(p.games / (ofA.get(p.a) ?? p.games)),
      tier,
      delta: delta(p, was.get(`${p.a}:${p.b}`), minCellGames),
    }
  })
  rows.sort((x, y) => x.tier - y.tier || y.win - x.win)

  const byPair = new Map(pairs.map(([a, b, g, w]) => [`${a}:${b}`, [g, w]]))
  const gridA = topOf(ofA, GRID).map(([c]) => c)
  const gridB = topOf(ofB, GRID).map(([c]) => c)
  const cells = gridA.map((a) =>
    gridB.map((b) => {
      const [g, w] = byPair.get(`${a}:${b}`) ?? [0, 0]
      return g >= minCellGames ? { win: round(w / g), games: g } : null
    })
  )
  return {
    lane,
    positions,
    games,
    rows,
    grid: { a: gridA, b: gridB, cells },
    minGames,
    minCellGames,
  }
}
