import { FORMATS, columnsFor, type CardFormat, type Cell } from './share_card.js'

/**
 * Draws the profile's share card on a canvas: the same pixels the dialog previews and the
 * download saves. Read top to bottom: the player (portrait, name, tag and region), what the
 * figures cover, the figures, then the invade.lol mark, small, at the bottom.
 */

export interface CardInput {
  format: CardFormat
  name: string
  tag: string
  region: string
  /** Profile icon and splash, already loaded (same origin, so the canvas stays exportable). */
  icon: HTMLImageElement | null
  splash: HTMLImageElement | null
  /** "Last 30 games, all queues", or empty when no figure is shown. */
  window: string
  cells: Cell[]
}

/** The card is night ink in every theme: its colours are the dark tokens, read off an `.iv-dark` node. */
export type Palette = (token: string) => string

/** Where each format puts the art and the text, in canvas pixels; `s` scales the type. */
const LAYOUTS: Record<
  CardFormat,
  { pad: number; s: number; top: number; bottom: number; art: 'right' | 'top'; artHeight: number }
> = {
  wide: { pad: 64, s: 1, top: 64, bottom: 64, art: 'right', artHeight: 630 },
  square: { pad: 80, s: 1.2, top: 400, bottom: 80, art: 'top', artHeight: 660 },
  // A story keeps clear of the bands a phone's story viewer draws over (about 250px each end).
  story: { pad: 96, s: 1.45, top: 840, bottom: 260, art: 'top', artHeight: 1180 },
}

const FONT = "Archivo, Geist, system-ui, -apple-system, 'Segoe UI', sans-serif"
const font = (weight: number, size: number) => `${weight} ${Math.round(size)}px ${FONT}`

/** Loads every weight the card uses, so the first draw is not in a fallback face. */
export async function loadCardFonts() {
  if (typeof document === 'undefined' || !document.fonts) return
  await Promise.all(
    [500, 600, 700].map((w) => document.fonts.load(font(w, 40)).catch(() => []))
  ).catch(() => {})
}

export function drawCard(canvas: HTMLCanvasElement, input: CardInput, color: Palette) {
  const { width: W, height: H } = FORMATS[input.format]
  const L = LAYOUTS[input.format]
  const s = L.s
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'alphabetic'

  const ink = color('--ink-1')
  ctx.fillStyle = ink
  ctx.fillRect(0, 0, W, H)

  if (input.splash) drawArt(ctx, input.splash, input.format, ink)

  /* The player: portrait, the name with room, then the #tag and the region as a chip. */
  const avatar = Math.round(96 * s)
  let x = L.pad
  const y = L.top
  if (input.icon) {
    ctx.save()
    roundRect(ctx, x, y, avatar, avatar, 16 * s)
    ctx.clip()
    ctx.drawImage(input.icon, x, y, avatar, avatar)
    ctx.restore()
    x += avatar + Math.round(28 * s)
  }
  const room = W - L.pad - x
  ctx.font = font(600, fit(ctx, input.name, 600, 64 * s, 40 * s, room))
  ctx.fillStyle = color('--text-1')
  const nameBase = y + Math.round(avatar * 0.5)
  ctx.fillText(ellipsize(ctx, input.name, room), x, nameBase)

  ctx.font = font(500, 32 * s)
  ctx.fillStyle = color('--text-2')
  const tagBase = y + avatar - Math.round(4 * s)
  const tag = `#${input.tag}`
  ctx.fillText(tag, x, tagBase)
  if (input.region) {
    const chipX = x + ctx.measureText(tag).width + Math.round(16 * s)
    chip(ctx, input.region, chipX, tagBase, s, color)
  }

  /* The figures, under a line saying what they cover. */
  let cursor = y + avatar + Math.round(64 * s)
  if (input.cells.length) {
    ctx.font = font(500, 22 * s)
    ctx.fillStyle = color('--text-3')
    ctx.fillText(input.window, L.pad, cursor)
    cursor += Math.round(28 * s)

    const columns = columnsFor(input.format, input.cells.length)
    const columnWidth = (W - L.pad * 2) / columns
    const rowHeight = Math.round(112 * s)
    input.cells.forEach((cell, i) => {
      const cx = L.pad + (i % columns) * columnWidth
      const top = cursor + Math.floor(i / columns) * rowHeight
      const max = columnWidth - 40 * s
      ctx.font = font(700, fit(ctx, cell.value, 700, 54 * s, 30 * s, max))
      ctx.fillStyle = cell.tone ? color(cell.tone) || color('--text-1') : color('--text-1')
      ctx.fillText(cell.value, cx, top + Math.round(54 * s))
      ctx.font = font(500, 21 * s)
      ctx.fillStyle = color('--text-2')
      ctx.fillText(ellipsize(ctx, cell.label, max), cx, top + Math.round(88 * s))
    })
  }

  /* The mark: small, last. */
  ctx.font = font(600, 22 * s)
  ctx.fillStyle = color('--text-2')
  ctx.fillText('invade.lol', L.pad, H - L.bottom)
}

/** The splash at the same strength as the profile header, faded into the ink. */
function drawArt(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  format: CardFormat,
  ink: string
) {
  const { width: W, height: H } = FORMATS[format]
  const L = LAYOUTS[format]
  ctx.save()
  ctx.globalAlpha = 0.42
  if (L.art === 'right') {
    const w = W * 0.68
    const scale = Math.max(w / img.width, H / img.height)
    ctx.drawImage(
      img,
      W - img.width * scale,
      (H - img.height * scale) / 2.4,
      img.width * scale,
      img.height * scale
    )
  } else {
    const h = L.artHeight
    const scale = Math.max(W / img.width, h / img.height)
    ctx.drawImage(img, (W - img.width * scale) / 2, 0, img.width * scale, img.height * scale)
  }
  ctx.restore()

  // The art fades into the ink where the text sits: from the left on a wide card, downwards else.
  const fade =
    L.art === 'right'
      ? ctx.createLinearGradient(W * 0.32, 0, W * 0.75, 0)
      : ctx.createLinearGradient(0, L.artHeight, 0, L.artHeight * 0.4)
  fade.addColorStop(0, ink)
  fade.addColorStop(1, withAlpha(ink, 0))
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, W, H)
}

/** The region as a quiet chip on the tag's line: a small radius, a surface fill, no outline. */
function chip(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  baseline: number,
  s: number,
  color: Palette
) {
  ctx.font = font(600, 19 * s)
  const padX = Math.round(12 * s)
  const height = Math.round(34 * s)
  const width = ctx.measureText(label).width + padX * 2
  const top = baseline - Math.round(26 * s)
  ctx.fillStyle = color('--surface-4')
  roundRect(ctx, x, top, width, height, 10 * s)
  ctx.fill()
  ctx.fillStyle = color('--text-2')
  ctx.fillText(label, x + padX, top + height / 2 + Math.round(7 * s))
}

/** The largest size from `max` down to `min` at which `text` fits `room`. */
function fit(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  max: number,
  min: number,
  room: number
) {
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

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
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
