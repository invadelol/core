import sharp from 'sharp'
import { GLYPHS } from '#services/build_card_glyphs'
import { GRAIN_PNG } from '#services/match_card_glyphs'
import { ROLE_ICONS } from '#services/presence_card'
import type { BuildLane, BuildRoute } from '#services/build_link'

/**
 * The link preview of a build shared from the desktop app (`/og/build/…`), drawn as the app's
 * build editor reads: the champion and the role, the build's name, then the items in buy order.
 *
 * The champion's centred splash is the stage, dimmed like the match card's, under the site's
 * grain and the window's violet light, with the ink rising under the items. The route (core, then
 * the 4th to 6th item) is the subject: poster-size item wells with the editor's chevrons, each
 * later slot's alternatives small under it. Starting items and boots sit above, smaller, as the
 * editor's first rows. At Discord's 400 px a route item is still some 45 px.
 *
 * Type is Archivo outlines (`build_card_glyphs`): the name is the player's text, but only its
 * glyphs' outlines reach the SVG, never the text itself. A name with a letter the faces lack is
 * not drawn: the card then titles the build by its champion.
 */
export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630

/** Bump on any change to how the card is drawn: every `?v=` changes, so shared images refresh. */
export const RENDERER = 1

export function buildCardVersion() {
  return String(RENDERER)
}

export interface BuildCard {
  championName: string
  lane: BuildLane
  /** Empty when the build has none. */
  name: string
  items: BuildRoute
}

const W = CARD_WIDTH
const H = CARD_HEIGHT
const GRAIN = Buffer.from(GRAIN_PNG, 'base64')

/* ── Tokens (@invadelol/ui tokens.css, dark) ───────────────────────────────────────────────── */
const T = {
  ink1: '#0d0e13',
  text1: '#ececf3',
  text2: '#a6a7b8',
  text3: '#6f7085',
  text4: '#4a4b5c',
  brand: '#7b6dff',
}

const LANE_ICON: Record<BuildLane, keyof typeof ROLE_ICONS> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MID: 'mid',
  ADC: 'bot',
  SUPPORT: 'support',
}
const LANE_LABEL: Record<BuildLane, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MID: 'Mid',
  ADC: 'Bot',
  SUPPORT: 'Support',
}

/* ── Type ──────────────────────────────────────────────────────────────────────────────────── */
type Face = keyof typeof GLYPHS
const glyphsOf = (face: Face) => GLYPHS[face].glyphs as Record<string, readonly [number, string]>

/** Whether every letter of `text` is in `face`. */
export function drawable(face: Face, text: string) {
  const glyphs = glyphsOf(face)
  return [...text].every((c) => Object.hasOwn(glyphs, c))
}

function measure(face: Face, text: string, size: number, tracking = 0) {
  const glyphs = glyphsOf(face)
  let advance = 0
  let count = 0
  for (const c of text) {
    const glyph = glyphs[c]
    if (!glyph) continue
    advance += glyph[0] + tracking * 1000
    count++
  }
  return ((advance - (count ? tracking * 1000 : 0)) * size) / 1000
}

/** `text` as SVG paths from `x` (or centred on it) on `baseline`. */
function setType(
  face: Face,
  text: string,
  fill: string,
  size: number,
  x: number,
  baseline: number,
  { anchor = 'start', tracking = 0 }: { anchor?: 'start' | 'middle'; tracking?: number } = {}
) {
  const glyphs = glyphsOf(face)
  const width = measure(face, text, size, tracking)
  const x0 = anchor === 'middle' ? x - width / 2 : x
  const paths: string[] = []
  let advance = 0
  for (const c of text) {
    const glyph = glyphs[c]
    if (!glyph) continue
    if (glyph[1]) paths.push(`<path transform="translate(${advance} 0)" d="${glyph[1]}"/>`)
    advance += glyph[0] + tracking * 1000
  }
  const scale = size / 1000
  return {
    svg: `<g fill="${fill}" transform="translate(${x0.toFixed(1)} ${baseline}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})">${paths.join('')}</g>`,
    width,
  }
}

/** The title at most `max` wide: smaller down to `min`, then cut with an ellipsis. */
function fitTitle(text: string, max: number, size: number, min: number) {
  let s = size
  while (s > min && measure('title', text, s, -0.02) > max) s -= 2
  let t = text
  while (measure('title', t, s, -0.02) > max && t.length > 1) t = [...t].slice(0, -2).join('') + '…'
  return { text: t, size: s }
}

/* ── The Invade mark (@invadelol/ui Logo, 155 by 170) ──────────────────────────────────────── */
const LOGO =
  'M140.32,114.78l66.57-52.4-84.5,29.38,18.32-28.35-30.09,17.83,39.13-56.71-79.86,45.07-7.92,13.62.91,24.19,31.05,8.35,9.9,22.32,25.04,9.9-8.54,18.83-36.29.19v8.54l67.35,14.75-21.54-28.53,71.03-44.25-60.55-2.72ZM73.47,105.37l14.19-27.76,4.98,27.76h-19.17Z'
function mark(x: number, y: number, height: number) {
  return `<g transform="translate(${x} ${y}) scale(${height / 170}) translate(-54 -22)" fill="${T.brand}"><path d="${LOGO}"/><polygon points="55.54 130.51 73.97 130.39 85.04 143.21 66.99 144.45 55.54 130.51"/></g>`
}

/** --light: the window's violet light from the top right, the bell falloff. */
function light(gain: number) {
  const a = [0.06, 0.058, 0.0525, 0.0443, 0.0349, 0.0256, 0.0172, 0.0105, 0.0055, 0.0021, 0]
  const stops = a
    .map(
      (v, i) =>
        `<stop offset="${i / 10}" stop-color="${T.brand}" stop-opacity="${(v * gain).toFixed(4)}"/>`
    )
    .join('')
  return `<radialGradient id="light" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${W * 0.75} ${-H * 0.15}) scale(${W * 0.9} ${H * 0.75})">${stops}</radialGradient>`
}

/* ── Layout ────────────────────────────────────────────────────────────────────────────────── */
export interface Slot {
  id: number
  x: number
  y: number
  size: number
}

const MARGIN = 56
/** A route item at most, its gap (the chevron's room), a small item and its gap. */
const BIG = 156
const BIG_GAP = 40
const SMALL = 64
const SMALL_GAP = 10
/** Route items by place, as the editor names them. */
const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th']
const ALT = 52
const ALT_GAP = 8

/** Where every item of the card goes, and the labels over the rows. */
export function buildCardLayout(items: BuildRoute) {
  const route = [...items.core, ...items.later.map((o) => o[0])]
  // Two alternatives under a slot at most: the card is a preview, the page lists them all.
  const alts = items.later.map((o) => o.slice(1, 3))
  const hasAlts = alts.some((a) => a.length)
  // The route fills the width, up to BIG a item.
  const big = Math.min(
    BIG,
    Math.floor((W - 2 * MARGIN - (route.length - 1) * BIG_GAP) / route.length)
  )
  const routeY = H - MARGIN - (hasAlts ? ALT + 14 : 0) - big
  const slots: Slot[] = []
  const labels: { text: string; x: number }[] = []
  const chevrons: { x: number; y: number }[] = []
  /** "or", left of a slot's alternatives (its right edge, its baseline). */
  const ors: { x: number; y: number }[] = []
  route.forEach((id, i) => {
    const x = MARGIN + i * (big + BIG_GAP)
    slots.push({ id, x, y: routeY, size: big })
    if (i) chevrons.push({ x: x - BIG_GAP / 2, y: routeY + big / 2 })
    if (i === 0) labels.push({ text: 'Core', x })
    if (i >= items.core.length) labels.push({ text: ORDINALS[i], x })
    const options = i >= items.core.length ? alts[i - items.core.length] : []
    const width = options.length * ALT + (options.length - 1) * ALT_GAP
    options.forEach((alt, o) => {
      const ax = x + (big - width) / 2 + o * (ALT + ALT_GAP)
      slots.push({ id: alt, x: ax, y: routeY + big + 14, size: ALT })
    })
    if (options.length)
      ors.push({ x: x + (big - width) / 2 - 12, y: routeY + big + 14 + ALT / 2 + 7 })
  })
  const routeLabelLine = routeY - 16

  // Starting items, then boots, as the editor's first rows: one line above the route.
  const smallY = routeLabelLine - 18 - 22 - SMALL
  let x = MARGIN
  if (items.start.length) {
    labels.push({ text: 'Start', x })
    for (const id of items.start) {
      slots.push({ id, x, y: smallY, size: SMALL })
      x += SMALL + SMALL_GAP
    }
    x += 30
  }
  if (items.boots !== null) {
    labels.push({ text: 'Boots', x })
    slots.push({ id: items.boots, x, y: smallY, size: SMALL })
  }
  const smallLabelLine = smallY - 14
  return {
    slots,
    chevrons,
    ors,
    routeLabels: labels.filter((l) => l.text === 'Core' || ORDINALS.includes(l.text)),
    smallLabels: labels.filter((l) => l.text === 'Start' || l.text === 'Boots'),
    routeLabelLine,
    smallLabelLine,
    /** The lowest line the title may reach. */
    titleFloor:
      items.start.length || items.boots !== null ? smallLabelLine - 40 : routeLabelLine - 40,
  }
}

/** A well behind an item: the slot's inset, its rim and a short shadow, r = 12% of the size. */
function well(s: Slot, filled: boolean) {
  const r = Math.round(s.size * 0.12)
  const shadow = `<rect x="${s.x}" y="${s.y + 3}" width="${s.size}" height="${s.size}" rx="${r}" fill="#000" opacity="0.45" filter="url(#soft)"/>`
  const ground = `<rect x="${s.x}" y="${s.y}" width="${s.size}" height="${s.size}" rx="${r}" fill="${filled ? T.ink1 : 'rgba(255,255,255,0.05)'}"/>`
  return shadow + ground
}
function rim(s: Slot) {
  const r = Math.round(s.size * 0.12)
  return `<rect x="${s.x + 0.75}" y="${s.y + 0.75}" width="${s.size - 1.5}" height="${s.size - 1.5}" rx="${r}" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="1.5"/>
    <rect x="${s.x + 0.75}" y="${s.y + 0.75}" width="${s.size - 1.5}" height="${s.size * 0.5}" rx="${r}" fill="url(#gloss)"/>`
}

function chevron(x: number, y: number) {
  return `<path d="M${x - 5} ${y - 10}L${x + 5} ${y}L${x - 5} ${y + 10}" fill="none" stroke="${T.text3}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
}

/** Everything under the items (the floor, the wells) and over them (rims, type), as two SVGs. */
export function buildCardSvg(card: BuildCard, filled: Set<number>) {
  const layout = buildCardLayout(card.items)
  const defs = `<defs>${light(3)}
    <linearGradient id="floor" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${T.ink1}" stop-opacity="0.35"/>
      <stop offset="0.3" stop-color="${T.ink1}" stop-opacity="0.1"/>
      <stop offset="0.55" stop-color="${T.ink1}" stop-opacity="0.55"/>
      <stop offset="0.85" stop-color="${T.ink1}" stop-opacity="0.94"/>
    </linearGradient>
    <linearGradient id="side" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="${T.ink1}" stop-opacity="0.75"/>
      <stop offset="0.55" stop-color="${T.ink1}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.10"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>`
  let under = `${defs}<rect width="${W}" height="${H}" fill="url(#floor)"/><rect width="${W}" height="${H}" fill="url(#side)"/><rect width="${W}" height="${H}" fill="url(#light)"/>`
  for (const s of layout.slots) under += well(s, filled.has(s.id))

  let over = defs
  for (const s of layout.slots) over += rim(s)
  for (const c of layout.chevrons) over += chevron(c.x, c.y)
  for (const o of layout.ors) {
    const width = measure('label', 'or', 18)
    over += setType('label', 'or', T.text3, 18, o.x - width, o.y).svg
  }
  for (const l of layout.routeLabels)
    over += setType('label', l.text, T.text3, 20, l.x, layout.routeLabelLine).svg
  for (const l of layout.smallLabels)
    over += setType('label', l.text, T.text3, 18, l.x, layout.smallLabelLine).svg

  // The head: the role and the champion, then the build's name.
  const icon = ROLE_ICONS[LANE_ICON[card.lane]]
    .map(([d, opacity]) => `<path d="${d}" fill="${T.text2}" opacity="${opacity}"/>`)
    .join('')
  const headLine = MARGIN + 26
  over += `<g transform="translate(${MARGIN} ${headLine - 26}) scale(${(30 / 34).toFixed(4)})">${icon}</g>`
  const champion = drawable('label', card.championName) ? card.championName : ''
  let hx = MARGIN + 42
  if (champion) {
    const c = setType('label', champion, T.text1, 28, hx, headLine)
    over += c.svg
    hx += c.width + 14
  }
  over += setType('label', LANE_LABEL[card.lane], T.text3, 28, hx, headLine).svg
  const markHeight = 36
  over += mark(W - MARGIN - (markHeight * 155) / 170, MARGIN - 4, markHeight)

  const titleText =
    card.name && drawable('title', card.name)
      ? card.name
      : `${champion || LANE_LABEL[card.lane]} build`
  const title = fitTitle(titleText, W - 2 * MARGIN, 76, 48)
  const titleLine = Math.min(headLine + 24 + title.size * 0.9, layout.titleFloor)
  over += setType('title', title.text, T.text1, title.size, MARGIN - 2, titleLine, {
    tracking: -0.02,
  }).svg

  const svg = (body: string) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`
    )
  return { layout, under: svg(under), over: svg(over) }
}

const masks = new Map<number, Buffer>()
function roundMask(size: number) {
  let mask = masks.get(size)
  if (!mask) {
    const r = Math.round(size * 0.12)
    mask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}"/></svg>`
    )
    masks.set(size, mask)
  }
  return mask
}

/**
 * The card as a 1200 by 630 JPEG. `artwork` is the champion's centred splash, `icons` each item's
 * icon by id; a missing one leaves its well empty (the card is then not worth keeping).
 */
export async function renderBuildCard(
  card: BuildCard,
  artwork: Uint8Array | undefined,
  icons: Map<number, Uint8Array>
) {
  const { layout, under, over } = buildCardSvg(card, new Set(icons.keys()))
  const stage = artwork
    ? sharp(artwork)
        .resize(W, 675)
        .extract({ left: 0, top: 16, width: W, height: H })
        .modulate({ brightness: 0.7, saturation: 0.85 })
    : sharp({ create: { width: W, height: H, channels: 3, background: T.ink1 } })
  const pictures = await Promise.all(
    layout.slots
      .filter((s) => icons.has(s.id))
      .map(async (s) => ({
        input: await sharp(icons.get(s.id))
          .resize(s.size, s.size, { fit: 'cover', kernel: 'lanczos3' })
          .ensureAlpha()
          .composite([{ input: roundMask(s.size), blend: 'dest-in' }])
          .png()
          .toBuffer(),
        left: Math.round(s.x),
        top: Math.round(s.y),
      }))
  )
  return stage
    .composite([
      { input: GRAIN, tile: true, blend: 'over' },
      { input: under },
      ...pictures,
      { input: over },
    ])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer()
}
