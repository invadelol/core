import { fromCoreMatch } from '@invadelol/ui/logic'
import type { Match, Participant } from './types.js'

/** Riot's lane names (`teamPosition`), in lane order. */
export const POSITIONS = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']

export function matchMinutes(match: Pick<Match, 'duration'>) {
  return Math.max((match.duration || 0) / 60, 1)
}

export interface TeamTotals {
  kills: number
  deaths: number
  assists: number
  gold: number
  damage: number
  damageTaken: number
  vision: number
  cs: number
}

export function teamTotals(match: Match): Record<number, TeamTotals> {
  const empty = (): TeamTotals => ({
    kills: 0,
    deaths: 0,
    assists: 0,
    gold: 0,
    damage: 0,
    damageTaken: 0,
    vision: 0,
    cs: 0,
  })
  const totals: Record<number, TeamTotals> = { 100: empty(), 200: empty() }
  for (const p of match.participants) {
    const t = totals[p.teamId]
    if (!t) continue
    t.kills += p.kills || 0
    t.deaths += p.deaths || 0
    t.assists += p.assists || 0
    t.gold += p.goldEarned || 0
    t.damage += p.totalDamageDealtToChampions || 0
    t.damageTaken += p.damageTaken || 0
    t.vision += p.visionScore || 0
    t.cs += p.cs || 0
  }
  return totals
}

export function killParticipation(p: Participant, totals: Record<number, TeamTotals>) {
  const teamKills = totals[p.teamId]?.kills || 0
  if (!teamKills) return 0
  return ((p.kills + p.assists) / teamKills) * 100
}

export function damageShare(p: Participant, totals: Record<number, TeamTotals>) {
  const teamDamage = totals[p.teamId]?.damage || 0
  if (!teamDamage) return 0
  return ((p.totalDamageDealtToChampions || 0) / teamDamage) * 100
}

export function goldShare(p: Participant, totals: Record<number, TeamTotals>) {
  const teamGold = totals[p.teamId]?.gold || 0
  if (!teamGold) return 0
  return ((p.goldEarned || 0) / teamGold) * 100
}

/* ── Score ─────────────────────────────────────────────────────────

   One 0–100 number for how a game went: a real scale, not a ranking of
   the lobby. The desktop app computes the same score from the same
   figures (src-tauri/src/profile/score.rs); both check it against
   tests/fixtures/score_lobbies.json.

   Every figure is measured twice. Against the standard: the Emerald
   pace of the player's role (public rank statistics: CS, gold, kill
   participation, vision and KDA per minute), in units of how much that
   figure swings from one game to the next on real ranked games. And
   against the lobby: the same role-adjusted figure minus the lobby's
   average, so a long game where everyone farmed is read for what it
   was. Figures with no public standard (damage dealt and taken, deaths,
   objectives) are read against the lobby only.

   Each figure is clamped, weighed per role, and the weighted mean is
   divided by its spread over real games, so 1 is one standard
   deviation of game quality. A win adds 0.2 of one, a loss takes it
   off, then 100 / (1 + e^-(x − 0.35)): an average Emerald game is ~41,
   80 is about one game in 25, 90 a few in a thousand, and 100 needs
   every figure maxed: a game of the year.

   An AFK player (six levels and 35 % gold behind the lobby's median
   after ten minutes, and out of the fights) is not a way of playing:
   no score, and the lobby is read without them. A player in at least
   three of their team's kills and a quarter of them is never AFK: a
   roaming support can be that far behind and still play the whole
   game. Games under five minutes are remakes and are not scored. */

export const SCORE_CATEGORIES = ['fighting', 'damage', 'farming', 'vision', 'objectives'] as const
export type ScoreCategory = (typeof SCORE_CATEGORIES)[number]

/** Riot's positions in the score's role order; anything else (ARAM, Arena…) is roleless. */
const SCORE_ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']

/* Figure order everywhere below: ln(1 + KDA), kill participation,
   deaths per 10 min, ln damage/min, ln damage taken/min, ln gold/min,
   CS/min, ln gold over the lane opponent's, vision/min, ln objective
   damage/min. */
const FIGURES = 10
const PART_OF: ScoreCategory[] = [
  'fighting',
  'fighting',
  'fighting',
  'damage',
  'damage',
  'farming',
  'farming',
  'farming',
  'vision',
  'objectives',
]

/** Emerald pace per role: CS/min, gold/min, kill participation, vision/min, KDA. */
const PACE = [
  [6.4, 418, 0.44, 0.72, 2.4],
  [5.7, 406, 0.62, 0.88, 2.6],
  [6.6, 428, 0.52, 0.72, 2.5],
  [6.8, 438, 0.54, 0.66, 2.5],
  [1.4, 314, 0.63, 1.95, 2.7],
]

/** Role averages, from real ranked games, of the figures with no public standard: ln damage/min,
 *  ln taken/min, deaths per 10 min, ln objectives/min. Only the gaps between roles matter. */
const ROLE_MEAN = [
  [6.36, 6.71, 1.95, 5.43],
  [6.08, 6.78, 1.85, 6.29],
  [6.42, 6.5, 1.94, 5.33],
  [6.29, 6.4, 2.27, 5.24],
  [5.93, 6.43, 2.08, 4.3],
]

/** One standard deviation of each figure from one game to the next, per role, then roleless. */
const SPREAD = [
  [0.68, 0.19, 1.2, 0.65, 0.55, 0.22, 1.5, 0.3, 0.3, 1.0],
  [0.68, 0.19, 1.2, 0.7, 0.35, 0.2, 1.2, 0.3, 0.36, 1.0],
  [0.68, 0.19, 1.2, 0.62, 0.45, 0.22, 1.5, 0.3, 0.3, 1.0],
  [0.68, 0.19, 1.2, 0.65, 0.42, 0.22, 1.5, 0.3, 0.3, 1.0],
  [0.68, 0.19, 1.2, 0.63, 0.55, 0.17, 0.75, 0.3, 0.67, 0.85],
  [0.6, 0.15, 1.5, 0.45, 0.45, 0.15, 1.5, 0.3, 0.3, 1.0],
]

/** What each role is asked to do: the weight of each figure, then roleless. */
const WEIGHTS = [
  [1.0, 0.6, 0.8, 0.9, 0.6, 0.8, 0.8, 0.8, 0.3, 0.6],
  [1.0, 1.1, 0.8, 0.7, 0.5, 0.7, 0.6, 0.5, 0.6, 1.0],
  [1.0, 0.8, 0.8, 1.2, 0.2, 0.8, 0.8, 0.8, 0.3, 0.4],
  [1.0, 0.8, 0.9, 1.2, 0.1, 0.9, 1.0, 0.7, 0.3, 0.6],
  [1.0, 1.0, 0.8, 0.6, 0.5, 0.3, 0.0, 0.4, 1.0, 0.2],
  [1.0, 0.8, 0.6, 1.2, 0.5, 0.5, 0.3, 0.0, 0.0, 0.0],
]

/** Share of the standard in a figure that has one; the rest is the lobby. */
const STANDARD = 0.5
/** Spread of the weighted mean over real games: one standard deviation of a game. */
const SIGMA = 0.64
/** Where the curve crosses 50, in standard deviations above the standard. */
const CENTRE = 0.35
/** The result, in standard deviations. */
const RESULT = 0.2

const curve = (x: number) => 100 / (1 + Math.exp(-(x - CENTRE)))

/** The score's scale, for readings built on it (lib/lens.ts): the same pace, spreads and curve. */
export const SCORE_SCALE = {
  roles: SCORE_ROLES,
  pace: PACE,
  spread: SPREAD,
  weights: WEIGHTS,
  standard: STANDARD,
  sigma: SIGMA,
  curve,
} as const

/** Below this a game is a remake, and a score would only be noise. */
const MIN_SCORED_SECONDS = 300

/** A game that ended before five minutes: no result worth reading, no score. */
export function isRemake(match: Pick<Match, 'duration'>) {
  return (match.duration || 0) < MIN_SCORED_SECONDS
}

export interface PlayerScore {
  /** 0–100 overall. */
  score: number
  /** 0–100 per category, before role weighting. */
  categories: Record<ScoreCategory, number>
  /** The role weights that produced the overall, summing to 100. */
  weights: Record<ScoreCategory, number>
}

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b)
  const n = s.length
  if (!n) return 0
  return n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2
}

const has = (v: number | undefined | null): v is number => v !== undefined && v !== null

/** Whether `p` was away (left or idled) for much of the game. Needs levels and gold. */
export function isAfk(match: Pick<Match, 'duration' | 'participants'>, p: Participant) {
  const others = match.participants.filter((o) => o !== p)
  if ((match.duration || 0) < 600 || !others.length) return false
  if (!has(p.champLevel) || !has(p.goldEarned)) return false
  const takedowns = (p.kills || 0) + (p.assists || 0)
  const teamKills = match.participants
    .filter((o) => o.teamId === p.teamId)
    .reduce((n, o) => n + (o.kills || 0), 0)
  if (takedowns >= 3 && takedowns >= 0.25 * teamKills) return false
  const level = median(others.map((o) => o.champLevel || 0))
  const gold = median(others.map((o) => o.goldEarned || 0))
  return p.champLevel <= level - 6 && p.goldEarned <= 0.65 * gold
}

type Figures = { standard: (number | null)[]; adjusted: (number | null)[] }

const scoreCache = new WeakMap<Match, Record<string, PlayerScore>>()

/** Every player's score and breakdown in one lobby. Empty for a remake; AFK players left out. */
export function scoreLobby(match: Match): Record<string, PlayerScore> {
  const cached = scoreCache.get(match)
  if (cached) return cached

  const result: Record<string, PlayerScore> = {}
  scoreCache.set(match, result)
  const ps = match.participants
  if (isRemake(match) || ps.length < 2) return result

  const minutes = matchMinutes(match)
  /* Roles only when every player has one: a lobby is read on one scale. */
  const laned = ps.every((p) => SCORE_ROLES.includes(p.position))
  const away = ps.map((p) => isAfk(match, p))
  const teamKills = new Map<number, number>()
  for (const p of ps) teamKills.set(p.teamId, (teamKills.get(p.teamId) ?? 0) + (p.kills || 0))
  /* A payload that does not carry a stat (an older cached list) drops the
     figures made from it for everyone rather than zeroing them, so a game
     scores the same wherever it is read. */
  const present = (read: (p: Participant) => number | undefined) => ps.some((p) => has(read(p)))
  const known = {
    damage: present((p) => p.totalDamageDealtToChampions),
    taken: present((p) => p.damageTaken),
    gold: present((p) => p.goldEarned),
    cs: present((p) => p.cs),
    vision: present((p) => p.visionScore),
    objectives: present((p) => p.damageDealtToObjectives),
  }
  const rate = (n: number | undefined) => (n || 0) / minutes

  const figures: Figures[] = ps.map((p) => {
    const tk = teamKills.get(p.teamId) || 0
    const kp = tk ? ((p.kills || 0) + (p.assists || 0)) / tk : 0
    const kda = Math.log(1 + ((p.kills || 0) + (p.assists || 0)) / Math.max(1, p.deaths || 0))
    const deaths = rate(p.deaths) * 10
    const damage = known.damage ? Math.log(Math.max(50, rate(p.totalDamageDealtToChampions))) : null
    const taken = known.taken ? Math.log(Math.max(50, rate(p.damageTaken))) : null
    const gold = known.gold ? Math.log(Math.max(1, p.goldEarned || 0) / minutes) : null
    const cs = known.cs ? rate(p.cs) : null
    const vision = known.vision ? rate(p.visionScore) : null
    const objectives = known.objectives
      ? Math.log(Math.max(20, rate(p.damageDealtToObjectives)))
      : null
    const r = SCORE_ROLES.indexOf(p.position)
    if (!laned) {
      const s = SPREAD[5]
      const raw = [kda, kp, -deaths, damage, taken, gold, cs, null, vision, objectives]
      return {
        standard: raw.map(() => null),
        adjusted: raw.map((v, k) => (v === null ? null : v / s[k])),
      }
    }
    const [s, pace, mean] = [SPREAD[r], PACE[r], ROLE_MEAN[r]]
    /* The KDA standard is a median-like ratio of sums; a game's ln(1 + KDA) averages 0.1 above it. */
    const kdaPace = Math.log(1 + pace[4])
    const j = ps.findIndex((o) => o.teamId !== p.teamId && o.position === p.position)
    const duel =
      known.gold && j >= 0 && !away[j]
        ? Math.log(Math.max(1, p.goldEarned || 0) / Math.max(1, ps[j].goldEarned || 0)) / s[7]
        : null
    const z = (v: number | null, ref: number, sd: number) => (v === null ? null : (v - ref) / sd)
    const goldZ = gold === null ? null : (gold - Math.log(pace[1])) / s[5]
    const csZ = z(cs, pace[0], s[6])
    const visionZ = z(vision, pace[3], s[8])
    const kpZ = (kp - pace[2]) / s[1]
    return {
      standard: [
        (kda - kdaPace - 0.1) / s[0],
        kpZ,
        null,
        null,
        null,
        goldZ,
        csZ,
        null,
        visionZ,
        null,
      ],
      adjusted: [
        (kda - kdaPace) / s[0],
        kpZ,
        (mean[2] - deaths) / s[2],
        z(damage, mean[0], s[3]),
        z(taken, mean[1], s[4]),
        goldZ,
        csZ,
        duel,
        visionZ,
        z(objectives, mean[3], s[9]),
      ],
    }
  })

  /* The lobby's average of each role-adjusted figure, AFK players left
     out; the lane duel is already a comparison. */
  const lobby = Array.from({ length: FIGURES }, (_, k) => {
    if (k === 7) return 0
    const v = figures
      .filter((__, i) => !away[i])
      .map((f) => f.adjusted[k])
      .filter(has)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0
  })

  ps.forEach((p, i) => {
    if (away[i]) return
    const w = WEIGHTS[laned ? SCORE_ROLES.indexOf(p.position) : 5]
    const f = figures[i]
    const part = Object.fromEntries(SCORE_CATEGORIES.map((c) => [c, [0, 0]])) as Record<
      ScoreCategory,
      [number, number]
    >
    for (let k = 0; k < FIGURES; k++) {
      const adjusted = f.adjusted[k]
      if (adjusted === null) continue
      const vsLobby = adjusted - lobby[k]
      const standard = f.standard[k]
      const x = Math.max(
        -3,
        Math.min(3.5, standard === null ? vsLobby : STANDARD * standard + (1 - STANDARD) * vsLobby)
      )
      part[PART_OF[k]][0] += w[k] * x
      part[PART_OF[k]][1] += w[k]
    }
    const total = SCORE_CATEGORIES.reduce((n, c) => n + part[c][1], 0)
    const sum = SCORE_CATEGORIES.reduce((n, c) => n + part[c][0], 0)
    const x = (total ? sum / total / SIGMA : 0) + (p.win ? RESULT : -RESULT)
    const categories = {} as Record<ScoreCategory, number>
    const weights = {} as Record<ScoreCategory, number>
    for (const c of SCORE_CATEGORIES) {
      const [s, weight] = part[c]
      categories[c] = weight ? Math.round(curve(s / weight / SIGMA)) : 0
      weights[c] = total ? Math.round((weight / total) * 100) : 0
    }
    result[p.puuid] = { score: Math.round(curve(x)), categories, weights }
  })
  return result
}

/* ── Earned badges ────────────────────────────────────────────────

   What the data says a player did best in one game, as the desktop app
   names it (the shared views label them). Only what the list payload can
   prove; first blood comes with the timeline's events. */

const BADGES: Array<{
  key: string
  read: (p: Participant) => number | undefined
  /** Below this the "most" is not worth a badge (an ARAM's vision score). */
  floor?: number
}> = [
  { key: 'carry_damage', read: (p) => p.totalDamageDealtToChampions },
  { key: 'objectives', read: (p) => p.damageDealtToObjectives },
  { key: 'vision', read: (p) => p.visionScore, floor: 10 },
  { key: 'tank', read: (p) => p.damageTaken },
]

/** Badge keys a player earned in a game: the most of a stat, or no deaths in 15 minutes or more. */
function earnedBadges(match: Match, p: Participant): string[] {
  if (isRemake(match)) return []
  const earned: string[] = []
  for (const badge of BADGES) {
    const mine = badge.read(p)
    if (mine !== undefined && mine !== null && mine > (badge.floor ?? 0)) {
      const best = Math.max(...match.participants.map((o) => badge.read(o) ?? 0))
      if (mine >= best) earned.push(badge.key)
    }
  }
  if (p.deaths === 0 && (match.duration || 0) >= 900) earned.push('deathless')
  return earned
}

/**
 * A stored match as the shared views read it (`@invadelol/ui`), with the site's own scores, what
 * they are made of, and badges: the lobby's ranks, MVP and ACE follow from the scores.
 */
export function detailOf(match: Match) {
  const scored = scoreLobby(match)
  return fromCoreMatch(match, {
    scores: Object.fromEntries(Object.entries(scored).map(([puuid, s]) => [puuid, s.score])),
    parts: scored,
    badges: Object.fromEntries(match.participants.map((p) => [p.puuid, earnedBadges(match, p)])),
  })
}
