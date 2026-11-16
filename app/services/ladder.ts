/**
 * The ranked ladders' arithmetic, kept apart from where the rows come from so it can be checked
 * without a database: which entries are still on the apex ladder, the cutoffs, each player's
 * stored games summed up, their main role, and who is a one-trick.
 */

export const APEX_TIERS = ['CHALLENGER', 'GRANDMASTER', 'MASTER'] as const
export type ApexTier = (typeof APEX_TIERS)[number]

/** Lane order of every role list. */
export const LADDER_ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const
export type LadderRole = (typeof LADDER_ROLES)[number]

/** `?role=` of a ladder's address, to the stored position. */
export const ROLE_PARAM: Record<string, LadderRole> = {
  top: 'TOP',
  jungle: 'JUNGLE',
  mid: 'MIDDLE',
  middle: 'MIDDLE',
  bot: 'BOTTOM',
  adc: 'BOTTOM',
  bottom: 'BOTTOM',
  support: 'UTILITY',
  utility: 'UTILITY',
}

export const isApex = (tier: string): tier is ApexTier =>
  (APEX_TIERS as readonly string[]).includes(tier)

/** One player's newest league entry (`league_entries`, written by the crawler). */
export interface ApexEntry {
  puuid: string
  tier: ApexTier
  lp: number
  wins: number
  losses: number
  hotStreak: boolean
  veteran: boolean
  freshBlood: boolean
  inactive: boolean
  /** When this entry was read, in ms. */
  seenAt: number
}

/** The newest full read of a tier's league (every entry of one read shares its time). */
export interface TierRead {
  tier: ApexTier
  /** When it was read, in ms. */
  at: number
  /** Entries in that read. */
  entries: number
}

/**
 * The entries still on the ladder: an apex entry read in or after its tier's newest full read. A
 * player who left the tier (demoted, or decayed out) is missing from that read, so their entry is
 * older and drops out; a player promoted since has a newer entry in their new tier. Sorted the way
 * Riot ranks them: tier, then LP, then wins.
 */
export function currentApex(entries: ApexEntry[], reads: TierRead[]): ApexEntry[] {
  const since = new Map(reads.map((r) => [r.tier, r.at]))
  return entries
    .filter((e) => isApex(e.tier) && since.has(e.tier) && e.seenAt >= since.get(e.tier)!)
    .sort(
      (a, b) =>
        APEX_TIERS.indexOf(a.tier) - APEX_TIERS.indexOf(b.tier) ||
        b.lp - a.lp ||
        b.wins - a.wins ||
        (a.puuid < b.puuid ? -1 : 1)
    )
}

export interface Cutoff {
  tier: 'CHALLENGER' | 'GRANDMASTER'
  /** The LP of the last player in the tier: what it takes to be in it now. */
  lp: number | null
  /** Players in the tier. */
  players: number
  /** When the tier was read, in ms. */
  at: number | null
}

/** Challenger and Grandmaster cutoffs from the current ladder (sorted, `currentApex`). */
export function cutoffs(current: ApexEntry[], reads: TierRead[]): Cutoff[] {
  return (['CHALLENGER', 'GRANDMASTER'] as const).map((tier) => {
    const inTier = current.filter((e) => e.tier === tier)
    return {
      tier,
      lp: inTier.length ? Math.min(...inTier.map((e) => e.lp)) : null,
      players: inTier.length,
      at: reads.find((r) => r.tier === tier)?.at ?? null,
    }
  })
}

/** One row of the stored games of a player: one champion in one role. */
export interface GamesRow {
  puuid: string
  champion: number
  position: string
  games: number
  wins: number
  kills: number
  deaths: number
  assists: number
  /** Their newest game of it, in ms. */
  last: number
}

export interface ChampionGames {
  champion: number
  games: number
  wins: number
  kills: number
  deaths: number
  assists: number
  /** The role they play it in most. */
  position: string | null
  last: number
}

/** A player's stored ranked games of the window, summed up. */
export interface PlayerGames {
  games: number
  wins: number
  /** Their most played role, when they play one in at least a third of their laned games. */
  role: LadderRole | null
  /** Games per role. */
  roles: Partial<Record<LadderRole, number>>
  /** Most played first. */
  champions: ChampionGames[]
  last: number
}

/** The share of a player's laned games a role needs to be called their main. */
const MAIN_ROLE_SHARE = 1 / 3

/** Per-player summaries of `GamesRow`s. */
export function summarizePlayers(found: GamesRow[], keepChampions = 3): Map<string, PlayerGames> {
  const byPlayer = new Map<string, GamesRow[]>()
  for (const r of found) {
    const list = byPlayer.get(r.puuid) ?? []
    list.push(r)
    byPlayer.set(r.puuid, list)
  }
  const out = new Map<string, PlayerGames>()
  for (const [puuid, list] of byPlayer) {
    const roles: Partial<Record<LadderRole, number>> = {}
    const champions = new Map<number, ChampionGames & { byRole: Map<string, number> }>()
    let games = 0
    let wins = 0
    let last = 0
    for (const r of list) {
      games += r.games
      wins += r.wins
      last = Math.max(last, r.last)
      if ((LADDER_ROLES as readonly string[]).includes(r.position)) {
        const role = r.position as LadderRole
        roles[role] = (roles[role] ?? 0) + r.games
      }
      const c = champions.get(r.champion) ?? {
        champion: r.champion,
        games: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        position: null,
        last: 0,
        byRole: new Map<string, number>(),
      }
      c.games += r.games
      c.wins += r.wins
      c.kills += r.kills
      c.deaths += r.deaths
      c.assists += r.assists
      c.last = Math.max(c.last, r.last)
      if (r.position) c.byRole.set(r.position, (c.byRole.get(r.position) ?? 0) + r.games)
      champions.set(r.champion, c)
    }
    const laned = Object.values(roles).reduce((n, g) => n + (g ?? 0), 0)
    const [topRole, topGames] = (Object.entries(roles) as [LadderRole, number][]).sort(
      (a, b) => b[1] - a[1] || LADDER_ROLES.indexOf(a[0]) - LADDER_ROLES.indexOf(b[0])
    )[0] ?? [null, 0]
    out.set(puuid, {
      games,
      wins,
      role: topRole && laned && topGames / laned >= MAIN_ROLE_SHARE ? topRole : null,
      roles,
      champions: [...champions.values()]
        .sort((a, b) => b.games - a.games || b.last - a.last || a.champion - b.champion)
        .slice(0, keepChampions)
        .map(({ byRole, ...c }) => ({
          ...c,
          position: [...byRole].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
        })),
      last,
    })
  }
  return out
}

/** Each role's share of the players who have a main role, in lane order. */
export function roleShares(players: Iterable<PlayerGames | undefined>) {
  const counts = new Map<LadderRole, number>()
  let total = 0
  for (const p of players) {
    if (!p?.role) continue
    counts.set(p.role, (counts.get(p.role) ?? 0) + 1)
    total++
  }
  return LADDER_ROLES.map((role) => ({
    role,
    players: counts.get(role) ?? 0,
    share: total ? Math.round(((counts.get(role) ?? 0) / total) * 1000) / 1000 : 0,
  }))
}

/** What makes a one-trick, said once on the page. */
export interface OneTrickRule {
  /** Stored ranked games of the window, at least. */
  minGames: number
  /** Share of them on one champion, at least. */
  minShare: number
}

export const ONE_TRICK_RULE: OneTrickRule = { minGames: 20, minShare: 0.5 }

export interface OneTrick {
  champion: number
  position: string | null
  /** Games on it, and their share of all the player's games. */
  games: number
  share: number
  wins: number
  kda: number
  last: number
  /** Their second champion and its share, when they have one. */
  also: { champion: number; share: number } | null
}

const kdaOf = (c: { kills: number; deaths: number; assists: number }) =>
  Math.round(((c.kills + c.assists) / Math.max(1, c.deaths)) * 100) / 100

/** The champion a player one-tricks under `rule`, or null. */
export function oneTrickOf(player: PlayerGames, rule = ONE_TRICK_RULE): OneTrick | null {
  const [first, second] = player.champions
  if (!first || player.games < rule.minGames) return null
  const share = first.games / player.games
  if (share < rule.minShare) return null
  return {
    champion: first.champion,
    position: first.position,
    games: first.games,
    share: Math.round(share * 1000) / 1000,
    wins: first.wins,
    kda: kdaOf(first),
    last: first.last,
    also: second
      ? {
          champion: second.champion,
          share: Math.round((second.games / player.games) * 1000) / 1000,
        }
      : null,
  }
}

/** A page of a list: `page` from 1, clamped to the pages there are. */
export function pageOf<T>(list: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(list.length / size))
  const at = Math.min(Math.max(1, Math.trunc(page) || 1), pages)
  return { rows: list.slice((at - 1) * size, at * size), page: at, pages, total: list.length }
}

/**
 * A ladder's `?sort=` and `?dir=`: one of `keys` and its direction, or the ladder's own order
 * (`key` null) for anything else. `dir` is `desc` (most first) unless it says `asc`.
 */
export function sortParam<K extends string>(
  sort: unknown,
  dir: unknown,
  keys: readonly K[]
): { key: K | null; dir: 'asc' | 'desc' } {
  const asked = String(sort ?? '').toLowerCase()
  const key = (keys as readonly string[]).includes(asked) ? (asked as K) : null
  return { key, dir: String(dir ?? '').toLowerCase() === 'asc' ? 'asc' : 'desc' }
}

/**
 * A list sorted by `value` in `dir`, ties in the order they came (the ladder's), rows without a
 * value last either way.
 */
export function sortRows<T>(
  list: readonly T[],
  value: (row: T) => number | null | undefined,
  dir: 'asc' | 'desc'
): T[] {
  const sign = dir === 'asc' ? 1 : -1
  return list
    .map((row, i) => ({ row, i, v: value(row) }))
    .sort((a, b) => {
      const aNone = a.v === null || a.v === undefined || Number.isNaN(a.v)
      const bNone = b.v === null || b.v === undefined || Number.isNaN(b.v)
      if (aNone || bNone) return aNone === bNone ? a.i - b.i : aNone ? 1 : -1
      return sign * (a.v! - b.v!) || a.i - b.i
    })
    .map((x) => x.row)
}

/** A Riot ID name that matches a search (anything after `#` is left out of it). */
export function matchesName(gameName: string | null | undefined, q: string) {
  const term = q.trim().toLowerCase().replace(/#.*$/, '').trim()
  if (!term) return true
  return (gameName ?? '').toLowerCase().includes(term)
}
