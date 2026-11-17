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

/* ── The ledger card ─────────────────────────────────────────────
 * One statistic per line, in the order the player set: the label on the left, the figure on
 * the right, and a quiet aside after it (the LP after a rank, the record after a win rate).
 */

/** The ready cards the dialog offers. */
export type CardKind = 'stats' | 'ranked' | 'champion'

export const CARD_KINDS: ReadonlyArray<{ value: CardKind; label: string }> = [
  { value: 'stats', label: 'Last games' },
  { value: 'ranked', label: 'Ranked' },
  { value: 'champion', label: 'Champion' },
]

/** What a fresh ledger lists: the rank first, then the five figures people quote most. */
export const LEDGER_DEFAULT: StatKey[] = [
  'rank',
  'winrate',
  'kda',
  'killParticipation',
  'csMin',
  'damagePerMinute',
]

export interface Line {
  key: StatKey
  /** "Win rate" */
  label: string
  /** "57%" */
  value: string
  /** "17W 13L", "64 LP" */
  aside?: string
  /** A tier colour token (`--tier-emerald`) when the value is a rank. */
  tone?: string
  /** Lowercase tier, so the card can draw its emblem beside the rank. */
  tier?: string
}

/** The chosen statistics that have data, as ledger lines, in the player's order. */
export function linesFor(data: CardData, chosen: ReadonlyArray<StatKey>): Line[] {
  const lines: Line[] = []
  for (const key of chosen) {
    const stat = STATS.find((s) => s.key === key)
    if (!stat) continue
    if (key !== 'rank' && !data.figures?.total) continue
    const cell = stat.cell(data)
    if (!cell) continue
    const line: Line = { key, label: stat.label, value: cell.value, tone: cell.tone }
    if (key === 'rank' && data.rank) {
      line.aside = `${data.rank.lp} LP`
      line.tier = data.rank.tier
    }
    if (key === 'winrate' && data.figures) line.aside = record(data.figures.winrate, data.figures.total)
    if (key === 'role' && data.role) line.aside = `${Math.round(data.role.share * 100)}%`
    lines.push(line)
    if (lines.length === MAX_STATS) break
  }
  return lines
}

/** "17W 13L" from a win rate over a number of games. */
export function record(winrate: number, games: number) {
  const wins = Math.round(winrate * games)
  return `${wins}W ${games - wins}L`
}

/** The lines of a champion card: games, win rate with the record, KDA. */
export function championLines(c: { games: number; winrate: number; kda: number }): Line[] {
  return [
    { key: 'games', label: 'Games', value: String(c.games) },
    { key: 'winrate', label: 'Win rate', value: `${Math.round(c.winrate * 100)}%`, aside: record(c.winrate, c.games) },
    { key: 'kda', label: 'KDA', value: c.kda.toFixed(2) },
  ]
}
