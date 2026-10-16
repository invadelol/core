import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { GLYPHS, GRAIN_PNG } from '#services/match_card_glyphs'

/**
 * The share card of one player's game, as a social link preview shows it (`/og/match/…`).
 *
 * The champion's centred splash is the stage, dimmed and desaturated like the app's game frames,
 * lit by the window's violet light, under the site's grain, with the ink rising under the row.
 * Over it sits one invade.lol match row at poster size: the 3px result edge and the result tint,
 * the result in --win or --loss with the queue and the length in --text-3, the K/D/A in the
 * figure style, the PerfDial (gold from 80, its glow only at 80 and 90+, MVP or ACE in its
 * opening), and the Invade mark where the row's chevron sits.
 *
 * The card is laid out at 2x of 600 by 315, so every token of @invadelol/ui doubles. Type is
 * Archivo outlines (`match_card_glyphs`), so the server needs no font. Nothing the player wrote is
 * drawn: the Riot ID and the champion's name live in the page's meta tags, not in the picture.
 */
export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630

/** Bump on any change to how the card is drawn: every `?v=` changes, so shared images refresh. */
export const RENDERER = 1

export interface MatchCard {
  championId: number
  win: boolean
  /** The queue as the match row names it ("Ranked Solo", "ARAM"). */
  queue: string
  /** Seconds. */
  duration: number
  kills: number
  deaths: number
  assists: number
  /** Invade score, 0 to 100. */
  score: number
  tag: 'MVP' | 'ACE' | ''
}

/** A short hash of everything the card draws and of the renderer: the image URL's `v`. */
export function matchCardVersion(card: MatchCard) {
  const drawn = [
    RENDERER,
    card.championId,
    card.win ? 1 : 0,
    card.queue,
    Math.round(card.duration),
    card.kills,
    card.deaths,
    card.assists,
    card.score,
    card.tag,
  ]
  return createHash('sha256').update(JSON.stringify(drawn)).digest('base64url').slice(0, 10)
}

const W = CARD_WIDTH
const H = CARD_HEIGHT
/** The card is drawn at 2x. */
const X = 2

/* ── Tokens (@invadelol/ui tokens.css, dark) ───────────────────────────────────────────────── */
const T = {
  ink1: '#0d0e13',
  text1: '#ececf3',
  text2: '#a6a7b8',
  text3: '#6f7085',
  text4: '#4a4b5c',
  brand: '#7b6dff',
  win: '#4c9bff',
  winRgb: '76,155,255',
  loss: '#ff5d6e',
  lossRgb: '255,93,110',
  gold: '#e2b25a',
  scoreGold: '236,193,106',
  scorePeak: '252,216,136',
  glow: 0.55,
  track: 'rgba(255,255,255,0.07)',
}

const GRAIN = Buffer.from(GRAIN_PNG, 'base64')

/* ── Type ──────────────────────────────────────────────────────────────────────────────────── */
type Face = keyof typeof GLYPHS
/** Text in one colour. A run may take its own `face` (the K/D/A's quiet slashes), and `pad` em of
 *  air on each side. */
type Run = { text: string; fill: string; face?: Face; pad?: number }

const glyphsOf = (face: Face) => GLYPHS[face].glyphs as Record<string, readonly [number, string]>

/** The width `runs` take in `face` at `size` px with `tracking` em between letters. */
function measure(face: Face, runs: Run[], size: number, tracking = 0) {
  const units = GLYPHS[face].units
  let advance = 0
  let count = 0
  for (const run of runs) {
    const glyphs = glyphsOf(run.face ?? face)
    advance += (run.pad ?? 0) * 2 * units
    for (const char of run.text) {
      const glyph = glyphs[char]
      if (!glyph) continue
      advance += glyph[0] + tracking * units
      count++
    }
  }
  return ((advance - (count ? tracking * units : 0)) * size) / units
}

/** `runs` as SVG paths in one group, from `x` (or centred on it, or ending on it) on `baseline`. */
function setType(
  face: Face,
  runs: Run[],
  size: number,
  x: number,
  baseline: number,
  {
    anchor = 'start',
    tracking = 0,
  }: { anchor?: 'start' | 'middle' | 'end'; tracking?: number } = {}
) {
  const units = GLYPHS[face].units
  const width = measure(face, runs, size, tracking)
  const x0 = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x
  let advance = 0
  const paths: string[] = []
  for (const run of runs) {
    const glyphs = glyphsOf(run.face ?? face)
    advance += (run.pad ?? 0) * units
    for (const char of run.text) {
      const glyph = glyphs[char]
      if (!glyph) continue
      if (glyph[1]) {
        paths.push(`<path transform="translate(${advance} 0)" fill="${run.fill}" d="${glyph[1]}"/>`)
      }
      advance += glyph[0] + tracking * units
    }
    advance += (run.pad ?? 0) * units
  }
  const scale = size / units
  return {
    svg: `<g transform="translate(${x0.toFixed(1)} ${baseline}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})">${paths.join('')}</g>`,
    width,
  }
}

/** `32:18`. */
function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** `.iv-fig`'s engraved mask (#000 35% to 0.74 at the bottom of the line box), in glyph units. */
const ENGRAVE = `<linearGradient id="engrave" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="880" y2="-120">
  <stop offset="0.35" stop-color="${T.text1}"/><stop offset="1" stop-color="${T.text1}" stop-opacity="0.74"/></linearGradient>`

/** The match row's K/D/A: figures, and the slash at weight 400 in --text-4 with 4px either side. */
function kdaRuns(card: MatchCard, size: number): Run[] {
  const slash: Run = { text: '/', fill: T.text4, face: 'thin', pad: (4 * X) / size }
  const figure = (n: number): Run => ({ text: String(n), fill: 'url(#engrave)' })
  return [figure(card.kills), slash, figure(card.deaths), slash, figure(card.assists)]
}

/* ── The Invade mark (@invadelol/ui Logo, 155 by 170) ──────────────────────────────────────── */
const LOGO =
  'M140.32,114.78l66.57-52.4-84.5,29.38,18.32-28.35-30.09,17.83,39.13-56.71-79.86,45.07-7.92,13.62.91,24.19,31.05,8.35,9.9,22.32,25.04,9.9-8.54,18.83-36.29.19v8.54l67.35,14.75-21.54-28.53,71.03-44.25-60.55-2.72ZM73.47,105.37l14.19-27.76,4.98,27.76h-19.17Z'
function mark(x: number, y: number, height: number) {
  return `<g transform="translate(${x} ${y}) scale(${height / 170}) translate(-54 -22)" fill="${T.brand}"><path d="${LOGO}"/><polygon points="55.54 130.51 73.97 130.39 85.04 143.21 66.99 144.45 55.54 130.51"/></g>`
}

/* ── PerfDial, as the component draws it (48px box, stroke 2.8, number 15px/750, place 9px/700) ─ */
const STOPS: [number, number[]][] = [
  [12, [255, 93, 110]],
  [42, [134, 124, 200]],
  [76, [76, 155, 255]],
]
function dialRgb(score: number) {
  if (score >= 90) return T.scorePeak
  if (score >= 80) return T.scoreGold
  if (score <= STOPS[0][0]) return STOPS[0][1].join(',')
  if (score >= STOPS[2][0]) return STOPS[2][1].join(',')
  const [[a, ca], [b, cb]] = score < STOPS[1][0] ? [STOPS[0], STOPS[1]] : [STOPS[1], STOPS[2]]
  const t = (score - a) / (b - a)
  return ca.map((v, i) => Math.round(v + (cb[i] - v) * t)).join(',')
}

/** The dial at `d` px (the component's 48px box scaled), centred on (cx, cy). */
function dial(score: number, cx: number, cy: number, d: number, tag: MatchCard['tag']) {
  const px = d / 48 // one CSS px of the component
  const k = d / 40 // the 40-unit viewBox
  const R = 15
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180
    return `${(20 + R * Math.cos(a)).toFixed(2)} ${(20 + R * Math.sin(a)).toFixed(2)}`
  }
  const path = `M${at(145)}A${R} ${R} 0 1 1 ${at(395)}`
  const full = (250 / 360) * 2 * Math.PI * R
  const len = (Math.max(3, Math.min(100, score)) / 100) * full
  const c = dialRgb(score)
  const level = score >= 90 ? 'peak' : score >= 80 ? 'gold' : ''
  const local = (v: number) => (v * px) / k // CSS px to viewBox units
  const arc = `<path d="${path}" fill="none" stroke="rgb(${c})" stroke-width="2.8" stroke-linecap="round" stroke-dasharray="${len.toFixed(2)} ${full.toFixed(2)}"/>`
  const track = `<path d="${path}" fill="none" stroke="${level === 'peak' ? `rgba(${c},0.16)` : T.track}" stroke-width="2.8"/>`
  // drop-shadow(0 0 1.6px c / 0.55) from 80; + drop-shadow(0 0 5px c / 0.385) from 90. A CSS
  // blur radius is two standard deviations.
  const glow = (radius: number, alpha: number, id: string) =>
    `<filter id="${id}" filterUnits="userSpaceOnUse" x="-20" y="-20" width="80" height="80"><feGaussianBlur stdDeviation="${local(radius / 2).toFixed(3)}"/></filter><g opacity="${alpha}" filter="url(#${id})">${arc}</g>`
  let ring = track
  if (level) ring += glow(1.6, T.glow, 'dg1')
  if (level === 'peak') ring += glow(5, T.glow * 0.7, 'dg2')
  ring += arc

  const size = 15 * px
  // `b`: centred, margin-top -3px; at line-height 1 the cap block sits ~0.36em under the centre.
  const baseline = cy - (3 * px) / 2 + size * 0.345
  const number = setType(
    'dial',
    [{ text: String(score), fill: level ? `rgb(${c})` : T.text1 }],
    size,
    cx,
    baseline,
    { anchor: 'middle', tracking: -0.01 }
  )
  let numberGlow = ''
  if (level) {
    const blur = (level === 'peak' ? 10 : 8) * px
    const alpha = level === 'peak' ? T.glow : T.glow * 0.6
    numberGlow = `<filter id="tg" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><feGaussianBlur stdDeviation="${(blur / 2).toFixed(2)}"/></filter><g opacity="${alpha}" filter="url(#tg)">${number.svg}</g>`
  }
  let place = ''
  if (tag) {
    const ps = 9 * px
    place = setType(
      'place',
      [{ text: tag, fill: tag === 'MVP' ? T.gold : T.text2 }],
      ps,
      cx,
      cy + d / 2 - 2 * px - ps * 0.12,
      { anchor: 'middle' }
    ).svg
  }
  return `<g transform="translate(${cx - d / 2} ${cy - d / 2}) scale(${k})">${ring}</g>${numberGlow}${number.svg}${place}`
}

/* ── Materials ─────────────────────────────────────────────────────────────────────────────── */
/** --light: 90% 75% at 75% -15%, the bell falloff, over the card. `gain` multiplies it. */
function light(gain: number) {
  const a = [0.06, 0.058, 0.0525, 0.0443, 0.0349, 0.0256, 0.0172, 0.0105, 0.0055, 0.0021, 0]
  const stops = a
    .map(
      (v, i) =>
        `<stop offset="${i / 10}" stop-color="${T.brand}" stop-opacity="${(v * gain).toFixed(4)}"/>`
    )
    .join('')
  return {
    def: `<radialGradient id="light" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${W * 0.75} ${-H * 0.15}) scale(${W * 0.9} ${H * 0.75})">${stops}</radialGradient>`,
    rect: `<rect width="${W}" height="${H}" fill="url(#light)"/>`,
  }
}

/** A match row (.iv-mr) at 2x: surface-1 on the ink, the tint to 45%, the 3px edge, the lit top
 *  line, --row's short shadow, r-sm. */
function row(x: number, y: number, w: number, h: number, win: boolean, r = 5 * X) {
  const rgb = win ? T.winRgb : T.lossRgb
  return `<defs>
    <clipPath id="rowclip"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>
    <linearGradient id="rowtint" gradientUnits="userSpaceOnUse" x1="${x}" x2="${x + w * 0.45}" y1="0" y2="0"><stop offset="0" stop-color="rgb(${rgb})" stop-opacity="0.15"/><stop offset="1" stop-color="rgb(${rgb})" stop-opacity="0"/></linearGradient>
    <filter id="rowshadow" x="-5%" y="-20%" width="110%" height="150%"><feGaussianBlur stdDeviation="${X}"/></filter>
  </defs>
  <rect x="${x}" y="${y + X}" width="${w}" height="${h}" rx="${r}" fill="#000" opacity="0.3" filter="url(#rowshadow)"/>
  <g clip-path="url(#rowclip)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${T.ink1}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(190,190,255,0.04)"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#rowtint)"/>
    <rect x="${x}" y="${y}" width="${w}" height="${X}" fill="rgba(255,255,255,0.06)"/>
    <rect x="${x}" y="${y}" width="${3 * X}" height="${h}" fill="${win ? T.win : T.loss}"/>
  </g>`
}

/** Everything over the art, as one SVG. */
export function cardOverlay(card: MatchCard) {
  const L = light(3)
  // The ink rises at the bottom of the stage, so the row sits on the ground, not on paint.
  let svg = `<defs>${ENGRAVE}${L.def}
    <linearGradient id="floor" x1="0" x2="0" y1="0" y2="1"><stop offset="0.45" stop-color="${T.ink1}" stop-opacity="0"/><stop offset="0.86" stop-color="${T.ink1}" stop-opacity="0.92"/></linearGradient>
  </defs>`
  svg += `<rect width="${W}" height="${H}" fill="url(#floor)"/>${L.rect}`
  // The row: 24px from the sides and the bottom, 96px tall (at 1x), so X's domain label (bottom
  // left) lands under the game column, not on it.
  const rx = 24 * X
  const rw = W - 48 * X
  const rh = 96 * X
  const ry = H - 24 * X - rh
  svg += row(rx, ry, rw, rh, card.win)
  const cy = ry + rh / 2
  const pad = rx + 24 * X

  // Game column, as the row's: the result in its colour (the match header's word), then the
  // queue and the length in --text-3.
  const result = card.win ? 'Victory' : 'Defeat'
  svg += setType(
    'title',
    [{ text: result, fill: card.win ? T.win : T.loss }],
    26 * X,
    pad,
    cy - 2 * X,
    { tracking: -0.015 }
  ).svg
  const meta: Run[] = [
    { text: card.queue, fill: T.text3 },
    { text: '  ·  ', fill: T.text4 },
    { text: clock(card.duration), fill: T.text3 },
  ]
  svg += setType('label', meta, 14 * X, pad, cy + 20 * X).svg

  // The Invade mark where the row's chevron sits, then the score column left of it.
  const markHeight = 18 * X
  const markX = rx + rw - 24 * X - (markHeight * 155) / 170
  svg += mark(markX, cy - markHeight / 2, markHeight)
  const d = 76 * X
  const dx = markX - 24 * X - d / 2
  svg += dial(card.score, dx, cy, d, card.tag)

  // K/D/A column: from 192px to 24px short of the dial, shrunk to fit a long line.
  const kx = rx + 192 * X
  let size = 56 * X
  while (
    measure('fig', kdaRuns(card, size), size, -0.01) > dx - d / 2 - 24 * X - kx &&
    size > 36 * X
  )
    size -= X
  svg += setType('fig', kdaRuns(card, size), size, kx, cy + (size * 0.686) / 2, {
    tracking: -0.01,
  }).svg
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>`
}

/**
 * The card as a 1200 by 630 JPEG (mozjpeg, q90). Without `artwork` (the art unavailable for now)
 * the stage is the bare ink: still a readable card, not one worth keeping.
 *
 * The game stage: the app's Overlays stage is `brightness(0.42) saturate(0.75)` behind a widget;
 * here the art is the subject, so it is dimmed less (0.7, saturation 0.82). Riot's centred splash
 * has the face on its vertical midline, so it is covered at 1200 by 675 and its top 16px cut: the
 * face lands above the row for every champion, with no per-champion data.
 */
export async function renderMatchCard(card: MatchCard, artwork?: Uint8Array) {
  const stage = artwork
    ? sharp(artwork)
        .resize(W, 675)
        .extract({ left: 0, top: 16, width: W, height: H })
        .modulate({ brightness: 0.7, saturation: 0.82 })
    : sharp({ create: { width: W, height: H, channels: 3, background: T.ink1 } })
  return stage
    .composite([
      { input: GRAIN, tile: true, blend: 'over' },
      { input: Buffer.from(cardOverlay(card)) },
    ])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer()
}
