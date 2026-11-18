import {
  C,
  H,
  PAD,
  W,
  compact,
  cover,
  figure,
  fit,
  foot,
  heading,
  maybe,
  measure,
  perch,
  portrait,
  render,
  stage,
  text,
  type Mood,
  type Pic,
} from '#services/og/kit'
import { packBubbles } from '../../../inertia/lib/bubble_pack.js'

/**
 * The link previews of one player's game (`/og/match/…`) and of a player's champion mastery
 * (`/og/mastery/…`).
 */

type Bytes = Uint8Array | Buffer | null | undefined

/* ── A game ────────────────────────────────────────────────────────────────────────────────── */
export interface MatchCard {
  gameName: string | null
  champion: string | null
  win: boolean
  /** "Ranked Solo", "ARAM". */
  queue: string
  /** Seconds. */
  duration: number
  kills: number
  deaths: number
  assists: number
  /** Invade score, 0 to 100. */
  score: number
  tag: 'MVP' | 'ACE' | ''
  splash: Bytes
  icon: Bytes
}

/** The rocker for an MVP, cheeky for a big win, a ghost for a game of many deaths, asleep after a loss. */
export function matchMood(card: Pick<MatchCard, 'win' | 'score' | 'tag' | 'deaths'>): Mood {
  if (card.tag === 'MVP') return 'rocker'
  if (card.win) return card.score >= 60 || card.tag === 'ACE' ? 'cheeky' : 'peace'
  if (card.tag === 'ACE') return 'peace'
  return card.deaths >= 10 ? 'ghost' : 'snoozy'
}

const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * `/og/match/<id>/<Name-Tag>.jpg`: the result huge in its colour over the champion's splash, the
 * player and the champion, the K/D/A, and the Invade score with the poro reacting to the game.
 */
export async function matchCard(card: MatchCard) {
  const [art, icon] = await Promise.all([maybe(card.splash, 1500), maybe(card.icon, 200)])
  const base = stage({ art, box: { x: 340, y: 0, w: W - 340, h: H }, fadeLeft: 0.55 })
  let body = base.svg
  const head = heading([[card.win ? 'Victory' : 'Defeat', card.win ? C.win : C.loss]], null, {
    room: 700,
    max: 132,
    min: 80,
    lines: 1,
  })
  body += head.svg
  // Who played what: the champion's portrait, the player, the champion in violet.
  const y = head.bottom + 34
  body += portrait(icon, PAD, y, 84, 16)
  const tx = PAD + 106
  if (card.gameName) {
    const n = fit('display', card.gameName, 560, 44, 28, -0.02)
    body += text('display', n.text, C.text1, n.size, tx, y + 38, { tracking: -0.02 })
  }
  const line = [card.champion, card.queue, clock(card.duration)].filter(Boolean) as string[]
  let cx = tx
  line.forEach((part, i) => {
    const value = i < line.length - 1 ? `${part},` : part
    body += text('kicker', value, i === 0 && card.champion ? C.violet : C.text2, 30, cx, y + 80)
    cx += measure('kicker', value, 30) + measure('kicker', ' ', 30)
  })
  // The K/D/A, its slashes quiet.
  const size = 120
  const kb = 528
  let kx = PAD
  for (const [i, part] of [card.kills, card.deaths, card.assists].entries()) {
    const v = String(part)
    body += text('figure', v, C.text1, size, kx, kb, { tracking: -0.03 })
    kx += measure('figure', v, size, -0.03)
    if (i < 2) {
      body += text('figure', '/', C.text3, size * 0.7, kx + 6, kb, { tracking: -0.03 })
      kx += measure('figure', '/', size * 0.7) + 12
    }
  }
  // The score, gold from 80 as the dial is, the MVP or ACE above it.
  const ss = 168
  const fig = figure(String(card.score), '', W - PAD, kb, ss, {
    anchor: 'end',
    fill: card.score >= 80 ? C.gold : C.text1,
  })
  body += fig.svg
  if (card.tag)
    body += text(
      'display',
      card.tag,
      card.tag === 'MVP' ? C.gold : C.violet,
      40,
      fig.left - 24,
      kb - 6,
      { anchor: 'end' }
    )
  body += await perch(matchMood(card), fig, kb, ss, 146, { at: 0.5 })
  body += foot('Invade score, out of 100')
  return render(base.defs, body)
}

/* ── Mastery ───────────────────────────────────────────────────────────────────────────────── */
export interface MasteryCardEntry {
  championId: number
  championPoints: number
  name: string
}

export type MasteryArt = (kind: 'splash' | 'champion', id: number) => Promise<Bytes>

/** Circles drawn: the tail past this is a few pixels wide at Discord's size. */
const POOL_MAX = 90
/** Circles at least this wide wear their splash, the rest their portrait. */
const POOL_ART = 120

/**
 * `/og/mastery/<Name-Tag>.jpg`: the player's name and their total points on the left, the poro
 * in love perched on it; on the right the Mastery tab's pool, every champion a circle whose area
 * is its points (`packBubbles`, as the page packs it).
 */
export async function masteryCard(
  player: { gameName: string; tagLine: string },
  pool: MasteryCardEntry[],
  art: MasteryArt
) {
  const top = pool
    .filter((m) => m.championPoints > 0)
    .sort((a, b) => b.championPoints - a.championPoints)
  const shown = top.slice(0, POOL_MAX)
  const total = top.reduce((a, m) => a + m.championPoints, 0)
  const box = { x: 560, y: 34, w: W - 560 - 34, h: H - 68 }
  const layout = packBubbles(
    shown.map((m) => ({ id: m.championId, value: m.championPoints })),
    { width: box.w, aspect: box.w / box.h, gap: 4, minRadius: 8 }
  )
  const k = Math.min(1, box.h / Math.max(1, layout.height))
  const bubbles = layout.bubbles.map((b) => ({
    id: b.id,
    x: box.x + box.w / 2 + (b.x - box.w / 2) * k,
    y: box.y + box.h / 2 + (b.y - layout.height / 2) * k,
    r: b.r * k,
  }))
  const pics = await Promise.all(
    bubbles.map(async (b) => {
      const big = b.r * 2 >= POOL_ART
      const bytes = await art(big ? 'splash' : 'champion', b.id)
      return maybe(bytes, big ? Math.round(b.r * 4) : Math.max(48, Math.round(b.r * 2.4)))
    })
  )
  const base = stage()
  let body = base.svg
  bubbles.forEach((b, i) => {
    const p = pics[i] as Pic | null
    const clip = `m${i}`
    body += `<clipPath id="${clip}"><circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${b.r.toFixed(1)}"/></clipPath><circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${b.r.toFixed(1)}" fill="#221f31"/>`
    if (p) {
      const d = b.r * 2
      const over = b.r * 2 >= POOL_ART ? 1 : 1.12
      const s = d * over
      body += `<g clip-path="url(#${clip})">${cover(p, b.x - s / 2, b.y - s / 2, s, s, { fx: 0.5, fy: b.r * 2 >= POOL_ART ? 0.3 : 0.5 })}</g>`
    }
    body += `<circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${(b.r - 0.5).toFixed(1)}" fill="none" stroke="#fff" stroke-opacity="0.1"/>`
  })
  const head = heading([[player.gameName, C.text1]], [[`#${player.tagLine}`, C.violet]], {
    room: 470,
    max: 92,
    min: 48,
  })
  body += head.svg
  if (top.length) {
    const lead = top[0]
    body += text(
      'kicker',
      `${top.length} champions, ${lead.name} first`,
      C.text2,
      30,
      PAD,
      head.bottom + 54
    )
    const size = 150
    const fig = figure(compact(total), '', PAD, 528, size)
    body += fig.svg
    body += await perch('love', fig, 528, size, 140, { at: 0.55 })
  }
  body += foot('Mastery points', { right: 520 })
  return render(base.defs, body)
}
