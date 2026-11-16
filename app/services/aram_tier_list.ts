import type { Filter } from '#services/champion_stats'
import { platformSql, round } from '#services/ranked_stats'
import { bump, gate, placeTiers, topOf } from '#services/tier_lists'

/**
 * The ARAM tier list (`/tier-list/aram`), the pure half of `tier_lists_service.ts`: every
 * champion's record in the Howling Abyss games stored in our ClickHouse (`participants`), any
 * rank (ARAM has none), on the filter's patches and region.
 *
 * The crawler stores ranked solo games only: the ARAM games here are the ones stored when a
 * player's profile or the desktop app synced their history, so there are few of them. The view
 * says how many (`games`) and whether that is enough to rank anyone (`enough`).
 *
 * ARAM: Mayhem's augments are not stored (`participants` has no augment column); Riot's policy
 * would allow their pick rates only, never a win rate.
 */

/** The modes the address names, with their queue. */
export const ARAM_MODES = { aram: 450, mayhem: 2400 } as const
export type AramMode = keyof typeof ARAM_MODES

export function aramModeOf(value: unknown): AramMode {
  const s = String(value ?? '').toLowerCase()
  return s in ARAM_MODES ? (s as AramMode) : 'aram'
}

/** A champion is ranked from this share of the games (and `MIN_CHAMPION_GAMES`). */
const CHAMPION_SHARE = 0.005
const MIN_CHAMPION_GAMES = 30
/** Fewer stored games than this and the list is not worth reading (`enough`). */
export const MIN_ARAM_GAMES = 2000
const PRIOR_GAMES = 200

/**
 * Every champion's games of the mode on the filter's patches (`{patches:Array(String)}`,
 * `{queue:UInt16}`, `{patchStart:UInt64}`): kind, champion, keystone, its tree, games, wins,
 * kills, deaths, assists; and the games of the filter (`games`). A game stored twice counts once.
 * The columns read are all in `participants`' `by_champion` projection, which is sorted by queue.
 */
export function aramRowsSql(filter: Pick<Filter, 'region'>) {
  const where = platformSql(filter.region)
  const games = `SELECT match_id FROM matches
        WHERE queue_id = {queue:UInt16} AND patch IN {patches:Array(String)} ${where}`
  return `
    SELECT o.1, o.2, o.3, o.4, count(), sum(win), sum(kills), sum(deaths), sum(assists)
    FROM (
      SELECT champion_id, win, kills, deaths, assists, rune1, primary_style
      FROM participants
      WHERE queue_id = {queue:UInt16} AND game_start_ms >= {patchStart:UInt64}
        AND match_id IN (${games})
      LIMIT 1 BY match_id, champion_id
    )
    ARRAY JOIN [
      tuple('champion', champion_id, toUInt16(0), toUInt16(0)),
      tuple('keystone', champion_id, rune1, primary_style)
    ] AS o
    GROUP BY o.1, o.2, o.3, o.4
    UNION ALL
    SELECT 'games', toUInt16(0), toUInt16(0), toUInt16(0), uniqExact(match_id), 0, 0, 0, 0
    FROM (${games})
  `
}

/** One row of `aramRowsSql`. */
export type AramRow = [string, number, number, number, number, number, number, number, number]

/** The counts of one filter (cached as they are). */
export interface AramCounts {
  games: number
  /** Champion, games, wins, kills, deaths, assists. */
  champions: [number, number, number, number, number, number][]
  /** Champion, keystone, tree, games. */
  keystones: [number, number, number, number][]
}

export function aramCounts(rows: AramRow[]): AramCounts {
  const out: AramCounts = { games: 0, champions: [], keystones: [] }
  for (const [kind, champion, keystone, style, games, wins, kills, deaths, assists] of rows) {
    if (kind === 'games') out.games += games
    else if (kind === 'champion')
      out.champions.push([champion, games, wins, kills, deaths, assists])
    else if (kind === 'keystone' && keystone) out.keystones.push([champion, keystone, style, games])
  }
  return out
}

/** A champion as the ARAM tier list shows it. */
export interface AramTierRow {
  champion: number
  games: number
  win: number
  /** Share of the games it was in. */
  pick: number
  kda: number
  /** 0 S+ … 5 D; null under `minGames`. */
  tier: number | null
  /** Place among the ranked champions, from 1; null when not ranked. */
  rank: number | null
  /** Its most played keystone and that keystone's tree; null without runes stored. */
  keystone: { keystone: number; style: number; share: number } | null
}

export interface AramView {
  /** Games of the mode stored for the filter. */
  games: number
  /** Whether there are enough games to read the list (`MIN_ARAM_GAMES`). */
  enough: boolean
  rows: AramTierRow[]
  minGames: number
}

/** Every champion of the counts, ranked ones first (best first), then the others by games. */
export function aramView(counts: AramCounts): AramView {
  const minGames = gate(counts.games, CHAMPION_SHARE, MIN_CHAMPION_GAMES)
  const keystones = new Map<number, Map<string, number>>()
  for (const [champion, keystone, style, g] of counts.keystones) {
    const m = keystones.get(champion) ?? new Map<string, number>()
    bump(m, `${keystone}:${style}`, g)
    keystones.set(champion, m)
  }
  const list = counts.champions.map(([champion, games, wins, kills, deaths, assists]) => ({
    champion,
    games,
    wins,
    kills,
    deaths,
    assists,
  }))
  const tiers = placeTiers(list, minGames, PRIOR_GAMES)
  const order = [...tiers.keys()]
  const rows: AramTierRow[] = [
    ...order,
    ...list.filter((r) => !tiers.has(r)).sort((a, b) => b.games - a.games),
  ].map((r) => {
    const m = keystones.get(r.champion)
    const [best] = m ? topOf(m, 1) : []
    const total = m ? [...m.values()].reduce((n, g) => n + g, 0) : 0
    const [keystone, style] = best ? best[0].split(':').map(Number) : [0, 0]
    const at = order.indexOf(r)
    return {
      champion: r.champion,
      games: r.games,
      win: round(r.wins / r.games),
      pick: counts.games ? round(r.games / counts.games) : 0,
      kda: round((r.kills + r.assists) / Math.max(r.deaths, 1), 2),
      tier: tiers.get(r) ?? null,
      rank: at >= 0 ? at + 1 : null,
      keystone: best ? { keystone, style, share: round(best[1] / total) } : null,
    }
  })
  return { games: counts.games, enough: counts.games >= MIN_ARAM_GAMES, rows, minGames }
}
