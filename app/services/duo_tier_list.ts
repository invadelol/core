import type { Position } from '#services/champion_stats'
import { RANKED_SOLO, round } from '#services/ranked_stats'
import {
  DUO_ROLES,
  duoLane,
  duoPositions,
  type DuoLane,
  type DuoRole,
} from '../../inertia/lib/duos.js'
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
 * played together on one team in any two roles (the ten pairs: bot and support, mid and jungle,
 * top and jungle, jungle and support…), from each crawled game's lineup (`match_lineups`, as a
 * champion's teammates are read), every pair at once. A pair's synergy is its win rate together
 * against what both champions win overall in their role (`summary`).
 */

export {
  DUO_ROLES,
  duoLaneOf,
  duoPositions,
  duoRoles,
  duoTitle,
  type DuoLane,
  type DuoRole,
} from '../../inertia/lib/duos.js'

/**
 * The ten pairs as each game's lineup is read, the first role first. The first three keep their
 * place (a stored patch's blob numbers its pairs in this order).
 */
const STORED: readonly (readonly [Position, Position])[] = [
  ['BOTTOM', 'UTILITY'],
  ['MIDDLE', 'JUNGLE'],
  ['TOP', 'JUNGLE'],
  ['JUNGLE', 'UTILITY'],
  ['MIDDLE', 'UTILITY'],
  ['TOP', 'UTILITY'],
  ['BOTTOM', 'JUNGLE'],
  ['TOP', 'MIDDLE'],
  ['TOP', 'BOTTOM'],
  ['MIDDLE', 'BOTTOM'],
]

/** Every duo, each pair once, as the filter lists them. */
export const DUO_LANES: DuoLane[] = STORED.map(([a, b]) => {
  const slug = (p: Position) =>
    (Object.keys(DUO_ROLES) as DuoRole[]).find((r) => DUO_ROLES[r] === p)!
  return duoLane(slug(a), slug(b))
})

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
  const pairs = STORED.map(([a, b]) => `(a.3 = '${a}' AND x.3 = '${b}')`).join(' OR ')
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

/**
 * One patch's pairs per seed tier (cached as they are): tier, pair (its place in the stored
 * order), champion in the first role, champion in the second, games, wins.
 */
export type DuoBlob = [number, number, number, number, number, number][]

export function duoBlob(rows: DuoRow[]): DuoBlob {
  const out: DuoBlob = []
  for (const [name, pa, pb, a, b, games, wins] of rows) {
    const t = tierIndex(name)
    const pair = STORED.findIndex(([x, y]) => x === pa && y === pb)
    if (t >= 0 && pair >= 0) out.push([t, pair, a, b, games, wins])
  }
  return out
}

/** The counts of a filter: per stored pair, champion, champion, games, wins. */
export type DuoCounts = Partial<Record<number, [number, number, number, number][]>>

/** A duo's pairs from the counts, its first role's champion first. */
function pairsOf(counts: DuoCounts | null, lane: DuoLane) {
  const [pa, pb] = duoPositions(lane)
  const straight = STORED.findIndex(([x, y]) => x === pa && y === pb)
  if (straight >= 0) return counts?.[straight] ?? []
  const flipped = STORED.findIndex(([x, y]) => x === pb && y === pa)
  return (counts?.[flipped] ?? []).map(
    ([a, b, g, w]) => [b, a, g, w] as [number, number, number, number]
  )
}

/** A filter's pairs: its patches' blobs summed over the bracket's seed tiers. */
export function duoCounts(blobs: DuoBlob[], tiers: Set<number>): DuoCounts {
  const sums = new Map<number, [number, number, number, number, number]>()
  for (const blob of blobs) {
    for (const row of blob) {
      if (!tiers.has(row[0])) continue
      const pair = row[1]
      const a = row[2]
      const b = row[3]
      // One exact number per pair and champions (champion ids fit in 16 bits, pairs in 4).
      const at = (pair * 65536 + a) * 65536 + b
      let r = sums.get(at)
      if (!r) sums.set(at, (r = [pair, a, b, 0, 0]))
      r[3] += row[4]
      r[4] += row[5]
    }
  }
  const out: DuoCounts = {}
  for (const [pair, a, b, g, w] of sums.values()) (out[pair] ??= []).push([a, b, g, w])
  return out
}

/** A pair as the tier list shows it. */
export interface DuoTierRow {
  /** The champion in the duo's first role (the bot, the mid, the top…) and in its second. */
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
  const positions = duoPositions(lane)
  const pairs = pairsOf(counts, lane)
  const was = new Map(
    pairsOf(previous, lane).map(([a, b, games, wins]) => [`${a}:${b}`, { games, wins }])
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
