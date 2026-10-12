import type { LpPoint, MatchSummary, PlayerCard, ProfileView, ScoreRow } from '@invadelol/ui/logic'

/**
 * The /app page's sample player, made up: Kestrel, a jungler in Emerald II. Every mockup on the
 * page (Home, the profile, the clips, invade.lol) reads from here, so they agree with each other.
 * The views with dates are drawn in the browser only, so the games are placed against the
 * visitor's clock: the last one ended a few minutes ago.
 */
export const DEMO = {
  name: 'Kestrel',
  tag: 'IVD',
  icon: 4834,
  now: typeof window === 'undefined' ? Date.UTC(2026, 9, 5, 21, 40) : Date.now() - 20 * 60_000,
}

/** "Today", "Yesterday", or the weekday, as the match list heads its days. */
export function dayLabel(ms: number) {
  const day = (t: number) => new Date(t).toDateString()
  if (day(ms) === day(Date.now())) return 'Today'
  if (day(ms) === day(Date.now() - 86_400_000)) return 'Yesterday'
  return new Date(ms).toLocaleDateString('en-US', { weekday: 'long' })
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
  { game: game(CHAMPS.leeSin, true, [11, 2, 15], 31.2, 8.7, 1, 1, 420, 'mvp'), lp: 24 },
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

function rank(tier: string, division: string, lp: number, wins: number, losses: number) {
  return { tier, division, lp, wins, losses, provisional: false, previous: 'PLATINUM' }
}

export const SOLO = rank('EMERALD', 'II', 64, 61, 52)
export const FLEX = rank('PLATINUM', 'I', 12, 14, 11)

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

/** The values Home's LP line draws (the last 30 days). */
export const LP_VALUES = LP_POINTS.map((p) => p.value)

export const CARD: PlayerCard = {
  puuid: 'demo-you',
  gameName: DEMO.name,
  tagLine: DEMO.tag,
  icon: DEMO.icon,
  level: 286,
  private: false,
  solo: SOLO,
  flex: FLEX,
  recent: {
    games: 20,
    wins: 12,
    kills: 168,
    deaths: 82,
    assists: 231,
    cs: 3610,
    seconds: 20 * 29 * 60,
    results: HOME_GAMES.map((g) => g.game.win),
    streak: 1,
    lanes: [['JUNGLE', 18], ['TOP', 2]],
    champions: [
      { championId: CHAMPS.leeSin, games: 12, wins: 9, kills: 104, deaths: 38, assists: 121, cs: 2210, seconds: 12 * 29 * 60 },
      { championId: CHAMPS.vi, games: 5, wins: 2, kills: 31, deaths: 27, assists: 49, cs: 890, seconds: 5 * 30 * 60 },
    ],
    ranked: 15,
  },
  mastery: [
    { championId: CHAMPS.leeSin, championLevel: 38, championPoints: 412_000, lastPlayTime: DEMO.now },
    { championId: CHAMPS.vi, championLevel: 21, championPoints: 188_000, lastPlayTime: DEMO.now },
  ],
  offline: false,
}

export const PROFILE: ProfileView = {
  card: CARD,
  isSelf: false,
  isOwn: false,
  champions: [],
  lanes: [['JUNGLE', 18]],
  lp: LP_POINTS,
}

/** Home's Performance tile: the average score, then one line per figure against Diamond. */
export const PERF = {
  score: 68,
  wins: 12,
  losses: 8,
  against: 'vs Diamond · Jungle',
  metrics: [
    { label: 'CS/min', value: '6.1', gap: '+0.4', tone: 'up', base: 5.7, span: 2, values: [5.4, 5.9, 6.2, 5.6, 6.4, 6.0, 6.6, 5.8, 6.3, 6.1] },
    { label: 'KP', value: '71%', gap: '+9', tone: 'up', base: 62, span: 20, values: [64, 72, 68, 75, 61, 70, 78, 66, 73, 71] },
    { label: 'Vision/min', value: '1.32', gap: '+0.18', tone: 'up', base: 1.14, span: 0.6, values: [1.1, 1.3, 1.2, 1.4, 1.25, 1.36, 1.3, 1.42, 1.28, 1.32] },
    { label: 'KDA', value: '4.20', gap: '+1.10', tone: 'up', base: 3.1, span: 3, values: [3.1, 5.2, 3.8, 4.4, 2.6, 4.8, 5.5, 3.4, 4.6, 4.2] },
    { label: 'Gold/min', value: '431', gap: '−11', tone: '', base: 442, span: 60, values: [418, 440, 425, 452, 410, 436, 448, 422, 438, 431] },
  ],
}

/** Home's Champions tile. */
export const CHAMPION_ROWS = [
  { id: CHAMPS.leeSin, name: 'Lee Sin', record: '9W 3L', wr: '75%', kda: '4.61 KDA' },
  { id: CHAMPS.vi, name: 'Vi', record: '2W 3L', wr: '40%', kda: '2.95 KDA' },
  { id: CHAMPS.xinZhao, name: 'Xin Zhao', record: '1W 1L', wr: '50%', kda: '3.40 KDA' },
  { id: CHAMPS.viego, name: 'Viego', record: '1W 0L', wr: '100%', kda: '3.40 KDA' },
]

/** Clips, as Recordings files them: the frames are stills of Riot's own gameplay footage. */
export const CLIPS = [
  { title: 'Triple kill', meta: 'at 8:00', length: '0:24', img: '/landing/clip-kill.webp', kind: 'kill' },
  { title: 'Baron', meta: 'Objective · at 15:00', length: '0:33', img: '/landing/clip-baron.webp', kind: 'objective' },
  { title: 'Highlight', meta: 'Saved · at 22:00', length: '0:42', img: '/landing/clip-saved.webp', kind: 'saved' },
  { title: 'Double kill', meta: 'at 26:10', length: '0:24', img: '/landing/clip-death.webp', kind: 'kill' },
] as const
