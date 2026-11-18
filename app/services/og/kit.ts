import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { GLYPHS as HEAVY } from '#services/og/glyphs'
import { GLYPHS as LIGHT } from '#services/share_card_glyphs'
import { GRAIN_PNG } from '#services/match_card_glyphs'
import { ROLE_ICONS } from '#services/presence_card'

/**
 * What every link preview of invade.lol is made of (`/og/…`), so they read as one family: the
 * night ink (#1c1a27 to #14121d), a stage of real art (a champion's splash, a pro's photo, a
 * team's logo) faded into it from the left and the foot, one violet light from the top right and
 * the site's grain. Over it: a name set big in Sofia Sans 900, sentence case, with at most one
 * violet word, one large real figure, and a poro who reacts to it (perched on the figure,
 * peeking from an edge, holding the sign). The Invade mark and one quiet source line sit at the
 * foot.
 *
 * 1200 by 630, the size every platform crops least; type is large enough to read at Discord's
 * 400 px. Text is drawn from outlines (`og/glyphs.ts`, `share_card_glyphs.ts`), so the server needs
 * no font, and a letter the faces lack is left out.
 */
export const W = 1200
export const H = 630
export const PAD = 64
/** The foot's baseline: the mark on the left, the source on the right. */
export const FOOT = H - 50

export { RENDERER } from '#services/og/version'

export const C = {
  top: '#1c1a27',
  ink: '#14121d',
  text1: '#f4f3fa',
  text2: '#c3c1d4',
  text3: '#9290a8',
  violet: '#8f84ff',
  brand: '#7b6dff',
  win: '#5aa5ff',
  loss: '#ff6474',
  gold: '#e8bb62',
}

/** Rank tiers in their colour. */
export const TIER: Record<string, string> = {
  iron: '#a09aa2',
  bronze: '#c58b67',
  silver: '#b3bdca',
  gold: '#e2b65d',
  platinum: '#5cc7be',
  emerald: '#3fc985',
  diamond: '#7e98ff',
  master: '#c07cff',
  grandmaster: '#ff6670',
  challenger: '#f6d77f',
}

/* ── Type ──────────────────────────────────────────────────────────────────────────────────── */
const FACES = {
  display: HEAVY.display.glyphs,
  figure: HEAVY.figure.glyphs,
  kicker: LIGHT.kicker.glyphs,
  label: LIGHT.label.glyphs,
} as unknown as Record<Face, Record<string, readonly [number, string]>>
export type Face = 'display' | 'figure' | 'kicker' | 'label'

export function measure(face: Face, value: string, size: number, tracking = 0) {
  const glyphs = FACES[face]
  let advance = 0
  let count = 0
  for (const c of value) {
    const glyph = glyphs[c]
    if (!glyph) continue
    advance += glyph[0] + tracking * 1000
    count++
  }
  return ((advance - (count ? tracking * 1000 : 0)) * size) / 1000
}

/** Whether every letter of `value` can be drawn in `face`. */
export const drawable = (face: Face, value: string) => [...value].every((c) => FACES[face][c])

export function text(
  face: Face,
  value: string,
  fill: string,
  size: number,
  x: number,
  baseline: number,
  {
    anchor = 'start',
    tracking = 0,
  }: { anchor?: 'start' | 'middle' | 'end'; tracking?: number } = {}
) {
  const glyphs = FACES[face]
  const width = measure(face, value, size, tracking)
  const x0 = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x
  const paths: string[] = []
  let advance = 0
  for (const c of value) {
    const glyph = glyphs[c]
    if (!glyph) continue
    if (glyph[1]) paths.push(`<path transform="translate(${advance} 0)" d="${glyph[1]}"/>`)
    advance += glyph[0] + tracking * 1000
  }
  const s = size / 1000
  return `<g fill="${fill}" transform="translate(${x0.toFixed(1)} ${baseline.toFixed(1)}) scale(${s.toFixed(5)} ${(-s).toFixed(5)})">${paths.join('')}</g>`
}

/** The largest size from `max` down to `min` at which `value` fits `room`, then cut with an ellipsis. */
export function fit(
  face: Face,
  value: string,
  room: number,
  max: number,
  min: number,
  tracking = 0
) {
  let size = max
  while (size > min && measure(face, value, size, tracking) > room) size -= 2
  let t = value
  while (measure(face, t, size, tracking) > room && [...t].length > 1)
    t = [...t].slice(0, -2).join('').trimEnd() + '…'
  return { text: t, size }
}

/** A run of a title: its words and their colour. */
export type Run = [string, string]

/**
 * A title in `face` from runs of colour (the name in white, one word in violet), wrapped into at
 * most `lines` lines of `room`, as large as fits from `max` down to `min`. Returns the SVG, the
 * size, and the baseline of its last line. `top` is the first line's cap top.
 */
export function title(
  runs: Run[],
  x: number,
  top: number,
  room: number,
  {
    max,
    min,
    lines = 2,
    face = 'display' as Face,
    tracking = -0.025,
    leading = 0.98,
    anchor = 'start' as 'start' | 'end',
  }: {
    max: number
    min: number
    lines?: number
    face?: Face
    tracking?: number
    leading?: number
    anchor?: 'start' | 'end'
  }
) {
  const words = runs.flatMap(([value, fill]) =>
    value
      .split(' ')
      .filter(Boolean)
      .map((w) => ({ w, fill }))
  )
  const space = (size: number) => measure(face, ' ', size) + tracking * size
  const lay = (size: number) => {
    const out: { w: string; fill: string }[][] = [[]]
    let width = 0
    for (const word of words) {
      const ww = measure(face, word.w, size, tracking)
      const line = out[out.length - 1]
      if (line.length && width + space(size) + ww > room) {
        out.push([word])
        width = ww
      } else {
        width += (line.length ? space(size) : 0) + ww
        line.push(word)
      }
    }
    return out
  }
  let size = max
  let laid = lay(size)
  const fits = (l: typeof laid, s: number) =>
    l.length <= lines &&
    l.every((line) => line.reduce((a, w) => a + measure(face, w.w, s, tracking), 0) <= room * 1.001)
  while (size > min && !fits(laid, size)) {
    size -= 2
    laid = lay(size)
  }
  // Still too long at the smallest size: the last line is cut.
  if (laid.length > lines) {
    const kept = laid.slice(0, lines)
    kept[lines - 1].push(...laid.slice(lines).flat())
    laid = kept
  }
  const cap = 0.7 * size
  let svg = ''
  let baseline = top + cap
  laid.forEach((line, i) => {
    baseline = top + cap + i * size * leading
    const widths = line.map((w) => measure(face, w.w, size, tracking))
    const total = widths.reduce((a, b) => a + b, 0) + space(size) * (line.length - 1)
    let cx = anchor === 'end' ? x - Math.min(total, room) : x
    line.forEach((word, k) => {
      let value = word.w
      if (cx + widths[k] > x + room + 1 && anchor === 'start') {
        value = fit(face, value, x + room - cx, size, size, tracking).text
      }
      svg += text(face, value, word.fill, size, cx, baseline, { tracking })
      cx += widths[k] + space(size)
    })
  })
  return { svg, size, baseline, lines: laid.length }
}

/**
 * A figure set huge with its unit small beside it (`58` `%`, `1,204` ` LP`), as the posters set
 * them. Returns its width and the SVG. `x` is the left edge, or the right with `anchor: 'end'`.
 */
export function figure(
  value: string,
  unit: string,
  x: number,
  baseline: number,
  size: number,
  {
    fill = C.text1,
    unitFill = C.violet,
    anchor = 'start' as 'start' | 'end',
  }: { fill?: string; unitFill?: string; anchor?: 'start' | 'end' } = {}
) {
  const tracking = -0.03
  const us = size * 0.4
  const vw = measure('figure', value, size, tracking)
  const gap = unit ? size * 0.015 : 0
  const uw = unit ? measure('display', unit, us, -0.01) : 0
  const width = vw + gap + uw
  const x0 = anchor === 'end' ? x - width : x
  let svg = text('figure', value, fill, size, x0, baseline, { tracking })
  if (unit) svg += text('display', unit, unitFill, us, x0 + vw + gap, baseline, { tracking: -0.01 })
  return { svg, width, left: x0 }
}

/* ── Pictures ──────────────────────────────────────────────────────────────────────────────── */
export interface Pic {
  href: string
  w: number
  h: number
}

/**
 * Bytes as a data URI at most `max` px on their long side: JPEG for a photo (smaller, faster to
 * embed), PNG when transparency matters. `trim` cuts an emblem's empty frame to its crest.
 */
export async function pic(
  bytes: Uint8Array | Buffer,
  max: number,
  { alpha = false, trim = false }: { alpha?: boolean; trim?: boolean } = {}
): Promise<Pic> {
  let image = sharp(bytes)
  if (trim) image = sharp(await image.trim().toBuffer())
  image = image.resize(max, max, { fit: 'inside', withoutEnlargement: true })
  const out = alpha
    ? await image.png().toBuffer({ resolveWithObject: true })
    : await image.flatten({ background: C.ink }).jpeg({ quality: 90 }).toBuffer({
        resolveWithObject: true,
      })
  return {
    href: `data:image/${alpha ? 'png' : 'jpeg'};base64,${out.data.toString('base64')}`,
    w: out.info.width,
    h: out.info.height,
  }
}

/** Bytes as a picture or null, for art that may be missing. */
export async function maybe(
  bytes: Uint8Array | Buffer | null | undefined,
  max: number,
  opts?: Parameters<typeof pic>[2]
) {
  if (!bytes) return null
  try {
    return await pic(bytes, max, opts)
  } catch {
    return null
  }
}

let ids = 0
const id = (prefix: string) => `${prefix}${++ids}`

/**
 * An image covering a box, clipped to it (with corner `radius`), its point (`fx`, `fy`) kept in
 * view: a splash's face sits around (0.5, 0.3).
 */
export function cover(
  image: Pic,
  x: number,
  y: number,
  w: number,
  h: number,
  { fx = 0.5, fy = 0.3, radius = 0, opacity = 1 } = {}
) {
  const scale = Math.max(w / image.w, h / image.h)
  const iw = image.w * scale
  const ih = image.h * scale
  const ix = Math.min(x, Math.max(x + w - iw, x + w / 2 - iw * fx))
  const iy = Math.min(y, Math.max(y + h - ih, y + h / 2 - ih * fy))
  const clip = id('c')
  return `<clipPath id="${clip}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}"/></clipPath><image href="${image.href}" x="${ix.toFixed(1)}" y="${iy.toFixed(1)}" width="${iw.toFixed(1)}" height="${ih.toFixed(1)}" clip-path="url(#${clip})" preserveAspectRatio="none"${opacity < 1 ? ` opacity="${opacity}"` : ''}/>`
}

/** An image fitted inside a box, centred (a logo, an emblem, a poro). */
export function contain(image: Pic, x: number, y: number, w: number, h: number, extra = '') {
  const scale = Math.min(w / image.w, h / image.h)
  const iw = image.w * scale
  const ih = image.h * scale
  return `<image href="${image.href}" x="${(x + (w - iw) / 2).toFixed(1)}" y="${(y + (h - ih) / 2).toFixed(1)}" width="${iw.toFixed(1)}" height="${ih.toFixed(1)}" preserveAspectRatio="none"${extra}/>`
}

/** A portrait (profile icon, champion, item): rounded, on a dark well, with a lit hairline. */
export function portrait(
  image: Pic | null,
  x: number,
  y: number,
  size: number,
  radius = size * 0.22
) {
  let svg = `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="#0c0b12" filter="url(#lift)"/>`
  if (image) svg += cover(image, x, y, size, size, { fx: 0.5, fy: 0.5, radius })
  svg += `<rect x="${x + 0.75}" y="${y + 0.75}" width="${size - 1.5}" height="${size - 1.5}" rx="${radius}" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="1.5"/>`
  return svg
}

/* ── Poros ─────────────────────────────────────────────────────────────────────────────────── */
/** The poros (resources/og/poros, made by scripts/og_poros.mjs), by what they react to. */
export type Mood =
  | 'cheeky'
  | 'peace'
  | 'snax'
  | 'snoozy'
  | 'love'
  | 'fan'
  | 'hype'
  | 'buddies'
  | 'rocker'
  | 'bouncer'
  | 'ghost'

const POROS = new URL('../../../resources/og/poros/', import.meta.url)
const poros = new Map<Mood, Promise<Pic>>()
function poroArt(mood: Mood) {
  let art = poros.get(mood)
  if (!art) {
    art = readFile(new URL(`${mood}.png`, POROS)).then((bytes) => pic(bytes, 512, { alpha: true }))
    art.catch(() => poros.delete(mood))
    poros.set(mood, art)
  }
  return art
}

/**
 * A poro `h` tall, its left edge at `x` and its foot at `y` (`sink` of it below, behind whatever
 * it leans on, or past the card's edge), maybe turned to face the other way, with a soft shadow.
 */
export async function poro(
  mood: Mood,
  x: number,
  y: number,
  h: number,
  { flip = false, tilt = 0 }: { flip?: boolean; tilt?: number } = {}
) {
  const art = await poroArt(mood).catch(() => null)
  if (!art) return { svg: '', w: 0 }
  const w = (art.w / art.h) * h
  const top = y - h
  const turn = [
    flip ? `translate(${(2 * x + w).toFixed(1)} 0) scale(-1 1)` : '',
    tilt ? `rotate(${tilt} ${(x + w / 2).toFixed(1)} ${y.toFixed(1)})` : '',
  ]
    .filter(Boolean)
    .join(' ')
  return {
    svg: `<g${turn ? ` transform="${turn}"` : ''} filter="url(#poro)"><image href="${art.href}" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" preserveAspectRatio="none"/></g>`,
    w,
  }
}

/**
 * A poro `h` tall perched on a figure set at `size` on `baseline`: over its first digits, sunk a
 * little behind their tops, as the release card's poro leans on its version.
 */
export async function perch(
  mood: Mood,
  fig: { left: number; width: number },
  baseline: number,
  size: number,
  h = 150,
  { at = 0.4, flip = false }: { at?: number; flip?: boolean } = {}
) {
  const w = await poroWidth(mood, h)
  const x = Math.min(W - w - 8, fig.left + fig.width * at - w / 2)
  return (await poro(mood, x, baseline - size * 0.7 + h * 0.2, h, { flip })).svg
}

/** The page's title under the top edge and its line under it. Returns the SVG and its foot. */
export function heading(
  runs: Run[],
  sub: Run[] | null,
  { x = PAD, top = PAD + 6, room = 640, max = 104, min = 56, lines = 2, subSize = 34 } = {}
) {
  const t = title(runs, x, top, room, { max, min, lines })
  let svg = t.svg
  let bottom = t.baseline
  if (sub?.length) {
    bottom = t.baseline + subSize + 20
    let cx = x
    for (const [value, fill] of sub) {
      const f = fit('kicker', value, x + room - cx, subSize, subSize * 0.7)
      svg += text('kicker', f.text, fill, f.size, cx, bottom)
      cx += measure('kicker', f.text, f.size) + measure('kicker', ' ', f.size)
    }
  }
  return { svg, bottom, size: t.size }
}

/** A poro alone on a transparent card-sized SVG, to lay over a card drawn elsewhere. */
export async function poroLayer(mood: Mood, x: number, y: number, h: number) {
  const p = await poro(mood, x, y, h)
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><filter id="poro" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#05040a" flood-opacity="0.55"/></filter></defs>${p.svg}</svg>`
  )
}

/** The width a poro of `mood` takes at height `h`. */
export async function poroWidth(mood: Mood, h: number) {
  const art = await poroArt(mood).catch(() => null)
  return art ? (art.w / art.h) * h : 0
}

/* ── Marks ─────────────────────────────────────────────────────────────────────────────────── */
const LOGO =
  'M140.32,114.78l66.57-52.4-84.5,29.38,18.32-28.35-30.09,17.83,39.13-56.71-79.86,45.07-7.92,13.62.91,24.19,31.05,8.35,9.9,22.32,25.04,9.9-8.54,18.83-36.29.19v8.54l67.35,14.75-21.54-28.53,71.03-44.25-60.55-2.72ZM73.47,105.37l14.19-27.76,4.98,27.76h-19.17Z'

/** The Invade mark and `invade.lol` on the foot's left, the source line on its right. */
export function foot(source = '', { right = W - PAD } = {}) {
  const g = 30
  const k = g / 170
  let svg = `<g transform="translate(${(PAD - 54 * k).toFixed(1)} ${(FOOT - g * 0.8 - 22 * k).toFixed(1)}) scale(${k.toFixed(4)})" fill="${C.brand}"><path d="${LOGO}"/><polygon points="55.54 130.51 73.97 130.39 85.04 143.21 66.99 144.45 55.54 130.51"/></g>`
  svg += text('kicker', 'invade.lol', C.text1, 25, PAD + g * 0.95 + 10, FOOT)
  if (source) {
    const s = fit('label', source, right - PAD - 260, 22, 17)
    svg += text('label', s.text, C.text3, s.size, right, FOOT, { anchor: 'end' })
  }
  return svg
}

export type Role = keyof typeof ROLE_ICONS

/** A lane's mark (32 by 32 paths), `size` wide at (x, y). */
export function roleIcon(role: Role, x: number, y: number, size: number, fill = C.text2) {
  const paths = ROLE_ICONS[role]
    .map(([d, opacity]) => `<path d="${d}" fill="${fill}" fill-opacity="${opacity}"/>`)
    .join('')
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(size / 32).toFixed(4)})">${paths}</g>`
}

export const TIER_MARKS = ['S+', 'S', 'A', 'B', 'C', 'D'] as const

/** A tier mark (S+ … D) as the tier list draws it, `h` tall: S+ in gold. Returns its width. */
export function tierMark(tier: number, x: number, y: number, h: number) {
  const label = TIER_MARKS[tier] ?? ''
  const size = h * 0.62
  const w = Math.max(h * 1.25, measure('figure', label, size) + h * 0.55)
  const fill = tier === 0 ? C.gold : tier === 1 ? '#efeef7' : tier === 2 ? '#c9c7da' : '#77758c'
  const ink = tier <= 2 ? '#14121d' : '#f4f3fa'
  return {
    svg: `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h}" rx="${(h * 0.24).toFixed(1)}" fill="${fill}"/>${text('figure', label, ink, size, x + w / 2, y + h / 2 + size * 0.36, { anchor: 'middle' })}`,
    width: w,
  }
}

/* ── The stage ─────────────────────────────────────────────────────────────────────────────── */
export interface Stage {
  /** The art, and the box it covers (the right of the card by default). */
  art?: Pic | null
  box?: { x: number; y: number; w: number; h: number }
  focus?: { fx: number; fy: number }
  /** How far into the box the left fade reaches (share of its width); 0 for none. */
  fadeLeft?: number
  /** Where the foot's fade starts, from the top (share of the height). */
  fadeFoot?: number
  /** The art's strength (it sits behind words). */
  dim?: number
}

/** The ink, the art faded into it, the violet light: the SVG under everything. */
export function stage({
  art,
  box = { x: 380, y: 0, w: W - 380, h: H },
  focus = { fx: 0.5, fy: 0.3 },
  fadeLeft = 0.55,
  fadeFoot = 0.55,
  dim = 0.86,
}: Stage = {}) {
  const defs = `<linearGradient id="ink" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${C.top}"/><stop offset="1" stop-color="${C.ink}"/></linearGradient>
<radialGradient id="light" gradientUnits="userSpaceOnUse" cx="${W}" cy="0" r="${W * 0.85}"><stop offset="0" stop-color="${C.brand}" stop-opacity="0.2"/><stop offset="0.45" stop-color="${C.brand}" stop-opacity="0.05"/><stop offset="1" stop-color="${C.brand}" stop-opacity="0"/></radialGradient>
<filter id="poro" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#05040a" flood-opacity="0.55"/></filter>
<filter id="lift" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.5"/></filter>`
  let svg = `<rect width="${W}" height="${H}" fill="url(#ink)"/>`
  let fades = ''
  if (art) {
    svg += cover(art, box.x, box.y, box.w, box.h, { ...focus, opacity: dim })
    if (fadeLeft > 0)
      fades += `<linearGradient id="fadeL" gradientUnits="userSpaceOnUse" x1="${box.x}" x2="${box.x + box.w * fadeLeft}" y1="0" y2="0"><stop offset="0" stop-color="${C.top}"/><stop offset="0.4" stop-color="${C.top}" stop-opacity="0.7"/><stop offset="1" stop-color="${C.top}" stop-opacity="0"/></linearGradient>`
    fades += `<linearGradient id="fadeF" x1="0" x2="0" y1="0" y2="1"><stop offset="${fadeFoot}" stop-color="${C.ink}" stop-opacity="0"/><stop offset="${Math.min(0.97, fadeFoot + 0.3)}" stop-color="${C.ink}" stop-opacity="0.82"/><stop offset="1" stop-color="${C.ink}" stop-opacity="0.95"/></linearGradient>`
    if (fadeLeft > 0)
      svg += `<rect x="${box.x - 1}" y="${box.y}" width="${box.w * fadeLeft + 2}" height="${box.h}" fill="url(#fadeL)"/>`
    svg += `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#fadeF)"/>`
  }
  svg += `<rect width="${W}" height="${H}" fill="url(#light)"/>`
  return { defs: defs + fades, svg }
}

const GRAIN = Buffer.from(GRAIN_PNG, 'base64')

/** The card's SVG as a JPEG, under the grain. */
export async function render(defs: string, body: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${body}</svg>`
  return sharp(Buffer.from(svg))
    .composite([{ input: GRAIN, tile: true, blend: 'over' }])
    .flatten({ background: C.ink })
    .jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer()
}

/** `1.3m`, `981k`, `8,420`. */
export function compact(n: number) {
  if (n >= 999_950) return `${(n / 1_000_000).toFixed(1)}m`
  if (n >= 9_950) return `${Math.round(n / 1000)}k`
  return Math.round(n).toLocaleString('en-US')
}

/** "Diamond II", "Master". */
export function rankName(tier: string, division?: string | null) {
  const t = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()
  const apex = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier.toUpperCase())
  return apex || !division ? t : `${t} ${division}`
}
