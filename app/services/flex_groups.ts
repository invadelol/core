/**
 * Who queues with whom in ranked flex, read from stored games alone: two players on the same side
 * in `MIN_TOGETHER` or more of the stored games are a premade. A game's group is the player and
 * their premades on that side; its size is how they queued (solo, duo, three, five).
 */

/** Games on the same side that make two players a premade. */
export const MIN_TOGETHER = 3

export type GroupSize = 'solo' | 'duo' | 'three' | 'five'
export const GROUP_SIZES: GroupSize[] = ['solo', 'duo', 'three', 'five']

/** Flex queues one, two, three or five: four seen together is a five whose fifth was not seen. */
export const sizeOf = (players: number): GroupSize =>
  players <= 1 ? 'solo' : players === 2 ? 'duo' : players === 3 ? 'three' : 'five'

/** One player in one stored flex game. */
export interface SideRow {
  matchId: string
  teamId: number
  puuid: string
  win: boolean
}

export interface QueuesWith {
  size: GroupSize
  /** Their premades, most games together first (none when they play alone). */
  mates: { puuid: string; games: number; wins: number }[]
  /** Games with their first mate (all their games of that size when alone), and the wins. */
  games: number
  wins: number
  /** Share of their stored games those are. */
  share: number
}

export interface Group {
  /** Sorted. */
  members: string[]
  size: GroupSize
  games: number
  wins: number
}

export interface FlexGroups {
  /** How each listed player queues, by PUUID. */
  players: Map<string, QueuesWith & { total: number }>
  /** Groups of listed players seen together `minGames` or more, most wins first. */
  groups: Group[]
  /** Share of the listed players' games played at each size. */
  shares: Record<GroupSize, number>
}

/** Groups and queue habits of `listed` players, from every row of their stored flex games. */
export function flexGroups(sides: SideRow[], listed: Set<string>, minGames = 10): FlexGroups {
  const bySide = new Map<string, SideRow[]>()
  for (const r of sides) {
    const key = `${r.matchId}:${r.teamId}`
    const list = bySide.get(key) ?? []
    if (!list.some((x) => x.puuid === r.puuid)) list.push(r)
    bySide.set(key, list)
  }
  // Games on the same side, for every pair that includes a listed player.
  const together = new Map<string, Map<string, { games: number; wins: number }>>()
  for (const side of bySide.values()) {
    for (const a of side) {
      if (!listed.has(a.puuid)) continue
      const mates = together.get(a.puuid) ?? new Map()
      for (const b of side) {
        if (b === a) continue
        const t = mates.get(b.puuid) ?? { games: 0, wins: 0 }
        t.games++
        t.wins += a.win ? 1 : 0
        mates.set(b.puuid, t)
      }
      together.set(a.puuid, mates)
    }
  }
  const premade = (a: string, b: string) => (together.get(a)?.get(b)?.games ?? 0) >= MIN_TOGETHER

  const players = new Map<string, QueuesWith & { total: number }>()
  const sizes = new Map<string, Map<GroupSize, { games: number; wins: number }>>()
  const groups = new Map<string, Group>()
  const counted = { solo: 0, duo: 0, three: 0, five: 0 }
  let all = 0
  for (const side of bySide.values()) {
    for (const a of side) {
      if (!listed.has(a.puuid)) continue
      const group = side.filter((b) => b === a || premade(a.puuid, b.puuid))
      const size = sizeOf(group.length)
      const s = sizes.get(a.puuid) ?? new Map<GroupSize, { games: number; wins: number }>()
      const at = s.get(size) ?? { games: 0, wins: 0 }
      at.games++
      at.wins += a.win ? 1 : 0
      s.set(size, at)
      sizes.set(a.puuid, s)
      counted[size]++
      all++
      if (group.length > 1) {
        const members = group.map((g) => g.puuid).sort()
        const id = members.join(',')
        // One count per side: the first listed member of the group counts it.
        if (members.find((m) => listed.has(m)) === a.puuid) {
          const g = groups.get(id) ?? { members, size, games: 0, wins: 0 }
          g.games++
          g.wins += a.win ? 1 : 0
          groups.set(id, g)
        }
      }
    }
  }
  for (const [puuid, s] of sizes) {
    const total = [...s.values()].reduce((n, x) => n + x.games, 0)
    const [size] = [...s].sort(
      (a, b) => b[1].games - a[1].games || GROUP_SIZES.indexOf(a[0]) - GROUP_SIZES.indexOf(b[0])
    )[0]
    const mates = [...(together.get(puuid) ?? [])]
      .filter(([mate]) => premade(puuid, mate))
      .map(([mate, t]) => ({ puuid: mate, ...t }))
      .sort((a, b) => b.games - a.games || (a.puuid < b.puuid ? -1 : 1))
    const first = size === 'solo' ? null : mates[0]
    const games = first ? first.games : (s.get('solo')?.games ?? 0)
    players.set(puuid, {
      size,
      mates: size === 'solo' ? [] : mates,
      games,
      wins: first ? first.wins : (s.get('solo')?.wins ?? 0),
      share: total ? Math.round((games / total) * 1000) / 1000 : 0,
      total,
    })
  }
  const share = (n: number) => (all ? Math.round((n / all) * 1000) / 1000 : 0)
  return {
    players,
    groups: [...groups.values()]
      .filter((g) => g.games >= minGames)
      .sort((a, b) => b.wins / b.games - a.wins / a.games || b.games - a.games),
    shares: {
      solo: share(counted.solo),
      duo: share(counted.duo),
      three: share(counted.three),
      five: share(counted.five),
    },
  }
}
