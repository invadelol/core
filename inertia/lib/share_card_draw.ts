import { FORMATS, type CardFormat, type CardKind, type Line } from './share_card.js'

/**
 * Draws the profile's share card on a canvas: the same pixels the dialog previews, copies and
 * downloads. The "ledger": the art on top (on the left of a wide card), the player big, a line
 * saying what the figures cover, then one statistic per line, and the invade.lol mark with the
 * date at the foot. A ranked card swaps the lines for the emblem, the rank and the LP of the
 * last 30 days; a champion card leads with the champion.
 */

export interface CardInput {
  format: CardFormat
  kind: CardKind
  /** The big name: the player, or the champion on a champion card. */
  title: string
  /** Under it: "#5555 · EUW", or the player on a champion card. */
  subtitle: string
  /** The square picture beside the name: the profile icon or the champion's icon. */
  icon: HTMLImageElement | null
  splash: HTMLImageElement | null
  /** "Last 30 games, all queues" and, on the right, "17W 13L". */
  kicker: string
  kickerRight: string
  lines: Line[]
  /** Rank emblems by lowercase tier, already loaded. */
  emblems: Record<string, HTMLImageElement | null>
  /** Ranked card: the rank, its tier and LP, and the LP of each day (oldest first). */
  ranked?: { tier: string; name: string; lp: number; days: number[]; gain: number } | null
  /** "17 Nov 2026" */
  date: string
}

/** The card is night ink in every theme: its colours are the dark tokens, read off an `.iv-dark` node. */
export type Palette = (token: string) => string

const FONT = "'Sofia Sans', Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
const font = (weight: number, size: number) => `${weight} ${Math.round(size)}px ${FONT}`
const GLYPH = new (globalThis.Path2D ?? class {})(
  'M140.32,114.78l66.57-52.4-84.5,29.38,18.32-28.35-30.09,17.83,39.13-56.71-79.86,45.07-7.92,13.62.91,24.19,31.05,8.35,9.9,22.32,25.04,9.9-8.54,18.83-36.29.19v8.54l67.35,14.75-21.54-28.53,71.03-44.25-60.55-2.72ZM73.47,105.37l14.19-27.76,4.98,27.76h-19.17ZM55.54,130.51L73.97,130.39L85.04,143.21L66.99,144.45Z'
) as Path2D

/** Where each format puts things, in export pixels. */
interface Layout {
  art: { x: number; y: number; w: number; h: number; fade: 'down' | 'right' }
  id: { x: number; y: number; icon: number; radius: number; title: number; sub: number; stacked: boolean }
  /** The content column: the kicker's baseline, then the body below it. */
  col: { x: number; w: number; kicker: number; size: number }
  body: { top: number; row: number; label: number; value: number; aside: number; columns: number }
  foot: { y: number; size: number; glyph: number }
}

const LAYOUTS: Record<CardFormat, Layout> = {
  square: {
    art: { x: 0, y: 0, w: 1080, h: 330, fade: 'down' },
    id: { x: 64, y: 252, icon: 112, radius: 22, title: 60, sub: 26, stacked: false },
    col: { x: 64, w: 952, kicker: 462, size: 25 },
    body: { top: 486, row: 76, label: 28, value: 48, aside: 24, columns: 1 },
    foot: { y: 1036, size: 22, glyph: 26 },
  },
  wide: {
    art: { x: 0, y: 0, w: 400, h: 630, fade: 'right' },
    id: { x: 440, y: 56, icon: 88, radius: 18, title: 54, sub: 23, stacked: false },
    col: { x: 440, w: 704, kicker: 208, size: 22 },
    body: { top: 228, row: 92, label: 22, value: 42, aside: 20, columns: 2 },
    foot: { y: 590, size: 19, glyph: 22 },
  },
  // A story keeps its words clear of the bands a phone's story viewer draws over.
  story: {
    art: { x: 0, y: 0, w: 1080, h: 700, fade: 'down' },
    id: { x: 72, y: 560, icon: 150, radius: 30, title: 104, sub: 36, stacked: true },
    col: { x: 72, w: 936, kicker: 980, size: 30 },
    body: { top: 1000, row: 96, label: 32, value: 62, aside: 30, columns: 1 },
    foot: { y: 1770, size: 26, glyph: 30 },
  },
}

/** Loads every weight the card uses, so the first draw is not in a fallback face. */
export async function loadCardFonts() {
  if (typeof document === 'undefined' || !document.fonts) return
  await Promise.all(
    [600, 700, 750, 800].map((w) => document.fonts.load(font(w, 40)).catch(() => []))
  ).catch(() => {})
}

export function drawCard(canvas: HTMLCanvasElement, input: CardInput, color: Palette) {
  const { width: W, height: H } = FORMATS[input.format]
  const L = LAYOUTS[input.format]
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'alphabetic'
  const c = (token: string, fallback: string) => color(token) || fallback
  const ink = c('--ink-1', '#0d0e13')
  const t1 = c('--text-1', '#f1f0f7')
  const t2 = c('--text-2', '#b4b3c6')
  const t3 = c('--text-3', '#80809a')
  const t4 = c('--text-4', '#4a4b5c')
  const violet = '#c9c3ff'

  /* Night ink, one violet light from the top right. */
  ctx.fillStyle = ink
  ctx.fillRect(0, 0, W, H)
  const light = ctx.createRadialGradient(W, 0, 0, W, 0, Math.max(W, H) * 0.9)
  light.addColorStop(0, 'rgb(123 109 255 / 0.22)')
  light.addColorStop(0.45, 'rgb(123 109 255 / 0.06)')
  light.addColorStop(1, 'rgb(123 109 255 / 0)')
  ctx.fillStyle = light
  ctx.fillRect(0, 0, W, H)

  if (input.splash) drawArt(ctx, input.splash, L.art, ink)

  /* Who: the square picture, the big name, the line under it. */
  const id = L.id
  let tx = id.x
  let ty = id.y
  if (input.icon) {
    const top = id.stacked ? id.y : id.y + 0
    ctx.save()
    ctx.shadowColor = 'rgb(0 0 0 / 0.6)'
    ctx.shadowBlur = 20
    ctx.shadowOffsetY = 8
    roundRect(ctx, id.x, top, id.icon, id.icon, id.radius)
    ctx.fillStyle = ink
    ctx.fill()
    ctx.restore()
    ctx.save()
    roundRect(ctx, id.x, top, id.icon, id.icon, id.radius)
    ctx.clip()
    ctx.drawImage(input.icon, id.x, top, id.icon, id.icon)
    ctx.restore()
    ctx.strokeStyle = 'rgb(255 255 255 / 0.14)'
    ctx.lineWidth = 2
    roundRect(ctx, id.x - 2, top - 2, id.icon + 4, id.icon + 4, id.radius + 2)
    ctx.stroke()
    if (id.stacked) ty = top + id.icon + 28
    else tx = id.x + id.icon + 24
  }
  const room = (L.col.x + L.col.w) - tx
  const titleSize = fit(ctx, input.title, 800, id.title, id.title * 0.6, room)
  ctx.font = font(800, titleSize)
  ctx.fillStyle = t1
  ctx.letterSpacing = `${-0.03 * titleSize}px`
  const titleBase = id.stacked ? ty + titleSize * 0.82 : ty + id.icon / 2 + titleSize * 0.1
  ctx.fillText(ellipsize(ctx, input.title, room), tx, titleBase)
  ctx.letterSpacing = '0px'
  ctx.font = font(600, id.sub)
  ctx.fillStyle = t3
  ctx.fillText(ellipsize(ctx, input.subtitle, room), tx, titleBase + id.sub + 12)

  /* What the figures cover. */
  const col = L.col
  ctx.font = font(700, col.size)
  ctx.fillStyle = violet
  ctx.fillText(input.kicker, col.x, col.kicker)
  if (input.kickerRight) {
    ctx.font = font(650, col.size)
    ctx.fillStyle = t3
    ctx.textAlign = 'right'
    ctx.fillText(input.kickerRight, col.x + col.w, col.kicker)
    ctx.textAlign = 'left'
  }

  if (input.kind === 'ranked' && input.ranked) drawRanked(ctx, input, L, { t1, t2, t3, violet }, color)
  else drawLedger(ctx, input, L, { t1, t2, t3 }, color)

  /* The mark and the date. */
  const f = L.foot
  ctx.save()
  const g = f.glyph / 170
  ctx.translate(col.x - 54 * g, f.y - f.glyph * 0.78 - 22 * g)
  ctx.scale(g, g)
  ctx.fillStyle = '#7b6dff'
  ctx.fill(GLYPH)
  ctx.restore()
  ctx.font = font(700, f.size)
  ctx.fillStyle = t2
  ctx.fillText('invade.lol', col.x + f.glyph * 0.95 + 8, f.y)
  ctx.font = font(600, f.size)
  ctx.fillStyle = t4
  ctx.textAlign = 'right'
  ctx.fillText(input.date, col.x + col.w, f.y)
  ctx.textAlign = 'left'
}

/** One statistic per line: a hairline over each, the label left, the figure right. */
function drawLedger(
  ctx: CanvasRenderingContext2D,
  input: CardInput,
  L: Layout,
  ink: { t1: string; t2: string; t3: string },
  color: Palette
) {
  const b = L.body
  const columns = b.columns
  const perColumn = columns > 1 ? Math.ceil(input.lines.length / columns) || 1 : input.lines.length
  const gap = 40
  const cw = (L.col.w - gap * (columns - 1)) / columns
  input.lines.forEach((line, i) => {
    const ci = columns > 1 ? Math.floor(i / Math.max(3, perColumn)) : 0
    const ri = columns > 1 ? i % Math.max(3, perColumn) : i
    const x = L.col.x + ci * (cw + gap)
    const top = b.top + ri * b.row
    ctx.fillStyle = 'rgb(255 255 255 / 0.07)'
    ctx.fillRect(x, top, cw, 2)
    const mid = top + b.row / 2
    ctx.font = font(600, b.label)
    ctx.fillStyle = ink.t2
    ctx.fillText(line.label, x, mid + b.label * 0.35)

    // From the right edge: the aside, then the figure, then the rank's emblem.
    let right = x + cw
    ctx.textAlign = 'right'
    if (line.aside) {
      ctx.font = font(650, b.aside)
      ctx.fillStyle = ink.t3
      ctx.fillText(line.aside, right, mid + b.value * 0.35)
      right -= ctx.measureText(line.aside).width + 14
    }
    const valueSize = line.key === 'rank' && L === LAYOUTS.wide ? b.value * 0.86 : b.value
    const labelRoom = ctx.measureText(line.label).width
    const size = fit(ctx, line.value, 750, valueSize, valueSize * 0.6, right - x - labelRoom - 60)
    ctx.font = font(750, size)
    ctx.letterSpacing = `${-0.02 * size}px`
    ctx.fillStyle = line.tone ? color(line.tone) || ink.t1 : ink.t1
    ctx.fillText(line.value, right, mid + b.value * 0.35)
    const vw = ctx.measureText(line.value).width
    ctx.letterSpacing = '0px'
    ctx.textAlign = 'left'
    const emblem = line.tier ? input.emblems[line.tier] : null
    if (emblem) {
      const e = size * 1.15
      drawEmblem(ctx, emblem, right - vw - 10 - e, mid - e / 2 + 2, e)
    }
  })
}

/** The emblem big, the rank and its LP, then the LP of the last 30 days as one violet line. */
function drawRanked(
  ctx: CanvasRenderingContext2D,
  input: CardInput,
  L: Layout,
  ink: { t1: string; t2: string; t3: string; violet: string },
  color: Palette
) {
  const r = input.ranked!
  const wide = L === LAYOUTS.wide
  const story = L === LAYOUTS.story
  const top = L.body.top
  const e = wide ? 150 : story ? 300 : 240
  const emblem = input.emblems[r.tier]
  if (emblem) drawEmblem(ctx, emblem, L.col.x - e * 0.08, top + (wide ? -6 : 0), e)
  const tx = L.col.x + e * 0.92 + (wide ? 18 : 28)
  const big = wide ? 72 : story ? 128 : 112
  ctx.font = font(800, fit(ctx, r.name, 800, big, big * 0.6, L.col.x + L.col.w - tx))
  ctx.letterSpacing = `${-0.03 * big}px`
  ctx.fillStyle = color(`--tier-${r.tier}`) || ink.t1
  ctx.fillText(r.name, tx, top + e * 0.5)
  ctx.letterSpacing = '0px'
  ctx.font = font(700, big * 0.45)
  ctx.fillStyle = ink.t2
  ctx.fillText(`${r.lp} LP`, tx, top + e * 0.5 + big * 0.62)

  if (r.days.length < 2) return
  const cy = top + e + (wide ? 18 : 40)
  const ch = wide ? 600 - 56 - cy - 44 : story ? 360 : 220
  const head = wide ? 20 : story ? 30 : 24
  ctx.font = font(650, head)
  ctx.fillStyle = ink.t3
  ctx.fillText('LP, last 30 days', L.col.x, cy + head)
  ctx.font = font(750, head * 1.15)
  ctx.fillStyle = ink.violet
  ctx.textAlign = 'right'
  ctx.fillText(`${r.gain >= 0 ? '+' : '−'}${Math.abs(r.gain)} LP`, L.col.x + L.col.w, cy + head)
  ctx.textAlign = 'left'
  const y0 = cy + head + 18
  const lo = Math.min(...r.days)
  const hi = Math.max(...r.days)
  const n = r.days.length
  const px = (i: number) => L.col.x + (i / (n - 1)) * L.col.w
  const py = (v: number) => y0 + 6 + (ch - 12) * (1 - (v - lo) / Math.max(1, hi - lo))
  const path = new Path2D()
  r.days.forEach((v, i) => (i ? path.lineTo(px(i), py(v)) : path.moveTo(px(i), py(v))))
  const area = new Path2D(path)
  area.lineTo(px(n - 1), y0 + ch)
  area.lineTo(px(0), y0 + ch)
  area.closePath()
  const fade = ctx.createLinearGradient(0, y0, 0, y0 + ch)
  fade.addColorStop(0, 'rgb(123 109 255 / 0.3)')
  fade.addColorStop(1, 'rgb(123 109 255 / 0)')
  ctx.fillStyle = fade
  ctx.fill(area)
  ctx.strokeStyle = '#9d93ff'
  ctx.lineWidth = wide ? 3 : 4
  ctx.lineJoin = 'round'
  ctx.stroke(path)
  ctx.fillStyle = ink.violet
  ctx.beginPath()
  ctx.arc(px(n - 1), py(r.days[n - 1]), wide ? 6 : 8, 0, Math.PI * 2)
  ctx.fill()
}

/** The splash, faded into the ink: downwards on square and story, to the right on a wide card. */
function drawArt(ctx: CanvasRenderingContext2D, img: HTMLImageElement, a: Layout['art'], ink: string) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(a.x, a.y, a.w, a.h)
  ctx.clip()
  const scale = Math.max(a.w / img.width, a.h / img.height)
  const w = img.width * scale
  const h = img.height * scale
  // Splash art keeps the face in the upper third: anchor there.
  ctx.drawImage(img, a.x + (a.w - w) * 0.4, a.y + (a.h - h) * 0.28, w, h)
  ctx.restore()
  const fade =
    a.fade === 'right'
      ? ctx.createLinearGradient(a.x + a.w * 0.62, 0, a.x + a.w, 0)
      : ctx.createLinearGradient(0, a.y + a.h * 0.4, 0, a.y + a.h)
  fade.addColorStop(0, withAlpha(ink, 0))
  fade.addColorStop(1, ink)
  ctx.fillStyle = fade
  ctx.fillRect(a.x, a.y, a.w + 1, a.h + 1)
}

/** Riot's emblem art sits small in a wide transparent square: crop to the crest. */
function drawEmblem(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number) {
  const crop = 0.42
  const sw = img.width * crop
  const sh = img.height * crop
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, size, size)
}

/** The largest size from `max` down to `min` at which `text` fits `room`. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, max: number, min: number, room: number) {
  let size = max
  ctx.font = font(weight, size)
  while (size > min && ctx.measureText(text).width > room) {
    size -= 2
    ctx.font = font(weight, size)
  }
  return size
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, room: number) {
  if (ctx.measureText(text).width <= room) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > room) cut = cut.slice(0, -1)
  return `${cut}…`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** `#0d0e13` (or `rgb(…)`) at an alpha, for the transparent end of a fade. */
function withAlpha(value: string, alpha: number) {
  const hex = /^#([0-9a-f]{6})$/i.exec(value.trim())
  if (hex) {
    const n = Number.parseInt(hex[1], 16)
    return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${alpha})`
  }
  return 'rgb(13 14 19 / 0)'
}
