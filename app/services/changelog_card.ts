import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { GLYPHS } from '#services/changelog_card_glyphs'
import { GRAIN_PNG } from '#services/match_card_glyphs'

/**
 * The link preview of one version of the desktop app (`/og/app/changelog/<version>.jpg`): the
 * version number set huge in the figure style (`.iv-fig`: Archivo 700 at 92 % width, tabular,
 * the engraved fade at the bottom), Cheeky Poro leaning on top of its middle digit, the Invade
 * lockup top left, over the night ink, the one violet light and the grain. Nothing else.
 *
 * The approved release visual, drawn at 1600 by 900, is laid out here in the same proportions at
 * 1200 by 630 (0.7 of it, from the height). Type is Archivo outlines (`changelog_card_glyphs`),
 * so the server needs no font. Only the version is drawn, never free text: the route only draws
 * versions CHANGELOG.md lists.
 */
export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630

/** Bump on any change to how the card is drawn: every `?v=` changes, so shared images refresh. */
export const RENDERER = 1

/** A short hash of what the card draws and of the renderer: the image URL's `v`. */
export function changelogCardVersion(version: string) {
  return createHash('sha256')
    .update(JSON.stringify([RENDERER, version]))
    .digest('base64url')
    .slice(0, 10)
}

const W = CARD_WIDTH
const H = CARD_HEIGHT

/* ── Tokens (@invadelol/ui tokens.css, dark) ───────────────────────────────────────────────── */
const T = {
  ink1: '#0d0e13',
  text1: '#ececf3',
  brand: '#7b6dff',
}

/* ── Layout, from the approved 1600 by 900 render (×0.7) ───────────────────────────────────── */
/** The lockup's distance from the top and left edges, and its word's size (icon 1.3×, gap 0.5×). */
const PAD = 45
const WORD = 22
/** The figure's size and baseline when the version fits; a longer one shrinks around the caps. */
const FIGURE = 342
const BASELINE = 470
/** Room the figure may take, side to side. */
const ROOM = W - 2 * 64
/** `.iv-fig`'s tracking. */
const TRACKING = -0.01
/** The poro's width, against the figure's size, and the share of it below the digit's top. */
const PORO_WIDTH = 0.287
const PORO_SINK = 0.3
/** Cheeky Poro's art, 183 by 160. */
const PORO_RATIO = 160 / 183

type Face = keyof typeof GLYPHS
type Glyph = readonly [number, string, number]
const glyphsOf = (face: Face) => GLYPHS[face].glyphs as Record<string, Glyph>

/** Each character's advance (tracking included, none after the last) at `size` px. */
function advances(face: Face, text: string, size: number, tracking = 0) {
  const glyphs = glyphsOf(face)
  const chars = [...text].filter((char) => glyphs[char])
  const scale = size / GLYPHS[face].units
  return chars.map((char, i) => ({
    char,
    width: (glyphs[char][0] + (i < chars.length - 1 ? tracking * GLYPHS[face].units : 0)) * scale,
  }))
}

/** `text` as SVG paths from `x` on `baseline`; a character the face does not hold is skipped. */
function setType(
  face: Face,
  text: string,
  size: number,
  x: number,
  baseline: number,
  fill: string,
  tracking = 0
) {
  const glyphs = glyphsOf(face)
  const units = GLYPHS[face].units
  let advance = 0
  const paths: string[] = []
  for (const char of text) {
    const glyph = glyphs[char]
    if (!glyph) continue
    if (glyph[1]) paths.push(`<path transform="translate(${advance} 0)" d="${glyph[1]}"/>`)
    advance += glyph[0] + tracking * units
  }
  const scale = size / units
  return `<g fill="${fill}" transform="translate(${x.toFixed(1)} ${baseline.toFixed(1)}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})">${paths.join('')}</g>`
}

/**
 * The digit the poro leans on: one of the minor version's ("3" in 0.3.2, the "0" of 10 in
 * 0.10.12), the one nearest the middle of the figure, so it sits near the centre of the card.
 */
export function poroDigit(version: string) {
  const chars = [...version]
  const core = /^(\d+)\.(\d+)\./.exec(version)
  const candidates = core
    ? Array.from({ length: core[2].length }, (_, i) => core[1].length + 1 + i)
    : chars.flatMap((char, i) => (/\d/.test(char) ? [i] : []))
  const middle = (chars.length - 1) / 2
  let best = candidates[0] ?? 0
  for (const i of candidates) if (Math.abs(i - middle) < Math.abs(best - middle)) best = i
  return best
}

/** Where everything goes for `version`: the figure's size, origin and width, and the poro's box. */
export function changelogCardLayout(version: string) {
  let size = FIGURE
  let width = advances('fig', version, size, TRACKING).reduce((sum, a) => sum + a.width, 0)
  if (width > ROOM) {
    size = Math.floor((size * ROOM) / width)
    width = advances('fig', version, size, TRACKING).reduce((sum, a) => sum + a.width, 0)
  }
  const cap = GLYPHS.fig.capHeight / GLYPHS.fig.units
  // A smaller figure keeps the caps' middle where the approved one has it.
  const baseline = BASELINE - (cap * FIGURE) / 2 + (cap * size) / 2
  const left = (W - width) / 2

  const glyphs = advances('fig', version, size, TRACKING)
  const at = Math.min(poroDigit(version), glyphs.length - 1)
  const before = glyphs.slice(0, at).reduce((sum, a) => sum + a.width, 0)
  const digit = glyphsOf('fig')[glyphs[at]?.char ?? '0']
  // The digit's box, as the browser lays it out: its advance and the tracking after it.
  const centre =
    left + before + ((digit[0] + TRACKING * GLYPHS.fig.units) * size) / GLYPHS.fig.units / 2
  const top = baseline - (digit[2] * size) / GLYPHS.fig.units
  const w = PORO_WIDTH * size
  const h = w * PORO_RATIO
  return {
    size,
    baseline,
    left,
    width,
    poro: { x: centre - w / 2, y: top - h * (1 - PORO_SINK), w, h },
  }
}

/* ── The Invade mark (@invadelol/ui Logo, 155 by 170) ──────────────────────────────────────── */
const LOGO =
  'M140.32,114.78l66.57-52.4-84.5,29.38,18.32-28.35-30.09,17.83,39.13-56.71-79.86,45.07-7.92,13.62.91,24.19,31.05,8.35,9.9,22.32,25.04,9.9-8.54,18.83-36.29.19v8.54l67.35,14.75-21.54-28.53,71.03-44.25-60.55-2.72ZM73.47,105.37l14.19-27.76,4.98,27.76h-19.17Z'

/** The lockup: the mark (1.3× the word) and "Invade" at 600, centred on one line. */
function lockup() {
  const height = WORD * 1.3
  const mark = `<g transform="translate(${PAD} ${PAD}) scale(${(height / 170).toFixed(5)}) translate(-54 -22)" fill="${T.brand}"><path d="${LOGO}"/><polygon points="55.54 130.51 73.97 130.39 85.04 143.21 66.99 144.45 55.54 130.51"/></g>`
  const { ascent, descent, units } = GLYPHS.word
  // The word's line box (line-height 1) centred on the mark, its baseline inside it as CSS puts it.
  const boxTop = PAD + height / 2 - WORD / 2
  const baseline = boxTop + ((1 - (ascent + descent) / units) / 2 + ascent / units) * WORD
  const x = PAD + (height * 155) / 170 + WORD * 0.5
  return mark + setType('word', 'Invade', WORD, x, baseline, T.text1, -0.01)
}

/* ── Materials ─────────────────────────────────────────────────────────────────────────────── */
/** A radial at 75% -15% of the card, 90% by 75% of it: the shape of --light. */
function radial(id: string, stops: Array<[number, number]>) {
  const s = stops
    .map(([at, a]) => `<stop offset="${at}" stop-color="${T.brand}" stop-opacity="${a}"/>`)
    .join('')
  return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${W * 0.75} ${-H * 0.15}) scale(${W * 0.9} ${H * 0.75})">${s}</radialGradient>`
}

/** --light's bell, then the hero's touch more of the same light (same place, no hotspot). */
const LIGHT = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>
  ${radial('light', [
    [0, 0.06],
    [0.1, 0.058],
    [0.2, 0.0525],
    [0.3, 0.0443],
    [0.4, 0.0349],
    [0.5, 0.0256],
    [0.6, 0.0172],
    [0.7, 0.0105],
    [0.8, 0.0055],
    [0.9, 0.0021],
    [1, 0],
  ])}
  ${radial('hero', [
    [0, 0.07],
    [0.35, 0.045],
    [0.65, 0.015],
    [1, 0],
  ])}
</defs><rect width="${W}" height="${H}" fill="url(#light)"/><rect width="${W}" height="${H}" fill="url(#hero)"/></svg>`

/**
 * `.iv-fig`'s engraved mask, as the approved render shows it: full from half the figure's height
 * up, 0.74 just under the baseline. In glyph units, y up.
 */
const ENGRAVE = `<linearGradient id="engrave" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="503" y2="-66">
  <stop offset="0" stop-color="${T.text1}"/><stop offset="1" stop-color="${T.text1}" stop-opacity="0.74"/></linearGradient>`

/** The poro's two drop shadows: 0 2px 2px at 0.45 and 0 10px 14px at 0.35 (a CSS blur is 2σ). */
const SHADOW = `<filter id="poro" x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="1"/><feOffset dy="2"/>
  <feComponentTransfer><feFuncA type="linear" slope="0.45"/></feComponentTransfer><feMerge><feMergeNode/></feMerge>
</filter>
<filter id="poro2" x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="7"/><feOffset dy="10"/>
  <feComponentTransfer><feFuncA type="linear" slope="0.35"/></feComponentTransfer>
</filter>`

/** Everything over the ground, as one SVG: the lockup, the figure and the poro. */
export function cardOverlay(version: string, poroPng: Buffer) {
  const layout = changelogCardLayout(version)
  const { x, y, w, h } = layout.poro
  const href = `data:image/png;base64,${poroPng.toString('base64')}`
  const image = (filter?: string) =>
    `<image href="${href}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" preserveAspectRatio="none"${filter ? ` filter="url(#${filter})"` : ''}/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${ENGRAVE}${SHADOW}</defs>
  ${lockup()}
  ${setType('fig', version, layout.size, layout.left, layout.baseline, 'url(#engrave)', TRACKING)}
  ${image('poro2')}${image('poro')}${image()}
</svg>`
}

/**
 * The card as a 1200 by 630 JPEG (mozjpeg). `poro` is Cheeky Poro's art
 * (resources/changelog/cheeky-poro.webp).
 */
export async function renderChangelogCard(version: string, poro: Uint8Array) {
  const poroPng = await sharp(poro).png().toBuffer()
  return sharp({ create: { width: W, height: H, channels: 3, background: T.ink1 } })
    .composite([
      { input: Buffer.from(LIGHT) },
      { input: Buffer.from(GRAIN_PNG, 'base64'), tile: true, blend: 'over' },
      { input: Buffer.from(cardOverlay(version, poroPng)) },
    ])
    .jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer()
}
