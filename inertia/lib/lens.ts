import {
  isAfk,
  isRemake,
  matchMinutes,
  scoreLobby,
  SCORE_SCALE,
  teamTotals,
  type TeamTotals,
} from './match.js'
import type { Match, Participant } from './types.js'

/* ── Lens ──────────────────────────────────────────────────────────

   A player's recent games in one role, read domain by domain: laning,
   farming, teamfighting, vision, objectives, survival and consistency.
   Each domain is a 0–100 rating on the Invade score's own scale
   (lib/match.ts): ~41 is the Emerald pace of the role, 80 is rare.

   Every figure of a game is measured as the score measures it. Against
   the standard: the Emerald pace of the role (CS, gold, kill
   participation, vision, KDA), in units of how much that figure swings
   from one game to the next. And against the lobby: here the lane
   opponent, the player of the same role on the other side, so a figure
   needs no role adjustment and a slow game is read for what it was.
   Figures with a standard weigh both halves equally; the others (damage,
   deaths, wards, objectives, the laning gaps) are read against the lane
   opponent only. Each is clamped as the score clamps it, the role's
   weights from the score are kept where the score has the figure, and a
   game's domain is the weighted mean through the score's curve.

   The window's rating is the mean of its games, pulled towards the pace
   by two games' worth of it, so a handful of games cannot claim an
   extreme. A domain needs three games to be rated; laning reads the
   minute frames of a timeline, which only some stored games have.

   Spreads of the figures the score does not have are approximate, from
   public ranked statistics; like the score's, only their size relative
   to each other matters. */

export const LENS_DOMAINS = [
  'laning',
  'farming',
  'fighting',
  'vision',
  'objectives',
  'survival',
  'consistency',
] as const
export type LensDomainKey = (typeof LENS_DOMAINS)[number]

export const LENS_LABELS: Record<LensDomainKey, string> = {
  laning: 'Laning',
  farming: 'Farming',
  fighting: 'Fighting',
  vision: 'Vision',
  objectives: 'Objectives',
  survival: 'Survival',
  consistency: 'Consistency',
}

/** Riot's positions, in lane order, as `team_position` stores them. */
export const LENS_ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const
export type LensRole = (typeof LENS_ROLES)[number]

/** Games a domain needs before it is rated. */
export const MIN_GAMES = 3
/** Games' worth of the pace a rating is pulled towards. */
const PRIOR = 2
/** At or above: a strength. At or below: a weakness. */
export const EDGE = 55
export const WEAK = 30

const {
  pace: PACE,
  spread: SPREAD,
  weights: WEIGHTS,
  standard: STANDARD,
  sigma,
  curve,
} = SCORE_SCALE
/** The rating of a game exactly on the pace. */
export const PACE_RATING = curve(0)
/** A standing (in game-to-game spreads) as a rating, as one game's domain is rated. */
export const ratingOf = (standing: number) => curve(standing / sigma)

/** One player's frame at one minute of a timeline. `cs` counts lane and jungle minions. */
export interface LensFrame {
  matchId: string
  puuid: string
  participantId: number
  minute: number
  cs: number
  gold: number
  xp: number
  deaths: number
}

/** A kill or an epic monster. `t` in seconds; participant ids as in the frames. */
export interface LensEvent {
  matchId: string
  t: number
  kind: string
  killer: number
  victim: number
  assists: number[]
}

export interface LensRef {
  label: string
  value: number
}

export interface LensFigure {
  key: string
  label: string
  /** The player's value over the games that had it. */
  value: number | null
  /** What it is read against: the Emerald pace, the lane opponents, a typical value. */
  refs: LensRef[]
  /** How far ahead (+) or behind (−) the figure stands, in game-to-game spreads. */
  standing: number | null
  games: number
  digits: number
  unit: '' | '%'
  /** A laning figure: read as the gap to the lane opponent. */
  signed: boolean
  /** Fewer is better (deaths). */
  lower: boolean
  /** A spread, shown as ±. */
  plusMinus?: boolean
}

export interface LensDomain {
  key: LensDomainKey
  label: string
  /** 0–100 on the score's scale; null until enough games say something. */
  rating: number | null
  /** Games the rating is read from. */
  games: number
  /** Why there is no rating yet. */
  need: 'timeline' | 'games' | null
  /** One plain sentence or two: what the rating means for this player. */
  read: string | null
  /** The read's first sentence alone. */
  headline: string | null
  /** The figure whose numbers the read gives, if any. */
  readFigure: string | null
  figures: LensFigure[]
  /** The domain's rating in each game of `games` (oldest first), null where it was not read. */
  trend: (number | null)[]
}

export interface LensGame {
  matchId: string
  at: number
  championId: number
  /** The lane opponent's champion; null without one. */
  opponentChampionId: number | null
  deaths: number
  /** The lane opponent's deaths; null without one. */
  opponentDeaths: number | null
  win: boolean
  score: number | null
  timeline: boolean
}

/** The first minutes of the lane, averaged over the games with a timeline: you and your opponent. */
export interface LensDuel {
  games: number
  /** Minute by minute from 0, as far as the frames go (15 at most). */
  cs: { you: number[]; opponent: number[] }
  gold: { you: number[]; opponent: number[] }
}

/** The epic monsters and towers each side took, per game on average: context, not rated. */
export interface LensObjectives {
  games: number
  you: Record<'dragons' | 'heralds' | 'barons' | 'towers', number>
  them: Record<'dragons' | 'heralds' | 'barons' | 'towers', number>
}

export interface Lens {
  role: LensRole
  /** The games read, oldest first. */
  games: LensGame[]
  timelineGames: number
  /** The average Invade score of those games. */
  score: number | null
  /** Champions played in those games, most played first. */
  champions: Array<{ championId: number; games: number }>
  /** The lane's first fifteen minutes; null without a timeline. */
  duel: LensDuel | null
  /** What the two teams took, per game. */
  objectives: LensObjectives | null
  domains: LensDomain[]
}

/** The API's answer: the reading, and what it was read from. */
export interface LensPayload extends Omit<Lens, 'role'> {
  role: LensRole | null
  /** The player's recent games per role in this queue: the main role first. */
  roles: Array<{ role: LensRole; games: number }>
  queue: string
  window: number
}

/* ── One game, as the figures read it ─────────────────────────── */

interface Game {
  match: Match
  minutes: number
  totals: Record<number, TeamTotals>
  me: Participant
  /** The lane opponent; null when there is none (or they were away). */
  opp: Participant | null
  /** Frames by puuid, then minute. Empty without a timeline. */
  frames: Map<string, Map<number, LensFrame>>
  /** Kills and epic monsters; null when none are stored for the game. */
  events: LensEvent[] | null
}

type Measured = { shown: number; measure: number }

interface Spec {
  key: string
  domain: Exclude<LensDomainKey, 'consistency'>
  label: string
  /** Inside a sentence, after the number: "7.4 CS a minute". */
  phrase: string
  digits: number
  unit?: '%'
  signed?: boolean
  lower?: boolean
  /** The figure as shown for one player of one game; null when the game cannot say. */
  shown: (g: Game, p: Participant) => number | null
  /** What is compared, in the units of `spread` (a rate, a log). Defaults to `shown`. */
  measure?: (g: Game, p: Participant, shown: number) => number
  /** The role's Emerald pace, as shown and as measured. */
  pace?: (r: number) => Measured
  spread: (r: number) => number
  /** The role's weight of the figure inside its domain; 0 leaves it out. */
  weight: (r: number) => number
  /** The window's value, when it is not the mean of the games (KDA: a ratio of sums). */
  total?: (rows: Array<[Game, Participant]>) => number
  /** The read when this figure leads the domain: ahead, behind. */
  headline: [string, string]
  /** Laning gaps in a sentence: "8 CS up at 10". */
  gap?: [string, string]
}

const perRole = (values: readonly number[]) => (r: number) => values[r]
const all = (value: number) => () => value
const rate = (g: Game, n: number | undefined) => (n || 0) / g.minutes
const log = (floor: number) => (_g: Game, _p: Participant, v: number) =>
  Math.log(Math.max(floor, v))
const frameAt = (g: Game, p: Participant, minute: number) => g.frames.get(p.puuid)?.get(minute)
const idOf = (g: Game, p: Participant) =>
  g.frames.get(p.puuid)?.values().next().value?.participantId
/** The laning phase, in seconds: early deaths and solo kills are counted before it ends. */
const LANING_END = 14 * 60

const SPECS: Spec[] = [
  /* Laning: the minute frames of a timeline, against the lane opponent. */
  {
    key: 'cs10',
    domain: 'laning',
    label: 'CS at 10',
    phrase: 'CS at 10',
    digits: 0,
    signed: true,
    shown: (g, p) => frameAt(g, p, 10)?.cs ?? null,
    spread: perRole([14, 10, 14, 14, 6]),
    weight: perRole([1, 0.8, 1, 1, 0]),
    headline: ['You out-farm your lane early.', 'You lose CS early.'],
    gap: ['CS up at 10', 'CS down at 10'],
  },
  {
    key: 'gold15',
    domain: 'laning',
    label: 'Gold at 15',
    phrase: 'gold at 15',
    digits: 0,
    signed: true,
    shown: (g, p) => frameAt(g, p, 15)?.gold ?? null,
    spread: perRole([900, 800, 900, 900, 550]),
    weight: all(1),
    headline: ['You leave lane with a lead.', 'You leave lane behind.'],
    gap: ['gold up at 15', 'gold down at 15'],
  },
  {
    key: 'deaths14',
    domain: 'laning',
    label: 'Early deaths',
    phrase: 'deaths before 14 minutes',
    digits: 1,
    lower: true,
    shown: (g, p) => frameAt(g, p, 14)?.deaths ?? null,
    spread: all(0.8),
    weight: all(0.8),
    headline: ['You rarely die early.', 'Early deaths cost your lane.'],
  },
  {
    key: 'solo',
    domain: 'laning',
    label: 'Early solo kills',
    phrase: 'solo kills before 14 minutes',
    digits: 1,
    shown: (g, p) => {
      const id = idOf(g, p)
      if (!g.events || !id || !frameAt(g, p, 14)) return null
      return g.events.filter(
        (e) => e.kind === 'kill' && e.killer === id && !e.assists.length && e.t < LANING_END
      ).length
    },
    spread: all(0.7),
    weight: perRole([0.6, 0.4, 0.6, 0.5, 0.2]),
    headline: ['You win your duels.', 'Your lane opponent wins the duels.'],
  },

  /* Farming */
  {
    key: 'csm',
    domain: 'farming',
    label: 'CS per minute',
    phrase: 'CS a minute',
    digits: 1,
    shown: (g, p) => rate(g, p.cs),
    pace: (r) => ({ shown: PACE[r][0], measure: PACE[r][0] }),
    spread: (r) => SPREAD[r][6],
    weight: (r) => WEIGHTS[r][6],
    headline: ['Farming is your edge.', 'Your CS falls short.'],
  },
  {
    key: 'gpm',
    domain: 'farming',
    label: 'Gold per minute',
    phrase: 'gold a minute',
    digits: 0,
    shown: (g, p) => rate(g, p.goldEarned),
    measure: log(1),
    pace: (r) => ({ shown: PACE[r][1], measure: Math.log(PACE[r][1]) }),
    spread: (r) => SPREAD[r][5],
    weight: (r) => WEIGHTS[r][5],
    headline: ['You earn gold fast.', 'Your income trails.'],
  },

  /* Teamfighting */
  {
    key: 'kp',
    domain: 'fighting',
    label: 'Kill participation',
    phrase: 'kill participation',
    digits: 0,
    unit: '%',
    shown: (g, p) => {
      const kills = g.totals[p.teamId]?.kills || 0
      return kills ? (((p.kills || 0) + (p.assists || 0)) / kills) * 100 : null
    },
    measure: (_g, _p, v) => v / 100,
    pace: (r) => ({ shown: PACE[r][2] * 100, measure: PACE[r][2] }),
    spread: (r) => SPREAD[r][1],
    weight: (r) => WEIGHTS[r][1],
    headline: ['You show up for fights.', 'Fights happen without you.'],
  },
  {
    key: 'dpm',
    domain: 'fighting',
    label: 'Damage per minute',
    phrase: 'damage a minute',
    digits: 0,
    shown: (g, p) => rate(g, p.totalDamageDealtToChampions),
    measure: log(50),
    spread: (r) => SPREAD[r][3],
    weight: (r) => WEIGHTS[r][3],
    headline: ['You deal heavy damage.', 'Your damage is low.'],
  },
  {
    key: 'share',
    domain: 'fighting',
    label: 'Damage share',
    phrase: "of your team's damage",
    digits: 0,
    unit: '%',
    shown: (g, p) => {
      const damage = g.totals[p.teamId]?.damage || 0
      return damage ? ((p.totalDamageDealtToChampions || 0) / damage) * 100 : null
    },
    measure: (_g, _p, v) => v / 100,
    spread: perRole([0.06, 0.05, 0.06, 0.06, 0.04]),
    weight: perRole([0.8, 0.6, 0.9, 0.9, 0.4]),
    headline: ["You carry your team's damage.", 'Your team does the damage.'],
  },
  {
    key: 'efficiency',
    domain: 'fighting',
    label: 'Damage per gold',
    phrase: 'damage per gold',
    digits: 2,
    shown: (_g, p) => (p.goldEarned ? (p.totalDamageDealtToChampions || 0) / p.goldEarned : null),
    measure: log(0.05),
    spread: all(0.3),
    weight: perRole([0.6, 0.5, 0.7, 0.7, 0.5]),
    headline: ['You turn gold into damage.', 'Your gold does little damage.'],
  },

  /* Vision */
  {
    key: 'vision',
    domain: 'vision',
    label: 'Vision per minute',
    phrase: 'vision score a minute',
    digits: 2,
    shown: (g, p) => rate(g, p.visionScore),
    pace: (r) => ({ shown: PACE[r][3], measure: PACE[r][3] }),
    spread: (r) => SPREAD[r][8],
    weight: all(1),
    headline: ['Your vision is a strength.', 'Vision is a gap.'],
  },
  {
    key: 'wards',
    domain: 'vision',
    label: 'Wards placed',
    phrase: 'wards a game',
    digits: 1,
    shown: (_g, p) => p.wardsPlaced ?? null,
    measure: (g, _p, v) => v / g.minutes,
    spread: perRole([0.12, 0.12, 0.12, 0.12, 0.3]),
    weight: perRole([0.6, 0.6, 0.6, 0.6, 0.8]),
    headline: ['You ward a lot.', 'You place few wards.'],
  },
  {
    key: 'control',
    domain: 'vision',
    label: 'Control wards',
    phrase: 'control wards a game',
    digits: 1,
    shown: (_g, p) => p.visionWardsBoughtInGame ?? null,
    measure: (g, _p, v) => (v / g.minutes) * 30,
    spread: perRole([1.2, 1.4, 1.2, 1.2, 2.2]),
    weight: all(0.6),
    headline: ['You buy control wards.', 'You buy few control wards.'],
  },
  {
    key: 'cleared',
    domain: 'vision',
    label: 'Wards cleared',
    phrase: 'wards cleared a game',
    digits: 1,
    shown: (_g, p) => p.wardsKilled ?? null,
    measure: (g, _p, v) => v / g.minutes,
    spread: perRole([0.08, 0.1, 0.08, 0.08, 0.14]),
    weight: perRole([0.5, 0.7, 0.5, 0.5, 0.7]),
    headline: ['You clear their wards.', 'Their wards stay up.'],
  },

  /* Objectives */
  {
    key: 'objectives',
    domain: 'objectives',
    label: 'Objective damage',
    phrase: 'objective damage a game',
    digits: 0,
    shown: (_g, p) => p.damageDealtToObjectives ?? null,
    measure: (g, _p, v) => Math.log(Math.max(20, v / g.minutes)),
    spread: (r) => SPREAD[r][9],
    weight: all(1),
    headline: ['You take objectives.', 'Objectives slip past you.'],
  },
  {
    key: 'towers',
    domain: 'objectives',
    label: 'Tower damage',
    phrase: 'tower damage a game',
    digits: 0,
    shown: (_g, p) => p.damageDealtToTurrets ?? null,
    measure: (g, _p, v) => Math.log(Math.max(20, v / g.minutes)),
    spread: all(0.9),
    weight: perRole([0.9, 0.5, 0.8, 0.9, 0.5]),
    headline: ['You take towers.', 'You rarely hit towers.'],
  },
  {
    key: 'epic',
    domain: 'objectives',
    label: 'Epic monsters',
    phrase: 'dragons, heralds and barons a game',
    digits: 1,
    shown: (g, p) => {
      const id = idOf(g, p)
      if (!g.events || !id) return null
      return g.events.filter(
        (e) => (e.kind === 'dragon' || e.kind === 'herald' || e.kind === 'baron') && e.killer === id
      ).length
    },
    spread: all(0.9),
    weight: perRole([0, 1, 0, 0, 0]),
    headline: ['You secure the big objectives.', 'The enemy jungler takes the objectives.'],
  },

  /* Survival */
  {
    key: 'deaths',
    domain: 'survival',
    label: 'Deaths per game',
    phrase: 'deaths a game',
    digits: 1,
    lower: true,
    shown: (_g, p) => p.deaths || 0,
    measure: (g, p) => rate(g, p.deaths) * 10,
    spread: (r) => SPREAD[r][2],
    weight: (r) => WEIGHTS[r][2],
    headline: ['You stay alive.', 'Deaths are costing you.'],
  },
  {
    key: 'kda',
    domain: 'survival',
    label: 'KDA',
    phrase: 'KDA',
    digits: 2,
    shown: (_g, p) => ((p.kills || 0) + (p.assists || 0)) / Math.max(1, p.deaths || 0),
    measure: (_g, _p, v) => Math.log(1 + v),
    /* As the score: a game's ln(1 + KDA) averages 0.1 above the ratio of sums the pace is. */
    pace: (r) => ({ shown: PACE[r][4], measure: Math.log(1 + PACE[r][4]) + 0.1 }),
    spread: (r) => SPREAD[r][0],
    weight: (r) => WEIGHTS[r][0],
    total: (rows) => {
      let ka = 0
      let d = 0
      for (const [, p] of rows) {
        ka += (p.kills || 0) + (p.assists || 0)
        d += p.deaths || 0
      }
      return ka / Math.max(1, d)
    },
    headline: ['Your KDA is a strength.', 'Your KDA trails.'],
  },
  {
    key: 'taken',
    domain: 'survival',
    label: 'Damage taken per death',
    phrase: 'damage taken per death',
    digits: 0,
    shown: (_g, p) =>
      p.damageTaken === undefined || p.damageTaken === null
        ? null
        : p.damageTaken / Math.max(1, p.deaths || 0),
    measure: log(500),
    spread: all(0.55),
    weight: perRole([0.6, 0.6, 0.5, 0.5, 0.6]),
    headline: ['You are hard to kill.', 'You go down quickly.'],
  },
]

/** An even domain's read: a little ahead, on the pace, a little behind. */
const EVEN: Record<LensDomainKey, [string, string, string]> = {
  laning: [
    'You leave lane slightly ahead.',
    'Your lanes end close to even.',
    'You leave lane slightly behind.',
  ],
  farming: [
    'You farm a touch above Emerald.',
    'You farm like an Emerald player.',
    'You farm a touch under Emerald.',
  ],
  fighting: [
    'You fight a bit above Emerald.',
    'You fight at an Emerald level.',
    'You fight a bit under Emerald.',
  ],
  vision: [
    'Your vision is a bit above Emerald.',
    'Your vision matches Emerald.',
    'Your vision is a bit under Emerald.',
  ],
  objectives: [
    'You hit objectives a bit more than your opponents.',
    'You hit objectives as much as your opponents.',
    'You hit objectives a bit less than your opponents.',
  ],
  survival: [
    'You die a bit less than your opponents.',
    'You die about as often as your opponents.',
    'You die a bit more than your opponents.',
  ],
  consistency: [
    'Your games are steadier than most.',
    'Your games swing like most players’.',
    'Your games swing more than most.',
  ],
}
/** Rating points from the pace that read as "a little" to one side. */
const LEAN = 5

/* ── Consistency: the spread of the Invade score ─────────────────
   How far a player's games swing around their own average, in score
   points, against a typical swing: real games put one standard
   deviation of the score near 21 points across players, most of it
   from one game to the next. Rated by the same curve, so a typical
   swing reads near the pace. */
const TYPICAL_SWING = 18
const SWING_SPREAD = 6
/** Games' worth of the typical swing a small sample's spread is pulled towards. */
const SWING_PRIOR = 4
const MIN_SCORED = 5
const ROUGH = 30

const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
const clamp = (x: number) => Math.max(-3, Math.min(3.5, x))

/** A figure as a sentence's number: 7.4, 61%, 7,090, 12.4k. */
export function figureText(value: number, digits: number, unit: '' | '%' = '') {
  const abs = Math.abs(value)
  const text =
    digits === 0 && abs >= 10_000
      ? `${(abs / 1000).toFixed(abs >= 100_000 ? 0 : 1).replace(/\.0$/, '')}k`
      : digits === 0 && abs >= 1000
        ? Math.round(abs).toLocaleString('en-US')
        : abs.toFixed(digits)
  return `${value < 0 && text !== (0).toFixed(digits) ? '−' : ''}${text}${unit}`
}

interface Reading {
  spec: Spec
  /** Per game (aligned with the games read): the player's figure, the opponent's, the standing. */
  mine: (number | null)[]
  theirs: (number | null)[]
  x: (number | null)[]
}

function readFigure(spec: Spec, games: Game[], r: number): Reading {
  const reading: Reading = { spec, mine: [], theirs: [], x: [] }
  const sign = spec.lower ? -1 : 1
  const spread = spec.spread(r)
  const pace = spec.pace?.(r)
  for (const g of games) {
    const mine = spec.shown(g, g.me)
    const theirs = g.opp ? spec.shown(g, g.opp) : null
    reading.mine.push(mine)
    reading.theirs.push(theirs)
    if (mine === null) {
      reading.x.push(null)
      continue
    }
    const m = spec.measure ? spec.measure(g, g.me, mine) : mine
    const t = theirs === null ? null : spec.measure ? spec.measure(g, g.opp!, theirs) : theirs
    const vsLane = t === null ? null : (sign * (m - t)) / spread
    const vsPace = pace ? (sign * (m - pace.measure)) / spread : null
    const x =
      vsPace !== null && vsLane !== null
        ? STANDARD * vsPace + (1 - STANDARD) * vsLane
        : (vsPace ?? vsLane)
    reading.x.push(x === null ? null : clamp(x))
  }
  return reading
}

function figureOf(reading: Reading, games: Game[], r: number): LensFigure {
  const { spec } = reading
  const rows = (side: 'mine' | 'theirs') =>
    games.flatMap((g, i): Array<[Game, Participant]> => {
      const p = side === 'mine' ? g.me : g.opp
      return p && reading[side][i] !== null ? [[g, p]] : []
    })
  const value = (side: 'mine' | 'theirs') => {
    const present = reading[side].filter((v): v is number => v !== null)
    if (!present.length) return null
    return spec.total ? spec.total(rows(side)) : mean(present)
  }
  const refs: LensRef[] = []
  const pace = spec.pace?.(r)
  if (pace) refs.push({ label: 'Emerald', value: pace.shown })
  const opponents = value('theirs')
  if (opponents !== null) refs.push({ label: 'Opponents', value: opponents })
  return {
    key: spec.key,
    label: spec.label,
    value: value('mine'),
    refs,
    standing: mean(reading.x.filter((x): x is number => x !== null)),
    games: reading.mine.filter((v) => v !== null).length,
    digits: spec.digits,
    unit: spec.unit ?? '',
    signed: Boolean(spec.signed),
    lower: Boolean(spec.lower),
  }
}

/** One plain fact behind a reading: "8.0 CS a minute. Emerald pace 6.4, your opponents 7.8." */
function factOf(spec: Spec, figure: LensFigure): string | null {
  if (figure.value === null) return null
  const text = (v: number) => figureText(v, figure.digits, figure.unit)
  const opponents = figure.refs.find((ref) => ref.label === 'Opponents')
  if (spec.gap && opponents) {
    const gap = figure.value - opponents.value
    return `${text(Math.abs(gap))} ${spec.gap[gap >= 0 ? 0 : 1]}, on average.`
  }
  const pace = figure.refs.find((ref) => ref.label === 'Emerald')
  const refs = [
    pace ? `Emerald pace ${text(pace.value)}` : '',
    opponents ? `your opponents ${text(opponents.value)}` : '',
  ].filter(Boolean)
  const lead = `${text(figure.value)} ${spec.phrase}`
  return refs.length ? `${lead}. ${capital(refs.join(', '))}.` : `${lead}.`
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const SPEC_BY_KEY = new Map(SPECS.map((spec) => [spec.key, spec]))
/** A figure this far from even (in spreads) is worth a fact; this far, it leads the read. */
const NOTABLE = 0.35
const STANDOUT = 1

/**
 * The domain in a sentence or two. A strength or a weakness is named after the figure that
 * leads it ("Early deaths cost your lane."), with that figure's numbers; an even domain says so,
 * with its most notable figure when one stands out.
 */
interface Read {
  headline: string
  /** The figure the read leads with, and its numbers; none for an even domain with nothing notable. */
  figure: string | null
  fact: string | null
}

function readOf(key: LensDomainKey, rating: number, figures: LensFigure[]): Read {
  const read = figures.filter((f) => f.standing !== null && SPEC_BY_KEY.has(f.key))
  const sentence = (headline: string, lead: LensFigure | undefined): Read => {
    const fact = lead ? factOf(SPEC_BY_KEY.get(lead.key)!, lead) : null
    return { headline, figure: fact ? lead!.key : null, fact }
  }
  if (rating >= EDGE || rating <= WEAK) {
    const up = rating >= EDGE
    const lead = read.sort((a, b) =>
      up ? b.standing! - a.standing! : a.standing! - b.standing!
    )[0]
    if (lead && (up ? lead.standing! > 0 : lead.standing! < 0))
      return sentence(SPEC_BY_KEY.get(lead.key)!.headline[up ? 0 : 1], lead)
    return sentence(evenOf(key, rating), undefined)
  }
  /* Even overall: a figure far off the rest still leads the read. */
  const lead = read.sort((a, b) => Math.abs(b.standing!) - Math.abs(a.standing!))[0]
  if (lead && Math.abs(lead.standing!) >= STANDOUT)
    return sentence(SPEC_BY_KEY.get(lead.key)!.headline[lead.standing! > 0 ? 0 : 1], lead)
  return sentence(
    evenOf(key, rating),
    lead && Math.abs(lead.standing!) >= NOTABLE ? lead : undefined
  )
}

const readFields = (read: Read | null) => ({
  read: read ? (read.fact ? `${read.headline} ${read.fact}` : read.headline) : null,
  headline: read?.headline ?? null,
  readFigure: read?.figure ?? null,
})

/** Between a strength and a weakness: on the pace, or a little to one side of it. */
function evenOf(key: LensDomainKey, rating: number) {
  const side = rating >= PACE_RATING + LEAN ? 0 : rating <= PACE_RATING - LEAN ? 2 : 1
  return EVEN[key][side]
}

function consistencyOf(games: LensGame[]): LensDomain {
  const scores = games.map((g) => g.score).filter((s): s is number => s !== null)
  const base: LensDomain = {
    key: 'consistency',
    label: LENS_LABELS.consistency,
    rating: null,
    games: scores.length,
    need: scores.length < MIN_SCORED ? 'games' : null,
    read: null,
    headline: null,
    readFigure: null,
    figures: [],
    trend: games.map((g) => g.score),
  }
  if (scores.length < MIN_SCORED) return base
  const n = scores.length
  const average = mean(scores)!
  const sd = Math.sqrt(scores.reduce((s, v) => s + (v - average) ** 2, 0) / (n - 1))
  const pulled = Math.sqrt(
    ((n - 1) * sd ** 2 + SWING_PRIOR * TYPICAL_SWING ** 2) / (n - 1 + SWING_PRIOR)
  )
  const rating = Math.round(curve((TYPICAL_SWING - pulled) / SWING_SPREAD))
  const sorted = [...scores].sort((a, b) => a - b)
  const quarter = Math.max(1, Math.round(n / 4))
  const floor = mean(sorted.slice(0, quarter))!
  const ceiling = mean(sorted.slice(-quarter))!
  const rough = scores.filter((s) => s < ROUGH).length
  const figure = (key: string, label: string, value: number, extra: Partial<LensFigure> = {}) => ({
    key,
    label,
    value,
    refs: [],
    standing: null,
    games: n,
    digits: 0,
    unit: '' as const,
    signed: false,
    lower: false,
    ...extra,
  })
  const figures: LensFigure[] = [
    figure('swing', 'Swing', sd, {
      refs: [{ label: 'Typical', value: TYPICAL_SWING }],
      standing: (TYPICAL_SWING - sd) / SWING_SPREAD,
      lower: true,
      plusMinus: true,
    }),
    figure('floor', 'Worst quarter', floor),
    figure('ceiling', 'Best quarter', ceiling),
  ]
  const swing = `±${Math.round(sd)} points around your average of ${Math.round(average)}.`
  const read: Read =
    rating >= EDGE
      ? { headline: 'Steady: your games rarely swing far.', figure: 'swing', fact: swing }
      : rating <= WEAK
        ? {
            headline: 'Your games swing a lot.',
            figure: 'swing',
            fact: `${rough} of ${n} were rough, under ${ROUGH}. ${swing}`,
          }
        : { headline: evenOf('consistency', rating), figure: 'swing', fact: swing }
  return { ...base, rating, figures, ...readFields(read) }
}

/** The minutes of the lane drawn as a duel. */
export const DUEL_MINUTES = 15

/** The player's and their lane opponent's CS and gold, minute by minute, averaged over games. */
function duelOf(games: Game[]): LensDuel | null {
  const both = games.filter((g) => g.opp && g.frames.has(g.me.puuid) && g.frames.has(g.opp.puuid))
  if (!both.length) return null
  const duel: LensDuel = {
    games: both.length,
    cs: { you: [], opponent: [] },
    gold: { you: [], opponent: [] },
  }
  for (let minute = 0; minute <= DUEL_MINUTES; minute++) {
    const pairs = both.flatMap((g) => {
      const a = g.frames.get(g.me.puuid)!.get(minute)
      const b = g.frames.get(g.opp!.puuid)!.get(minute)
      return a && b ? [[a, b] as const] : []
    })
    if (!pairs.length) break
    duel.cs.you.push(mean(pairs.map(([a]) => a.cs))!)
    duel.cs.opponent.push(mean(pairs.map(([, b]) => b.cs))!)
    duel.gold.you.push(mean(pairs.map(([a]) => a.gold))!)
    duel.gold.opponent.push(mean(pairs.map(([, b]) => b.gold))!)
  }
  return duel.cs.you.length > 1 ? duel : null
}

/** The two teams' epic monsters and towers, per game, as the stored games count them. */
function objectivesOf(games: Game[]): LensObjectives | null {
  if (!games.length) return null
  const side = (g: Game, mine: boolean) => {
    const t1 = (g.me.teamId === 100) === mine
    const m = g.match
    return {
      dragons: (t1 ? m.t1Dragons : m.t2Dragons) || 0,
      heralds: (t1 ? m.t1Heralds : m.t2Heralds) || 0,
      barons: (t1 ? m.t1Barons : m.t2Barons) || 0,
      towers: (t1 ? m.t1Towers : m.t2Towers) || 0,
    }
  }
  const average = (mine: boolean) => {
    const rows = games.map((g) => side(g, mine))
    const of = (k: keyof (typeof rows)[number]) => mean(rows.map((r) => r[k]))!
    return {
      dragons: of('dragons'),
      heralds: of('heralds'),
      barons: of('barons'),
      towers: of('towers'),
    }
  }
  return { games: games.length, you: average(true), them: average(false) }
}

function championsOf(games: LensGame[]) {
  const counts = new Map<number, number>()
  for (const g of games) counts.set(g.championId, (counts.get(g.championId) ?? 0) + 1)
  return [...counts]
    .map(([championId, n]) => ({ championId, games: n }))
    .sort((a, b) => b.games - a.games || a.championId - b.championId)
}

/**
 * The Lens of `puuid` over `matches` (any order) in one role. Games in another role, remakes
 * and games the player was away for are left out. `frames` and `events` cover whichever of the
 * games have a timeline.
 */
export function readLens(input: {
  puuid: string
  role: LensRole
  matches: Match[]
  frames?: LensFrame[]
  events?: LensEvent[]
}): Lens {
  const { puuid, role } = input
  const r = LENS_ROLES.indexOf(role)
  const framesBy = new Map<string, Map<string, Map<number, LensFrame>>>()
  for (const f of input.frames ?? []) {
    let game = framesBy.get(f.matchId)
    if (!game) framesBy.set(f.matchId, (game = new Map()))
    let player = game.get(f.puuid)
    if (!player) game.set(f.puuid, (player = new Map()))
    player.set(f.minute, f)
  }
  const eventsBy = new Map<string, LensEvent[]>()
  for (const e of input.events ?? []) {
    const list = eventsBy.get(e.matchId)
    if (list) list.push(e)
    else eventsBy.set(e.matchId, [e])
  }

  const ordered = [...input.matches].sort(
    (a, b) => Number(a.gameStartMs) - Number(b.gameStartMs) || (a.matchId < b.matchId ? -1 : 1)
  )
  const games: Game[] = []
  const rows: LensGame[] = []
  for (const match of ordered) {
    if (isRemake(match)) continue
    const me = match.participants.find((p) => p.puuid === puuid)
    if (!me || me.position !== role || isAfk(match, me)) continue
    const opp =
      match.participants.find(
        (p) => p.teamId !== me.teamId && p.position === role && !isAfk(match, p)
      ) ?? null
    const frames = framesBy.get(match.matchId) ?? new Map()
    games.push({
      match,
      minutes: matchMinutes(match),
      totals: teamTotals(match),
      me,
      opp,
      frames,
      events: eventsBy.get(match.matchId) ?? null,
    })
    rows.push({
      matchId: match.matchId,
      at: Number(match.gameStartMs),
      championId: me.championId,
      opponentChampionId: opp?.championId ?? null,
      deaths: me.deaths || 0,
      opponentDeaths: opp ? opp.deaths || 0 : null,
      win: Boolean(me.win),
      score: scoreLobby(match)[puuid]?.score ?? null,
      timeline: frames.has(puuid),
    })
  }

  const readings = SPECS.filter((spec) => spec.weight(r) > 0).map((spec) =>
    readFigure(spec, games, r)
  )
  const domains: LensDomain[] = LENS_DOMAINS.map((key) => {
    if (key === 'consistency') return consistencyOf(rows)
    const own = readings.filter((reading) => reading.spec.domain === key)
    const trend = games.map((_, i) => {
      let sum = 0
      let weight = 0
      for (const { spec, x } of own) {
        if (x[i] === null) continue
        sum += spec.weight(r) * x[i]!
        weight += spec.weight(r)
      }
      return weight ? Math.round(curve(sum / weight / sigma)) : null
    })
    const rated = trend.filter((v): v is number => v !== null)
    const figures = own.map((reading) => figureOf(reading, games, r))
    const enough = rated.length >= MIN_GAMES
    const rating = enough
      ? Math.round(
          (rated.reduce((a, b) => a + b, 0) + PRIOR * PACE_RATING) / (rated.length + PRIOR)
        )
      : null
    return {
      key,
      label: LENS_LABELS[key],
      rating,
      games: rated.length,
      need: enough ? null : key === 'laning' ? 'timeline' : 'games',
      ...readFields(rating === null ? null : readOf(key, rating, figures)),
      figures,
      trend,
    }
  })

  const scores = rows.map((g) => g.score).filter((s): s is number => s !== null)
  return {
    role,
    games: rows,
    timelineGames: rows.filter((g) => g.timeline).length,
    score: scores.length ? Math.round(mean(scores)!) : null,
    champions: championsOf(rows),
    duel: duelOf(games),
    objectives: objectivesOf(games),
    domains,
  }
}
