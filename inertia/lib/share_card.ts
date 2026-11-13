/**
 * What the profile's share card can say, independent of how it is drawn: its sizes, the
 * statistics a player may put on it and how each reads. Pure, so it is unit tested.
 */

export type CardFormat = 'wide' | 'square' | 'story'

export interface FormatSpec {
  label: string
  width: number
  height: number
}

/** Wide fits link previews and X; square fits feeds; story fits a phone screen. */
export const FORMATS: Record<CardFormat, FormatSpec> = {
  wide: { label: 'Wide', width: 1200, height: 630 },
  square: { label: 'Square', width: 1080, height: 1080 },
  story: { label: 'Story', width: 1080, height: 1920 },
}

/** The queues a card may count, as the stats API names them. */
export const CARD_QUEUES = [
  { value: 'all', label: 'All queues', short: 'All' },
  { value: 'ranked', label: 'Solo/Duo', short: 'Solo/Duo' },
  { value: 'flex', label: 'Flex', short: 'Flex' },
  { value: 'normal', label: 'Normal', short: 'Normal' },
] as const

export type CardQueue = (typeof CARD_QUEUES)[number]['value']

/** How many recent games a card may count. */
export const CARD_COUNTS = [20, 30, 50, 100] as const

/** The figures the stats API answers for a window of games (`GlobalStats`). */
export interface CardFigures {
  winrate: number
  kda: number
  csMin: number
  killParticipation: number
  damagePerMinute: number
  damageShare: number
  visionMin: number
  goldPerMinute: number
  total: number
}

export interface CardRank {
  /** "Emerald II" */
  name: string
  /** Lowercase tier, for its colour. */
  tier: string
  lp: number
  queue: 'Solo/Duo' | 'Flex'
}

export interface CardData {
  figures: CardFigures | null
  /** The position played most in the window, e.g. "Mid", and its share of the games. */
  role: { name: string; share: number } | null
  rank: CardRank | null
}

export type StatKey =
  | 'winrate'
  | 'kda'
  | 'csMin'
  | 'killParticipation'
  | 'damagePerMinute'
  | 'damageShare'
  | 'visionMin'
  | 'goldPerMinute'
  | 'games'
  | 'role'
  | 'rank'

export interface Cell {
  key: StatKey
  value: string
  label: string
  /** A tier colour token's name (`--tier-gold`) when the value is a rank. */
  tone?: string
}

const percent = (x: number) => `${Math.round(x * 100)}%`

/** Every statistic the card offers, in the order they are drawn. */
export const STATS: ReadonlyArray<{
  key: StatKey
  label: string
  cell: (data: CardData) => Omit<Cell, 'key'> | null
}> = [
  {
    key: 'rank',
    label: 'Rank',
    cell: ({ rank }) =>
      rank && {
        value: rank.name,
        label: `${rank.queue}, ${rank.lp} LP`,
        tone: `--tier-${rank.tier}`,
      },
  },
  {
    key: 'winrate',
    label: 'Win rate',
    cell: ({ figures }) => figures && { value: percent(figures.winrate), label: 'Win rate' },
  },
  {
    key: 'kda',
    label: 'KDA',
    cell: ({ figures }) => figures && { value: figures.kda.toFixed(2), label: 'KDA' },
  },
  {
    key: 'csMin',
    label: 'CS per minute',
    cell: ({ figures }) => figures && { value: figures.csMin.toFixed(1), label: 'CS per minute' },
  },
  {
    key: 'killParticipation',
    label: 'Kill participation',
    cell: ({ figures }) =>
      figures && { value: percent(figures.killParticipation), label: 'Kill participation' },
  },
  {
    key: 'damagePerMinute',
    label: 'Damage per minute',
    cell: ({ figures }) =>
      figures && {
        value: Math.round(figures.damagePerMinute).toLocaleString('en-US'),
        label: 'Damage per minute',
      },
  },
  {
    key: 'damageShare',
    label: 'Damage share',
    cell: ({ figures }) =>
      figures && { value: percent(figures.damageShare), label: 'Damage share' },
  },
  {
    key: 'visionMin',
    label: 'Vision per minute',
    cell: ({ figures }) =>
      figures && { value: figures.visionMin.toFixed(2), label: 'Vision per minute' },
  },
  {
    key: 'goldPerMinute',
    label: 'Gold per minute',
    cell: ({ figures }) =>
      figures && { value: String(Math.round(figures.goldPerMinute)), label: 'Gold per minute' },
  },
  {
    key: 'games',
    label: 'Games',
    cell: ({ figures }) => figures && { value: String(figures.total), label: 'Games' },
  },
  {
    key: 'role',
    label: 'Main role',
    cell: ({ role }) =>
      role && { value: role.name, label: `Main role, ${Math.round(role.share * 100)}% of games` },
  },
]

/** At most this many statistics fit on a card in every format. */
export const MAX_STATS = 6

/** What the card used to show, and still shows when nothing is changed. */
export const DEFAULT_STATS: StatKey[] = ['winrate', 'kda', 'csMin']

/** The cells to draw: the chosen statistics that have data, in the card's order. */
export function cellsFor(data: CardData, chosen: ReadonlyArray<StatKey>): Cell[] {
  const cells: Cell[] = []
  for (const stat of STATS) {
    if (!chosen.includes(stat.key)) continue
    // An empty window has no figures worth printing: 0% and 0.00 would read as a real result.
    if (stat.key !== 'rank' && !data.figures?.total) continue
    const cell = stat.cell(data)
    if (cell) cells.push({ key: stat.key, ...cell })
    if (cells.length === MAX_STATS) break
  }
  return cells
}

/** How many columns the cells take: one row when they fit, else rows of three (two on a story). */
export function columnsFor(format: CardFormat, cells: number) {
  if (format === 'story') return Math.min(cells, 2)
  if (format === 'wide' && cells === 4) return 4
  return Math.min(cells, 3)
}

/** "Last 30 games, Solo/Duo": what the figures cover, printed above them. */
export function windowLabel(total: number, queue: CardQueue) {
  const games = total === 1 ? '1 game' : `${total} games`
  const name = CARD_QUEUES.find((q) => q.value === queue)?.label ?? 'All queues'
  return `Last ${games}, ${name === 'All queues' ? 'all queues' : name}`
}
