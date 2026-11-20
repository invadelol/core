import type { IconName } from './icons.js'
import { thousands } from './tier_lists.js'

/**
 * The stats studio (`/stats`): every statistic the crawled games give, one page each
 * (`/stats/<slug>`), grouped in categories. Shared by the controller (titles, addresses, the
 * old `?view=` links) and the page (columns, formats, bars).
 *
 * A figure is a champion's in the role (or in every role) on the filter's games:
 * - `role`: the champion list itself (games, win, pick and ban rates, the change since the patch before);
 * - `game`: one read of the role's participant rows, averaged per game or per minute;
 * - `lane`: the early game and first blood cells (gaps to the lane opponent at 10 and 15 minutes).
 */

export type MetricKey =
  | 'games'
  | 'win'
  | 'pick'
  | 'ban'
  | 'change'
  | 'kda'
  | 'kills'
  | 'deaths'
  | 'assists'
  | 'kp'
  | 'dmg'
  | 'dpm'
  | 'dmgShare'
  | 'taken'
  | 'turret'
  | 'objective'
  | 'phys'
  | 'magic'
  | 'trueDmg'
  | 'csm'
  | 'cs'
  | 'jungle'
  | 'gpm'
  | 'gold'
  | 'cs10'
  | 'cs15'
  | 'csd10'
  | 'csd15'
  | 'gd10'
  | 'gd15'
  | 'xpd10'
  | 'xpd15'
  | 'ahead'
  | 'aheadWin'
  | 'fb'
  | 'fbKill'
  | 'fbVictim'
  | 'dragons'
  | 'barons'
  | 'heralds'
  | 'towers'
  | 'inhibs'
  | 'vision'
  | 'vpm'
  | 'wards'
  | 'wardsKilled'
  | 'control'
  | 'length'
  | 'under25'
  | 'over25'
  | 'len0'
  | 'len1'
  | 'len2'
  | 'len3'
  | 'len4'
  | 'pings'
  | 'missing'
  | 'omw'
  | 'getBack'
  | 'enemyVision'
  | 'allIn'
  | 'flash'
  | 'noFlash'
  | 'flashD'

/** A champion's figures, by key; null when too few games say it. */
export type Metrics = Partial<Record<MetricKey, number | null>>

export type Fmt = 'pct2' | 'pct1' | 'n2' | 'n1' | 'int' | 'sgn0' | 'sgn1' | 'pts' | 'time'

/** Where a figure comes from: the champion list, the games' rows, or the early game cells. */
export type Source = 'role' | 'game' | 'lane'

export interface MetricDef {
  /** The column head. */
  col: string
  fmt: Fmt
  source: Source
  /** A longer name, shown on hover over the head. */
  title?: string
  /** A gap that can be negative: its bar starts from the middle. */
  signed?: boolean
}

export const METRICS: Record<MetricKey, MetricDef> = {
  games: { col: 'Games', fmt: 'int', source: 'role' },
  win: { col: 'Win rate', fmt: 'pct2', source: 'role' },
  pick: { col: 'Pick rate', fmt: 'pct1', source: 'role' },
  ban: { col: 'Ban rate', fmt: 'pct1', source: 'role' },
  change: {
    col: 'Change',
    fmt: 'pts',
    source: 'role',
    title: 'Win rate change since the patch before, in points',
    signed: true,
  },
  kda: { col: 'KDA', fmt: 'n2', source: 'game' },
  kills: { col: 'Kills', fmt: 'n1', source: 'game' },
  deaths: { col: 'Deaths', fmt: 'n1', source: 'game' },
  assists: { col: 'Assists', fmt: 'n1', source: 'game' },
  kp: { col: 'Kill part.', fmt: 'pct1', source: 'game', title: 'Kill participation' },
  dmg: { col: 'Damage', fmt: 'int', source: 'game', title: 'Damage to champions per game' },
  dpm: { col: 'Per minute', fmt: 'int', source: 'game', title: 'Damage to champions per minute' },
  dmgShare: {
    col: 'Team share',
    fmt: 'pct1',
    source: 'game',
    title: "Share of the team's damage to champions",
  },
  taken: { col: 'Taken', fmt: 'int', source: 'game', title: 'Damage taken per game' },
  turret: { col: 'Turrets', fmt: 'int', source: 'game', title: 'Damage to turrets per game' },
  objective: {
    col: 'Objectives',
    fmt: 'int',
    source: 'game',
    title: 'Damage to objectives per game',
  },
  phys: {
    col: 'Physical',
    fmt: 'pct1',
    source: 'game',
    title: 'Physical share of the damage to champions',
  },
  magic: {
    col: 'Magic',
    fmt: 'pct1',
    source: 'game',
    title: 'Magic share of the damage to champions',
  },
  trueDmg: {
    col: 'True',
    fmt: 'pct1',
    source: 'game',
    title: 'True share of the damage to champions',
  },
  csm: { col: 'CS/min', fmt: 'n2', source: 'game', title: 'CS per minute' },
  cs: { col: 'CS', fmt: 'n1', source: 'game', title: 'CS per game' },
  jungle: { col: 'Monsters', fmt: 'n1', source: 'game', title: 'Jungle monsters killed per game' },
  gpm: { col: 'Gold/min', fmt: 'int', source: 'game', title: 'Gold per minute' },
  gold: { col: 'Gold', fmt: 'int', source: 'game', title: 'Gold per game' },
  cs10: { col: 'CS at 10', fmt: 'n1', source: 'lane' },
  cs15: { col: 'CS at 15', fmt: 'n1', source: 'lane' },
  csd10: {
    col: 'CS lead 10',
    fmt: 'sgn1',
    source: 'lane',
    title: 'CS against the lane opponent at 10 minutes',
    signed: true,
  },
  csd15: {
    col: 'CS lead 15',
    fmt: 'sgn1',
    source: 'lane',
    title: 'CS against the lane opponent at 15 minutes',
    signed: true,
  },
  gd10: {
    col: 'Gold lead 10',
    fmt: 'sgn0',
    source: 'lane',
    title: 'Gold against the lane opponent at 10 minutes',
    signed: true,
  },
  gd15: {
    col: 'Gold lead 15',
    fmt: 'sgn0',
    source: 'lane',
    title: 'Gold against the lane opponent at 15 minutes',
    signed: true,
  },
  xpd10: {
    col: 'XP lead 10',
    fmt: 'sgn0',
    source: 'lane',
    title: 'Experience against the lane opponent at 10 minutes',
    signed: true,
  },
  xpd15: {
    col: 'XP lead 15',
    fmt: 'sgn0',
    source: 'lane',
    title: 'Experience against the lane opponent at 15 minutes',
    signed: true,
  },
  ahead: {
    col: 'Ahead at 10',
    fmt: 'pct1',
    source: 'lane',
    title: 'Games ahead in gold at 10 minutes',
  },
  aheadWin: {
    col: 'Wins ahead',
    fmt: 'pct1',
    source: 'lane',
    title: 'Win rate of the games ahead in gold at 10 minutes',
  },
  fb: {
    col: 'First blood',
    fmt: 'pct1',
    source: 'lane',
    title: 'Games it took or helped take first blood',
  },
  fbKill: {
    col: 'Took it',
    fmt: 'pct1',
    source: 'lane',
    title: 'Games it took first blood itself',
  },
  fbVictim: { col: 'Gave it', fmt: 'pct1', source: 'lane', title: 'Games it was first blood' },
  dragons: {
    col: 'Dragons',
    fmt: 'n2',
    source: 'game',
    title: "Dragons taken by the champion's team per game",
  },
  barons: {
    col: 'Barons',
    fmt: 'n2',
    source: 'game',
    title: "Barons taken by the champion's team per game",
  },
  heralds: {
    col: 'Heralds',
    fmt: 'n2',
    source: 'game',
    title: "Rift Heralds taken by the champion's team per game",
  },
  towers: {
    col: 'Towers',
    fmt: 'n1',
    source: 'game',
    title: "Towers taken by the champion's team per game",
  },
  inhibs: {
    col: 'Inhibitors',
    fmt: 'n2',
    source: 'game',
    title: "Inhibitors taken by the champion's team per game",
  },
  vision: { col: 'Vision', fmt: 'n1', source: 'game', title: 'Vision score per game' },
  vpm: { col: 'Vision/min', fmt: 'n2', source: 'game', title: 'Vision score per minute' },
  wards: { col: 'Wards', fmt: 'n1', source: 'game', title: 'Wards placed per game' },
  wardsKilled: { col: 'Cleared', fmt: 'n1', source: 'game', title: 'Wards cleared per game' },
  control: { col: 'Control', fmt: 'n1', source: 'game', title: 'Control wards bought per game' },
  length: { col: 'Length', fmt: 'time', source: 'game', title: 'Average game length' },
  under25: {
    col: 'Under 25',
    fmt: 'pct1',
    source: 'game',
    title: 'Win rate in games under 25 minutes',
  },
  over25: {
    col: 'Over 25',
    fmt: 'pct1',
    source: 'game',
    title: 'Win rate in games over 25 minutes',
  },
  len0: {
    col: 'Under 20',
    fmt: 'pct1',
    source: 'game',
    title: 'Win rate in games under 20 minutes',
  },
  len1: {
    col: '20–25',
    fmt: 'pct1',
    source: 'game',
    title: 'Win rate in games of 20 to 25 minutes',
  },
  len2: {
    col: '25–30',
    fmt: 'pct1',
    source: 'game',
    title: 'Win rate in games of 25 to 30 minutes',
  },
  len3: {
    col: '30–35',
    fmt: 'pct1',
    source: 'game',
    title: 'Win rate in games of 30 to 35 minutes',
  },
  len4: { col: '35+', fmt: 'pct1', source: 'game', title: 'Win rate in games over 35 minutes' },
  pings: { col: 'Pings', fmt: 'n1', source: 'game', title: 'Pings of every kind per game' },
  missing: { col: 'Missing', fmt: 'n2', source: 'game', title: 'Enemy missing pings per game' },
  omw: { col: 'On my way', fmt: 'n2', source: 'game', title: 'On my way pings per game' },
  getBack: { col: 'Retreat', fmt: 'n2', source: 'game', title: 'Retreat pings per game' },
  enemyVision: {
    col: 'Enemy vision',
    fmt: 'n2',
    source: 'game',
    title: 'Enemy vision pings per game',
  },
  allIn: { col: 'All in', fmt: 'n2', source: 'game', title: 'All in pings per game' },
  flash: { col: 'Flash', fmt: 'pct1', source: 'game', title: 'Games with Flash' },
  noFlash: { col: 'No Flash', fmt: 'pct1', source: 'game', title: 'Games without Flash' },
  flashD: {
    col: 'On D',
    fmt: 'pct1',
    source: 'game',
    title: 'Flash on D, of the games with Flash',
  },
}

export type CategoryKey =
  | 'results'
  | 'combat'
  | 'damage'
  | 'laning'
  | 'objectives'
  | 'vision'
  | 'length'
  | 'pings'
  | 'spells'

export const CATEGORIES: { key: CategoryKey; label: string; icon: IconName }[] = [
  { key: 'results', label: 'Results', icon: 'trophy' },
  { key: 'combat', label: 'Combat', icon: 'swords' },
  { key: 'damage', label: 'Damage', icon: 'spark' },
  { key: 'laning', label: 'Laning and farm', icon: 'target' },
  { key: 'objectives', label: 'Objectives', icon: 'flag' },
  { key: 'vision', label: 'Vision', icon: 'eye' },
  { key: 'length', label: 'Game length', icon: 'clock' },
  { key: 'pings', label: 'Pings', icon: 'chat' },
  { key: 'spells', label: 'Summoner spells', icon: 'flame' },
]

export interface StatDef {
  slug: string
  label: string
  category: CategoryKey
  /** The figure the page ranks by and draws as a bar. */
  key: MetricKey
  /** The columns beside it. */
  cols: MetricKey[]
  /** One line on what the figure counts, where the name alone does not say it. */
  about?: string
  /** Every column plain, no bar (the wide table of the main figures). */
  wide?: boolean
}

export const STATS: StatDef[] = [
  {
    slug: 'win-rate',
    label: 'Win rate',
    category: 'results',
    key: 'win',
    cols: ['games', 'pick', 'ban', 'change'],
  },
  {
    slug: 'pick-rate',
    label: 'Pick rate',
    category: 'results',
    key: 'pick',
    cols: ['games', 'win', 'ban'],
  },
  {
    slug: 'ban-rate',
    label: 'Ban rate',
    category: 'results',
    key: 'ban',
    cols: ['pick', 'win', 'games'],
  },
  {
    slug: 'patch-change',
    label: 'Win rate change',
    category: 'results',
    key: 'change',
    cols: ['win', 'games', 'pick'],
    about: 'Win rate against the patch before, in points.',
  },
  {
    slug: 'games',
    label: 'Games played',
    category: 'results',
    key: 'games',
    cols: ['pick', 'win'],
  },
  {
    slug: 'table',
    label: 'All main figures',
    category: 'results',
    key: 'win',
    cols: [
      'games',
      'pick',
      'ban',
      'change',
      'kda',
      'csm',
      'dmg',
      'gd10',
      'ahead',
      'aheadWin',
      'fb',
      'under25',
      'over25',
    ],
    wide: true,
  },

  {
    slug: 'kda',
    label: 'KDA',
    category: 'combat',
    key: 'kda',
    cols: ['kills', 'deaths', 'assists', 'win'],
    about: 'Kills plus assists, divided by deaths.',
  },
  {
    slug: 'kills',
    label: 'Kills',
    category: 'combat',
    key: 'kills',
    cols: ['kda', 'kp', 'win'],
    about: 'Per game.',
  },
  {
    slug: 'deaths',
    label: 'Deaths',
    category: 'combat',
    key: 'deaths',
    cols: ['kda', 'taken', 'win'],
    about: 'Per game.',
  },
  {
    slug: 'assists',
    label: 'Assists',
    category: 'combat',
    key: 'assists',
    cols: ['kda', 'kp', 'win'],
    about: 'Per game.',
  },
  {
    slug: 'kill-participation',
    label: 'Kill participation',
    category: 'combat',
    key: 'kp',
    cols: ['kills', 'assists', 'win'],
    about: "Share of the team's kills it took or helped take.",
  },
  {
    slug: 'first-blood',
    label: 'First blood',
    category: 'combat',
    key: 'fb',
    cols: ['fbKill', 'fbVictim', 'win'],
    about: 'Games it took or helped take first blood.',
  },

  {
    slug: 'damage',
    label: 'Damage to champions',
    category: 'damage',
    key: 'dmg',
    cols: ['dpm', 'dmgShare', 'phys', 'magic', 'trueDmg'],
    about: 'Per game.',
  },
  {
    slug: 'damage-per-minute',
    label: 'Damage per minute',
    category: 'damage',
    key: 'dpm',
    cols: ['dmg', 'dmgShare', 'length'],
  },
  {
    slug: 'damage-share',
    label: 'Team damage share',
    category: 'damage',
    key: 'dmgShare',
    cols: ['dmg', 'dpm', 'win'],
    about: "Share of the team's damage to champions.",
  },
  {
    slug: 'damage-taken',
    label: 'Damage taken',
    category: 'damage',
    key: 'taken',
    cols: ['deaths', 'dmg', 'win'],
    about: 'Per game.',
  },
  {
    slug: 'turret-damage',
    label: 'Damage to turrets',
    category: 'damage',
    key: 'turret',
    cols: ['towers', 'objective', 'win'],
    about: 'Per game.',
  },
  {
    slug: 'objective-damage',
    label: 'Damage to objectives',
    category: 'damage',
    key: 'objective',
    cols: ['turret', 'dragons', 'barons'],
    about: 'Per game: turrets, dragons, barons and the other epic monsters.',
  },

  {
    slug: 'cs-per-minute',
    label: 'CS per minute',
    category: 'laning',
    key: 'csm',
    cols: ['cs10', 'cs15', 'cs', 'jungle'],
  },
  {
    slug: 'cs-at-15',
    label: 'CS at 15 minutes',
    category: 'laning',
    key: 'cs15',
    cols: ['csd15', 'cs10', 'csm'],
  },
  {
    slug: 'gold-lead-10',
    label: 'Gold lead at 10',
    category: 'laning',
    key: 'gd10',
    cols: ['gd15', 'csd10', 'xpd10', 'ahead', 'aheadWin'],
    about: 'Gold against the lane opponent at 10 minutes.',
  },
  {
    slug: 'gold-lead-15',
    label: 'Gold lead at 15',
    category: 'laning',
    key: 'gd15',
    cols: ['gd10', 'csd15', 'xpd15'],
    about: 'Gold against the lane opponent at 15 minutes.',
  },
  {
    slug: 'cs-lead-15',
    label: 'CS lead at 15',
    category: 'laning',
    key: 'csd15',
    cols: ['csd10', 'cs15', 'gd15'],
    about: 'CS against the lane opponent at 15 minutes.',
  },
  {
    slug: 'xp-lead-15',
    label: 'XP lead at 15',
    category: 'laning',
    key: 'xpd15',
    cols: ['xpd10', 'gd15'],
    about: 'Experience against the lane opponent at 15 minutes.',
  },
  {
    slug: 'ahead-at-10',
    label: 'Ahead at 10 minutes',
    category: 'laning',
    key: 'ahead',
    cols: ['aheadWin', 'gd10', 'win'],
    about: 'Games ahead of the lane opponent in gold at 10 minutes.',
  },
  {
    slug: 'wins-when-ahead',
    label: 'Wins when ahead',
    category: 'laning',
    key: 'aheadWin',
    cols: ['ahead', 'gd10', 'win'],
    about: 'Win rate of the games ahead in gold at 10 minutes.',
  },
  {
    slug: 'gold-per-minute',
    label: 'Gold per minute',
    category: 'laning',
    key: 'gpm',
    cols: ['gold', 'csm', 'length'],
  },
  {
    slug: 'jungle-monsters',
    label: 'Jungle monsters',
    category: 'laning',
    key: 'jungle',
    cols: ['csm', 'cs', 'win'],
    about: 'Monsters killed per game.',
  },

  {
    slug: 'dragons',
    label: 'Dragons',
    category: 'objectives',
    key: 'dragons',
    cols: ['barons', 'heralds', 'towers', 'win'],
    about: "Taken by the champion's team, per game.",
  },
  {
    slug: 'barons',
    label: 'Barons',
    category: 'objectives',
    key: 'barons',
    cols: ['dragons', 'heralds', 'win'],
    about: "Taken by the champion's team, per game.",
  },
  {
    slug: 'rift-heralds',
    label: 'Rift Heralds',
    category: 'objectives',
    key: 'heralds',
    cols: ['dragons', 'towers', 'win'],
    about: "Taken by the champion's team, per game.",
  },
  {
    slug: 'towers',
    label: 'Towers',
    category: 'objectives',
    key: 'towers',
    cols: ['inhibs', 'turret', 'win'],
    about: "Taken by the champion's team, per game.",
  },
  {
    slug: 'inhibitors',
    label: 'Inhibitors',
    category: 'objectives',
    key: 'inhibs',
    cols: ['towers', 'barons', 'win'],
    about: "Taken by the champion's team, per game.",
  },

  {
    slug: 'vision-score',
    label: 'Vision score',
    category: 'vision',
    key: 'vision',
    cols: ['vpm', 'wards', 'wardsKilled', 'control'],
    about: 'Per game.',
  },
  {
    slug: 'vision-per-minute',
    label: 'Vision score per minute',
    category: 'vision',
    key: 'vpm',
    cols: ['vision', 'wards', 'control'],
  },
  {
    slug: 'wards-placed',
    label: 'Wards placed',
    category: 'vision',
    key: 'wards',
    cols: ['wardsKilled', 'control', 'vision'],
    about: 'Per game.',
  },
  {
    slug: 'wards-cleared',
    label: 'Wards cleared',
    category: 'vision',
    key: 'wardsKilled',
    cols: ['wards', 'control', 'vision'],
    about: 'Per game.',
  },
  {
    slug: 'control-wards',
    label: 'Control wards',
    category: 'vision',
    key: 'control',
    cols: ['wards', 'wardsKilled', 'vision'],
    about: 'Bought per game.',
  },

  {
    slug: 'game-length',
    label: 'Game length',
    category: 'length',
    key: 'length',
    cols: ['len0', 'len1', 'len2', 'len3', 'len4'],
    about: 'How long its games last, then its win rate by length.',
  },
  {
    slug: 'short-games',
    label: 'Wins under 25 minutes',
    category: 'length',
    key: 'under25',
    cols: ['over25', 'length', 'games'],
  },
  {
    slug: 'long-games',
    label: 'Wins over 25 minutes',
    category: 'length',
    key: 'over25',
    cols: ['under25', 'length', 'games'],
  },

  {
    slug: 'pings',
    label: 'Pings',
    category: 'pings',
    key: 'pings',
    cols: ['missing', 'omw', 'getBack', 'enemyVision', 'allIn'],
    about: 'Every kind, per game.',
  },
  {
    slug: 'missing-pings',
    label: 'Enemy missing pings',
    category: 'pings',
    key: 'missing',
    cols: ['pings', 'getBack'],
    about: 'The question mark, per game.',
  },
  {
    slug: 'on-my-way-pings',
    label: 'On my way pings',
    category: 'pings',
    key: 'omw',
    cols: ['pings', 'allIn'],
    about: 'Per game.',
  },
  {
    slug: 'retreat-pings',
    label: 'Retreat pings',
    category: 'pings',
    key: 'getBack',
    cols: ['pings', 'missing'],
    about: 'Per game.',
  },
  {
    slug: 'enemy-vision-pings',
    label: 'Enemy vision pings',
    category: 'pings',
    key: 'enemyVision',
    cols: ['pings', 'wardsKilled'],
    about: 'Per game.',
  },
  {
    slug: 'all-in-pings',
    label: 'All in pings',
    category: 'pings',
    key: 'allIn',
    cols: ['pings', 'omw'],
    about: 'Per game.',
  },

  {
    slug: 'flash-key',
    label: 'Flash on D',
    category: 'spells',
    key: 'flashD',
    cols: ['noFlash', 'games'],
    about: 'Of the games with Flash, the share with Flash on D; the others have it on F.',
  },
  {
    slug: 'without-flash',
    label: 'Games without Flash',
    category: 'spells',
    key: 'noFlash',
    cols: ['flashD', 'games', 'win'],
  },
]

export const statOf = (slug: string | null | undefined) =>
  slug ? (STATS.find((s) => s.slug === slug) ?? null) : null

/** The old explorer's views (`/stats?view=`) and its table's sort keys, as studio pages. */
const OLD_VIEWS: Record<string, string | null> = {
  overview: null,
  table: 'table',
  early: 'gold-lead-10',
  length: 'game-length',
  firstblood: 'first-blood',
  items: 'table',
  regions: 'table',
  patch: 'patch-change',
}
const OLD_SORTS: Record<string, string> = {
  win: 'win-rate',
  pick: 'pick-rate',
  ban: 'ban-rate',
  change: 'patch-change',
  games: 'games',
  kda: 'kda',
  cs: 'cs-per-minute',
  dmg: 'damage',
  gold: 'gold-lead-10',
  gold10: 'gold-lead-10',
  gold15: 'gold-lead-15',
  ahead: 'ahead-at-10',
  aheadWin: 'wins-when-ahead',
  fb: 'first-blood',
  under25: 'short-games',
  over25: 'long-games',
  length: 'game-length',
}

/**
 * The studio page an old explorer address meant (`?view=table&sort=ahead` → `ahead-at-10`):
 * a slug, null for the hub, undefined when the address is not an old one.
 */
export function oldStat(view: unknown, sort: unknown): string | null | undefined {
  const v = typeof view === 'string' ? view : null
  const s = typeof sort === 'string' ? sort : null
  if (v === null && s === null) return undefined
  if (s && OLD_SORTS[s]) return OLD_SORTS[s]
  if (v !== null && v in OLD_VIEWS) return OLD_VIEWS[v]
  return null
}

const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '')

/** A figure as the page writes it. */
export function fmt(f: Fmt, v: number): string {
  switch (f) {
    case 'pct2':
      return `${(v * 100).toFixed(2)}%`
    case 'pct1':
      return `${(v * 100).toFixed(1)}%`
    case 'n2':
      return v.toFixed(2)
    case 'n1':
      return v.toFixed(1)
    case 'int':
      return thousands(v)
    case 'sgn0':
      return `${sign(Math.round(v))}${thousands(Math.abs(v))}`
    case 'sgn1':
      return `${sign(Math.round(v * 10))}${Math.abs(v).toFixed(1)}`
    case 'pts':
      return `${sign(Math.round(v * 100))}${Math.abs(v).toFixed(2)}`
    case 'time': {
      const s = Math.round(v)
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
    }
  }
}

/** A figure of `key`, written, or a dash when there is none. */
export const fmtMetric = (key: MetricKey, v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v) ? '–' : fmt(METRICS[key].fmt, v)

/** What a statistic without a figure says: no patch to compare with, cells not counted, or too few games. */
export function emptyText(stat: StatDef) {
  if (stat.key === 'change') return 'No earlier patch'
  return METRICS[stat.key].source === 'lane' ? 'Not counted yet' : 'Too few games'
}
