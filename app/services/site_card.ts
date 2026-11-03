import sharp, { type Sharp } from 'sharp'
import { GLYPHS } from '#services/site_card_glyphs'
import { GRAIN_PNG } from '#services/match_card_glyphs'
import { ROLE_ICONS } from '#services/presence_card'

/**
 * The share cards of the site's pages (`/og/home.jpg`, `/og/champion/…`, `/og/tier-list/…`,
 * `/og/stats/…`, `/og/pros/…`, `/og/pro/…`, `/og/team/…`), of the match card's family: art as
 * the stage (a champion's centred splash, or a team's logo), dimmed and desaturated, under the
 * site's grain and the window's one violet light, the ink rising under the words. Over it sits
 * one thing at poster size (a tier and a win rate, a pro's LP, a team's logo and roster), the
 * page's name, a short kicker and the Invade mark. Nothing else.
 *
 * Laid out at 2x of 600 by 315, like the match card, so a figure still reads at Discord's 400 px.
 * Type is Archivo outlines (`site_card_glyphs`): the server needs no font, and a name with a
 * letter the faces lack is drawn without it.
 */
export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630

/** Bump on any change to how the cards are drawn: cached bytes and `?v=` links change with it. */
export const RENDERER = 1

const W = CARD_WIDTH
const H = CARD_HEIGHT
const X = 2
const M = 32 * X
const GRAIN = Buffer.from(GRAIN_PNG, 'base64')

/* ── Tokens (@invadelol/ui tokens.css, dark) ───────────────────────────────────────────────── */
const T = {
  ink0: '#08090c',
  ink1: '#0d0e13',
  text1: '#ececf3',
  text2: '#a6a7b8',
  text3: '#6f7085',
  brand: '#7b6dff',
  win: '#4c9bff',
  gold: '#e2b25a',
  goldRgb: '226,178,90',
}

/** Rank tiers in their `--tier-*` colour. */
const TIER_COLOUR: Record<string, string> = {
  IRON: '#8c8088',
  BRONZE: '#b07a5c',
  SILVER: '#9ea8b5',
  GOLD: '#d9ab52',
  PLATINUM: '#4fb8b0',
  EMERALD: '#3fb37a',
  DIAMOND: '#6f8cff',
  MASTER: '#b36bff',
  GRANDMASTER: '#ff5d6c',
  CHALLENGER: '#f4d27a',
}

export const TIER_MARKS = ['S+', 'S', 'A', 'B', 'C', 'D'] as const

/* ── Type ──────────────────────────────────────────────────────────────────────────────────── */
type Face = keyof typeof GLYPHS
const glyphsOf = (face: Face) => GLYPHS[face].glyphs as Record<string, readonly [number, string]>

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

function setType(
  face: Face,
  text: string,
  fill: string,
  size: number,
  x: number,
  baseline: number,
  {
    anchor = 'start',
    tracking = 0,
  }: { anchor?: 'start' | 'middle' | 'end'; tracking?: number } = {}
) {
  const glyphs = glyphsOf(face)
  const width = measure(face, text, size, tracking)
  const x0 = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x
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
    svg: `<g fill="${fill}" transform="translate(${x0.toFixed(1)} ${baseline.toFixed(1)}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})">${paths.join('')}</g>`,
    width,
  }
}

/** `text` at most `max` wide: smaller down to `min`, then cut with an ellipsis. */
function fit(face: Face, text: string, max: number, size: number, min: number, tracking = 0) {
  let s = size
  while (s > min && measure(face, text, s, tracking) > max) s -= 2
  let t = text
  while (measure(face, t, s, tracking) > max && t.length > 1) t = [...t].slice(0, -2).join('') + '…'
  return { text: t, size: s }
}

/** `.iv-fig`'s engraved mask, in glyph units. */
const ENGRAVE = `<linearGradient id="engrave" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="880" y2="-120">
  <stop offset="0.35" stop-color="${T.text1}"/><stop offset="1" stop-color="${T.text1}" stop-opacity="0.74"/></linearGradient>`

/* ── Marks ─────────────────────────────────────────────────────────────────────────────────── */
const LOGO =
  'M140.32,114.78l66.57-52.4-84.5,29.38,18.32-28.35-30.09,17.83,39.13-56.71-79.86,45.07-7.92,13.62.91,24.19,31.05,8.35,9.9,22.32,25.04,9.9-8.54,18.83-36.29.19v8.54l67.35,14.75-21.54-28.53,71.03-44.25-60.55-2.72ZM73.47,105.37l14.19-27.76,4.98,27.76h-19.17Z'

/** The Invade mark and the wordmark, top left. */
function brand() {
  const h = 20 * X
  const markSvg = `<g transform="translate(${M} ${M}) scale(${h / 170}) translate(-54 -22)" fill="${T.brand}"><path d="${LOGO}"/><polygon points="55.54 130.51 73.97 130.39 85.04 143.21 66.99 144.45 55.54 130.51"/></g>`
  const word = setType(
    'title',
    'invade.lol',
    T.text1,
    16 * X,
    M + (h * 155) / 170 + 9 * X,
    M + h * 0.74,
    {
      tracking: -0.01,
    }
  ).svg
  return markSvg + word
}

export type CardRole = keyof typeof ROLE_ICONS

/** A role's lane mark (the presence card's paths, 32 by 32), `size` px wide at (x, y). */
function roleIcon(role: CardRole, x: number, y: number, size: number, fill = T.text2) {
  const paths = ROLE_ICONS[role]
    .map(([d, opacity]) => `<path d="${d}" fill="${fill}" fill-opacity="${opacity}"/>`)
    .join('')
  return `<g transform="translate(${x} ${y}) scale(${size / 32})">${paths}</g>`
}

/** A tier mark (S+ … D) as the tier list draws it: S+ in gold, S on the brightest ink. */
function tierBadge(tier: number, x: number, y: number, h: number) {
  const label = TIER_MARKS[tier] ?? ''
  const size = h * 0.6
  const w = Math.max(h * 1.3, measure('fig', label, size) + h * 0.5)
  const fill =
    tier === 0
      ? `rgba(${T.goldRgb},0.16)`
      : tier === 1
        ? 'rgba(255,255,255,0.14)'
        : 'rgba(255,255,255,0.08)'
  const ink = tier === 0 ? T.gold : tier <= 2 ? T.text1 : T.text2
  return {
    svg: `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h * 0.2}" fill="${fill}"/>${
      setType('fig', label, ink, size, x + w / 2, y + h / 2 + size * 0.35, { anchor: 'middle' }).svg
    }`,
    width: w,
  }
}

/* ── Materials ─────────────────────────────────────────────────────────────────────────────── */
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

/** The ink that rises under the words: from the bottom, and from the left where they sit. */
const GROUND = `<linearGradient id="floor" x1="0" x2="0" y1="0" y2="1"><stop offset="0.35" stop-color="${T.ink1}" stop-opacity="0"/><stop offset="0.92" stop-color="${T.ink1}" stop-opacity="0.94"/></linearGradient>
  <linearGradient id="side" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${T.ink1}" stop-opacity="0.78"/><stop offset="0.62" stop-color="${T.ink1}" stop-opacity="0"/></linearGradient>`

function frame(body: string, extraDefs = '') {
  const L = light(3)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${ENGRAVE}${GROUND}${L.def}${extraDefs}</defs>
    <rect width="${W}" height="${H}" fill="url(#side)"/><rect width="${W}" height="${H}" fill="url(#floor)"/>${L.rect}
    ${brand()}${body}</svg>`
}

/** The page's name with its kicker above it, bottom left, at most `max` wide. */
function heading(kicker: string, title: string, max: number, kickerIcon?: CardRole) {
  const t = fit('title', title, max, 46 * X, 30 * X, -0.02)
  const baseline = H - M - 6 * X
  let svg = setType('title', t.text, T.text1, t.size, M, baseline, { tracking: -0.02 }).svg
  const ky = baseline - t.size * 0.98 - 14 * X
  let kx = M
  if (kickerIcon) {
    svg += roleIcon(kickerIcon, M, ky - 15 * X, 18 * X)
    kx += 26 * X
  }
  const k = fit('label', kicker, max - (kx - M), 18 * X, 13 * X)
  svg += setType('label', k.text, T.text2, k.size, kx, ky).svg
  return svg
}

/** The one figure, bottom right: its label above it, the figure engraved, maybe a tier beside. */
function figure(
  value: string,
  label: string,
  { tier, size = 64 * X }: { tier?: number | null; size?: number } = {}
) {
  const right = W - M
  const baseline = H - M - 4 * X
  const f = fit('fig', value, W * 0.42, size, 40 * X, -0.01)
  let svg = setType('fig', f.text, 'url(#engrave)', f.size, right, baseline, {
    anchor: 'end',
    tracking: -0.01,
  }).svg
  const width = measure('fig', f.text, f.size, -0.01)
  let left = right - width
  if (tier !== null && tier !== undefined) {
    const h = f.size * 0.56
    const badge = tierBadge(tier, 0, 0, h)
    left -= badge.width + 14 * X
    svg += `<g transform="translate(${left} ${baseline - f.size * 0.72 + (f.size * 0.72 - h) / 2})">${badge.svg}</g>`
  }
  svg += setType('label', label, T.text3, 15 * X, right, baseline - f.size * 0.72 - 14 * X, {
    anchor: 'end',
  }).svg
  return { svg, left }
}

/* ── Stages ────────────────────────────────────────────────────────────────────────────────── */
/** A champion's centred splash, covered, its face above the words, dimmed like the game frames. */
function splashStage(art: Uint8Array) {
  return sharp(art)
    .resize(W, 675, { fit: 'cover' })
    .extract({ left: 0, top: 16, width: W, height: H })
    .modulate({ brightness: 0.62, saturation: 0.8 })
}

function inkStage() {
  return sharp({ create: { width: W, height: H, channels: 3, background: T.ink1 } })
}

/** A champion's portrait, `size` square with rounded corners, cropped past Riot's baked border. */
async function rounded(image: Uint8Array, size: number, radius: number) {
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}"/></svg>`
  )
  const over = Math.round(size * 1.14)
  const inset = Math.round((over - size) / 2)
  return sharp(image)
    .resize(over, over, { fit: 'cover' })
    .extract({ left: inset, top: inset, width: size, height: size })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

/** A logo, `size` square, its transparency kept, at `opacity`. */
async function logo(image: Uint8Array, size: number, { saturation = 1, opacity = 1 } = {}) {
  const pic = await sharp(image)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .modulate({ saturation })
    .ensureAlpha(opacity)
    .png()
    .toBuffer()
  if (opacity >= 1) return pic
  const { data, info } = await sharp(pic).raw().toBuffer({ resolveWithObject: true })
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * opacity)
  return sharp(data, { raw: info }).png().toBuffer()
}

type Layer = { input: Buffer; left: number; top: number }

async function finish(stage: Sharp, svg: string, layers: Layer[] = [], over: Layer[] = []) {
  return stage
    .composite([
      ...layers,
      { input: GRAIN, tile: true, blend: 'over' },
      { input: Buffer.from(svg), left: 0, top: 0 },
      ...over,
    ])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer()
}

/* ── The cards ─────────────────────────────────────────────────────────────────────────────── */

/** `/og/home.jpg`: the tier list's best mid pick as the stage, the site's name, its one line. */
export async function homeCard(card: { patch: string | null }, art?: Uint8Array) {
  const kicker = card.patch
    ? `League of Legends profiles, champion stats and pros, patch ${card.patch}`
    : 'League of Legends profiles, champion stats and pros'
  const svg = frame(heading(kicker, 'Find a player', W - 2 * M))
  return finish(art ? splashStage(art) : inkStage(), svg)
}

export interface ChampionCard {
  name: string
  role: CardRole
  roleLabel: string
  patch: string
  /** Null when the champion has too few games in the role to be ranked. */
  tier: number | null
  rank: number | null
  winRate: number | null
}

/** `/og/champion/<slug>/<role>.jpg`: the champion's splash, its name, its tier and win rate. */
export async function championCard(card: ChampionCard, art?: Uint8Array) {
  const fig =
    card.winRate !== null
      ? figure(
          `${(card.winRate * 100).toFixed(1)}%`,
          card.rank ? `Win rate, #${card.rank} ${card.roleLabel}` : 'Win rate',
          {
            tier: card.tier,
          }
        )
      : null
  const max = (fig ? fig.left : W - M) - M - 24 * X
  const svg = frame(
    heading(`${card.roleLabel}, patch ${card.patch}`, card.name, max, card.role) + (fig?.svg ?? '')
  )
  return finish(art ? splashStage(art) : inkStage(), svg)
}

export interface TierListCard {
  title: string
  patch: string
  /** The best five, with their tier and, on the all-roles card, their role. */
  champions: { image?: Uint8Array; tier: number | null; role?: CardRole }[]
}

/** `/og/tier-list/<role>.jpg`: the first five of the role, poster size, over the first's splash. */
export async function tierListCard(card: TierListCard, art?: Uint8Array) {
  const size = 78 * X
  const gap = 14 * X
  const count = card.champions.length
  const rowWidth = count * size + (count - 1) * gap
  const x0 = W - M - rowWidth
  const y0 = 75 * X
  const layers: Layer[] = []
  let body = ''
  for (const [i, c] of card.champions.entries()) {
    const x = x0 + i * (size + gap)
    // The portrait's well and its lit edge, under the picture.
    body += `<rect x="${x - 2}" y="${y0 - 2}" width="${size + 4}" height="${size + 4}" rx="${8 * X}" fill="rgba(0,0,0,0.35)"/>`
    if (c.image) layers.push({ input: await rounded(c.image, size, 8 * X), left: x, top: y0 })
    const by = y0 + size + 12 * X
    if (c.tier !== null) {
      const badge = tierBadge(c.tier, 0, 0, 26 * X)
      body += `<g transform="translate(${x + (size - badge.width) / 2} ${by})">${badge.svg}</g>`
    }
    if (c.role) body += roleIcon(c.role, x + size / 2 - 10 * X, y0 - 30 * X, 20 * X, T.text2)
    else
      body += setType('label', `#${i + 1}`, T.text3, 15 * X, x + size / 2, y0 - 12 * X, {
        anchor: 'middle',
      }).svg
  }
  const svg = frame(heading(`Patch ${card.patch}, Emerald and above`, card.title, W - 2 * M) + body)
  return finish(art ? splashStage(art) : inkStage(), svg, [], layers)
}

export interface FigureCard {
  kicker: string
  title: string
  value: string
  label: string
  role?: CardRole
}

/** `/og/stats/<view>.jpg` and the like: a page's name and its one figure over a splash. */
export async function figureCard(card: FigureCard, art?: Uint8Array) {
  const fig = figure(card.value, card.label)
  const svg = frame(heading(card.kicker, card.title, fig.left - M - 24 * X, card.role) + fig.svg)
  return finish(art ? splashStage(art) : inkStage(), svg)
}

export interface LogoCard {
  kicker: string
  title: string
  /** The figure (a pro's LP, a count), or none. */
  value?: string
  label?: string
  /** The tier the figure belongs to, in its colour above it. */
  tier?: string | null
  /** A team's current players, drawn as a line under the title. */
  roster?: { name: string; role: CardRole | null }[]
  /** The acronym drawn when there is no logo. */
  short: string
}

/**
 * `/og/pro/…`, `/og/team/…`, `/og/pros/…`: the team's (or league's) logo as the stage on the
 * right, large and quiet, the name and the figure over the ink on the left.
 */
export async function logoCard(card: LogoCard, image?: Uint8Array | null) {
  const layers: Layer[] = []
  const size = 470
  const lx = W - M - size + 30
  const ly = (H - size) / 2 - 10
  let body = ''
  if (image) {
    try {
      layers.push({
        input: await logo(image, size, { saturation: 0.85, opacity: 0.5 }),
        left: lx,
        top: ly,
      })
    } catch {
      image = null
    }
  }
  if (!image && card.short) {
    const s = fit('title', card.short, size * 0.9, 220, 80, -0.02)
    body += setType(
      'title',
      s.text,
      'rgba(255,255,255,0.08)',
      s.size,
      lx + size / 2,
      ly + size / 2 + s.size * 0.36,
      {
        anchor: 'middle',
        tracking: -0.02,
      }
    ).svg
  }
  // The words sit on the ink: left, over the logo's quiet half.
  const max = W * 0.6
  const baseline = H - M - 6 * X
  let y = baseline
  if (card.roster?.length) {
    let x = M
    for (const p of card.roster.slice(0, 5)) {
      if (p.role) {
        body += roleIcon(p.role, x, y - 15 * X, 16 * X, T.text3)
        x += 22 * X
      }
      const n = fit('label', p.name, 150 * X, 17 * X, 12 * X)
      body += setType('label', n.text, T.text1, n.size, x, y).svg
      x += measure('label', n.text, n.size) + 22 * X
      if (x > W - M) break
    }
    y -= 46 * X
  }
  if (card.value) {
    const f = fit('fig', card.value, max, 72 * X, 40 * X, -0.01)
    body += setType('fig', f.text, 'url(#engrave)', f.size, M, y, { tracking: -0.01 }).svg
    const vw = measure('fig', f.text, f.size, -0.01)
    if (card.label) body += setType('label', card.label, T.text3, 20 * X, M + vw + 10 * X, y).svg
    if (card.tier)
      body += setType(
        'label',
        card.tier,
        TIER_COLOUR[card.tier.toUpperCase()] ?? T.text2,
        18 * X,
        M,
        y - f.size * 0.72 - 12 * X
      ).svg
    y -= f.size * 0.72 + (card.tier ? 46 * X : 22 * X)
  }
  const t = fit('title', card.title, max, 46 * X, 26 * X, -0.02)
  body += setType('title', t.text, T.text1, t.size, M, y, { tracking: -0.02 }).svg
  const k = fit('label', card.kicker, max, 18 * X, 13 * X)
  body += setType('label', k.text, T.text2, k.size, M, y - t.size * 0.98 - 12 * X).svg
  return finish(inkStage(), frame(body), layers)
}
