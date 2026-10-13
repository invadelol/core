import type { LpPoint, MatchSummary, ScoreRow } from '@invadelol/ui/logic'

/**
 * The /app page's sample player, made up: Kestrel, a jungler in Emerald II. The story's app and
 * invade.lol screens read from here, so they agree with each other. Games are placed against the
 * visitor's clock: the last one ended a few minutes ago.
 */
export const DEMO = {
  name: 'Kestrel',
  tag: 'IVD',
  icon: 4834,
  now: typeof window === 'undefined' ? Date.UTC(2026, 9, 5, 21, 40) : Date.now() - 20 * 60_000,
}

/** Champions the sample player plays, with the names the mockups print. */
export const CHAMPS = {
  leeSin: 64,
  vi: 254,
  xinZhao: 5,
  viego: 234,
  sejuani: 113,
} as const

const HOUR = 3_600_000
const DAY = 24 * HOUR

let id = 0
/** One of the sample player's games, as the shared match row reads it. */
function game(
  championId: number,
  win: boolean,
  [kills, deaths, assists]: [number, number, number],
  minutes: number,
  score: number,
  rank: number,
  agoHours: number,
  queueId = 420,
  tag: ScoreRow['tag'] = ''
): MatchSummary {
  const gameId = 7_400_000_000 + ++id
  const duration = Math.round(minutes * 60)
  const cs = Math.round(minutes * 6.2)
  return {
    gameId,
    matchId: null,
    creation: DEMO.now - agoHours * HOUR,
    duration,
    queueId,
    mapId: 11,
    championId,
    win,
    remake: false,
    kills,
    deaths,
    assists,
    cs,
    csMin: cs / minutes,
    gold: Math.round(minutes * 430),
    damage: Math.round(minutes * 820),
    vision: Math.round(minutes * 1.3),
    level: 15,
    items: [6692, 3047, 3071, 6333, 3053, 0, 3364],
    spells: [4, 11],
    keystone: 8010,
    primaryStyle: 8000,
    subStyle: 8400,
    lane: 'JUNGLE',
    placement: 0,
    score: { gameId, score, rank, tag, kp: 0.64 },
  }
}

/** Home's match history, newest first, with the LP each ranked game moved. */
export const HOME_GAMES: Array<{ game: MatchSummary; lp: number | null }> = [
  { game: game(CHAMPS.leeSin, true, [11, 2, 15], 31.2, 8.1, 1, 0.4, 420, 'mvp'), lp: 24 },
  { game: game(CHAMPS.vi, false, [4, 6, 9], 28.1, 5.1, 4, 2), lp: -16 },
  { game: game(CHAMPS.leeSin, true, [8, 3, 12], 26.4, 7.4, 2, 20, 420), lp: 21 },
  { game: game(CHAMPS.xinZhao, true, [6, 4, 14], 33.9, 6.6, 3, 22, 440), lp: 19 },
  { game: game(CHAMPS.leeSin, false, [5, 7, 6], 35.3, 4.6, 6, 25), lp: -15 },
  { game: game(CHAMPS.viego, true, [9, 5, 8], 29.6, 6.9, 2, 46), lp: 22 },
  { game: game(CHAMPS.leeSin, true, [12, 4, 10], 24.8, 7.9, 1, 48, 420, 'mvp'), lp: 23 },
  { game: game(CHAMPS.vi, false, [3, 5, 11], 32.2, 5.6, 5, 70, 400), lp: null },
  { game: game(CHAMPS.leeSin, true, [7, 2, 13], 27.5, 7.2, 2, 72), lp: 20 },
  { game: game(CHAMPS.sejuani, false, [2, 6, 9], 30.4, 4.9, 7, 96, 440), lp: -14 },
]

/** Continuous ladder value of a rank (Iron IV 0 LP = 0, +100 a division). */
const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND']
const DIVS = ['IV', 'III', 'II', 'I']

/** The LP history: one point per change over the last weeks, ending on Emerald II 64 LP. */
export const LP_POINTS: LpPoint[] = (() => {
  const steps = [
    18, -15, 21, 19, -16, 22, -14, -17, 20, 23, -15, 19, 21, -16, 22, -14, 20, 24, -16, 21, 23, -15,
    19, 22, -16, 24,
  ]
  const end = 5 * 400 + 2 * 100 + 64
  let value = end - steps.reduce((a, b) => a + b, 0)
  let wins = 61 - steps.filter((s) => s > 0).length
  let losses = 52 - steps.filter((s) => s < 0).length
  const points: LpPoint[] = []
  const push = (t: number) => {
    const tier = TIERS[Math.floor(value / 400)]
    const division = DIVS[Math.floor((value % 400) / 100)]
    points.push({ t, queue: 'solo', tier, division, lp: value % 100, wins, losses, value })
  }
  push(DEMO.now - 34 * DAY)
  steps.forEach((s, i) => {
    value += s
    if (s > 0) wins++
    else losses++
    push(DEMO.now - (33 - i * 1.25) * DAY)
  })
  return points
})()

/** The LP line the profile draws: one value per change. */
export const LP_VALUES = LP_POINTS.map((p) => p.value)
