import sharp from 'sharp'
import { GLYPHS } from '#services/share_card_glyphs'
import {
  FORMATS,
  columnsFor,
  type CardFormat,
  type CardKind,
  type Line,
} from '../../inertia/lib/share_card.js'

/**
 * The profile's share card, drawn on the server from the card's link (`/card/:summoner/…png`), so
 * a shared link always shows the player's figures of the day. The player's card as it always was,
 * made richer: the champion's art behind (on the right of a wide card, on top of the others) under
 * one violet light, the player big with the portrait, a line saying which games the figures
 * cover, the figures large with a hairline over each, and the mark with the date at the foot.
 * A ranked card leads with the emblem, the rank and the LP of the last 30 days; a champion card
 * leads with the champion.
 *
 * Type is Sofia Sans outlines (`share_card_glyphs`): the server needs no font, and a name with a
 * letter the faces lack is drawn without it. Bump RENDERER when the drawing changes, so cached
 * cards are drawn again.
 */
export const RENDERER = 5

export interface ShareCardInput {
  format: CardFormat
  kind: CardKind
  title: string
  subtitle: string
  /** The square picture beside the name (profile icon or champion icon), PNG/JPEG bytes. */
  icon: Buffer | null
  splash: Buffer | null
  kicker: string
  kickerRight: string
  lines: Line[]
  /** Rank emblems by lowercase tier. */
  emblems: Record<string, Buffer | null>
  ranked?: { tier: string; name: string; lp: number; days: number[]; gain: number } | null
  date: string
}

const C = {
  ink: '#0d0e13',
  text1: '#f1f0f7',
  text2: '#b4b3c6',
  text3: '#80809a',
  text4: '#55566a',
  violet: '#c9c3ff',
  line: '#9d93ff',
  brand: '#7b6dff',
}
const TIER: Record<string, string> = {
  iron: '#8c8c95',
  bronze: '#b27a52',
  silver: '#a3b1bf',
  gold: '#d6ae5b',
  platinum: '#4fb3b0',
  emerald: '#2ec27e',
  diamond: '#6f8cff',
  master: '#b46cf0',
  grandmaster: '#e5534b',
  challenger: '#f2c94c',
}

interface Layout {
  pad: number
  /** Type scale. */
  s: number
  /** Top of the player's block, and the foot's baseline from the bottom. */
  top: number
  bottom: number
  art: { x: number; y: number; w: number; h: number; fade: 'left' | 'down' }
}

/** Where each format puts the art and the words, in export pixels. */
const LAYOUTS: Record<CardFormat, Layout> = {
  wide: { pad: 64, s: 1, top: 56, bottom: 54, art: { x: 360, y: 0, w: 840, h: 630, fade: 'left' } },
  square: {
    pad: 80,
    s: 1.2,
    top: 372,
    bottom: 72,
    art: { x: 0, y: 0, w: 1080, h: 680, fade: 'down' },
  },
  // A story keeps its words clear of the bands a phone's story viewer draws over (about 250 px).
  story: {
    pad: 96,
    s: 1.45,
    top: 860,
    bottom: 260,
    art: { x: 0, y: 0, w: 1080, h: 1200, fade: 'down' },
  },
}

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

function text(
  face: Face,
  value: string,
  fill: string,
  size: number,
  x: number,
  baseline: number,
  { anchor = 'start', tracking = 0 }: { anchor?: 'start' | 'end'; tracking?: number } = {}
) {
  const glyphs = glyphsOf(face)
  const width = measure(face, value, size, tracking)
  const x0 = anchor === 'end' ? x - width : x
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
function fit(face: Face, value: string, room: number, max: number, min: number, tracking = 0) {
  let size = max
  while (size > min && measure(face, value, size, tracking) > room) size -= 2
  let t = value
  while (measure(face, t, size, tracking) > room && [...t].length > 1)
    t = [...t].slice(0, -2).join('') + '…'
  return { text: t, size }
}

/* ── Pictures ──────────────────────────────────────────────────────────────────────────────── */
async function dataUri(bytes: Buffer, max = 1400, trim = false) {
  // An emblem's art sits small in a wide transparent square: trimmed to the crest.
  const source = trim ? await sharp(bytes).trim().toBuffer() : bytes
  const png = await sharp(source)
    .resize(max, max, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()
  const meta = await sharp(png).metadata()
  return {
    href: `data:image/png;base64,${png.toString('base64')}`,
    w: meta.width ?? 1,
    h: meta.height ?? 1,
  }
}

/** An image covering a box, anchored like the dialog (faces sit in a splash's upper third). */
function cover(
  img: { href: string; w: number; h: number },
  x: number,
  y: number,
  w: number,
  h: number,
  id: string
) {
  const scale = Math.max(w / img.w, h / img.h)
  const iw = img.w * scale
  const ih = img.h * scale
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>
<image href="${img.href}" x="${(x + (w - iw) * 0.4).toFixed(1)}" y="${(y + (h - ih) * 0.28).toFixed(1)}" width="${iw.toFixed(1)}" height="${ih.toFixed(1)}" clip-path="url(#${id})" preserveAspectRatio="none"/>`
}

/** A trimmed emblem, fitted in a square box. */
function emblem(img: { href: string; w: number; h: number }, x: number, y: number, size: number) {
  return `<image href="${img.href}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`
}

const LOGO =
  'M140.32,114.78l66.57-52.4-84.5,29.38,18.32-28.35-30.09,17.83,39.13-56.71-79.86,45.07-7.92,13.62.91,24.19,31.05,8.35,9.9,22.32,25.04,9.9-8.54,18.83-36.29.19v8.54l67.35,14.75-21.54-28.53,71.03-44.25-60.55-2.72ZM73.47,105.37l14.19-27.76,4.98,27.76h-19.17Z'

/* ── The card ──────────────────────────────────────────────────────────────────────────────── */
export async function renderShareCard(input: ShareCardInput): Promise<Buffer> {
  const { width: W, height: H } = FORMATS[input.format]
  const L = LAYOUTS[input.format]
  const s = L.s
  const wide = input.format === 'wide'
  const parts: string[] = []
  const defs: string[] = [
    `<radialGradient id="light" cx="${W}" cy="0" r="${Math.max(W, H) * 0.95}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7b6dff" stop-opacity="0.26"/><stop offset="0.4" stop-color="#7b6dff" stop-opacity="0.07"/><stop offset="1" stop-color="#7b6dff" stop-opacity="0"/></radialGradient>`,
  ]
  parts.push(`<rect width="${W}" height="${H}" fill="${C.ink}"/>`)

  /* The art, full strength where nothing is written, faded into the ink under the words. */
  const a = L.art
  if (input.splash) {
    parts.push(cover(await dataUri(input.splash, 1800), a.x, a.y, a.w, a.h, 'art'))
    defs.push(
      a.fade === 'left'
        ? `<linearGradient id="fade" gradientUnits="userSpaceOnUse" x1="${a.x}" y1="0" x2="${a.x + a.w * 0.62}" y2="0"><stop offset="0" stop-color="${C.ink}"/><stop offset="0.45" stop-color="${C.ink}" stop-opacity="0.72"/><stop offset="1" stop-color="${C.ink}" stop-opacity="0.08"/></linearGradient>`
        : `<linearGradient id="fade" gradientUnits="userSpaceOnUse" x1="0" y1="${a.y + a.h * 0.28}" x2="0" y2="${a.y + a.h}"><stop offset="0" stop-color="${C.ink}" stop-opacity="0.05"/><stop offset="0.6" stop-color="${C.ink}" stop-opacity="0.7"/><stop offset="1" stop-color="${C.ink}"/></linearGradient>`
    )
    parts.push(
      `<rect x="${a.x - 1}" y="${a.y - 1}" width="${a.w + 2}" height="${a.h + 2}" fill="url(#fade)"/>`
    )
    // The wide card's art also sinks into the foot.
    if (wide) {
      defs.push(
        `<linearGradient id="foot" x1="0" x2="0" y1="0" y2="1"><stop offset="0.3" stop-color="${C.ink}" stop-opacity="0"/><stop offset="0.55" stop-color="${C.ink}" stop-opacity="0.55"/><stop offset="1" stop-color="${C.ink}" stop-opacity="0.9"/></linearGradient>`
      )
      parts.push(`<rect width="${W}" height="${H}" fill="url(#foot)"/>`)
    }
  }
  parts.push(`<rect width="${W}" height="${H}" fill="url(#light)"/>`)
  // A lit top edge, like the site's sheets.
  parts.push(`<rect width="${W}" height="2" fill="#fff" fill-opacity="0.08"/>`)

  /* The player (or the champion): the portrait, the name big, the tag and the region. */
  const x0 = L.pad
  const right = W - L.pad
  // On a wide card the words stay on the dark side of the art.
  const textRight = wide ? x0 + 660 : right
  const avatar = Math.round((wide ? 92 : 104) * s)
  const radius = Math.round(20 * s)
  let tx = x0
  if (input.icon) {
    const icon = await dataUri(input.icon, 400)
    defs.push(
      `<clipPath id="icon"><rect x="${x0}" y="${L.top}" width="${avatar}" height="${avatar}" rx="${radius}"/></clipPath>`
    )
    defs.push(
      `<filter id="drop" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="${8 * s}" stdDeviation="${12 * s}" flood-color="#000" flood-opacity="0.6"/></filter>`
    )
    parts.push(
      `<rect x="${x0}" y="${L.top}" width="${avatar}" height="${avatar}" rx="${radius}" fill="${C.ink}" filter="url(#drop)"/>`
    )
    parts.push(
      `<image href="${icon.href}" x="${x0}" y="${L.top}" width="${avatar}" height="${avatar}" clip-path="url(#icon)" preserveAspectRatio="xMidYMid slice"/>`
    )
    parts.push(
      `<rect x="${x0 - 3}" y="${L.top - 3}" width="${avatar + 6}" height="${avatar + 6}" rx="${radius + 3}" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="2"/>`
    )
    tx = x0 + avatar + Math.round(28 * s)
  }
  const room = right - tx
  const title = fit('title', input.title, room, 72 * s, 42 * s, -0.03)
  const nameBase = L.top + avatar * 0.52
  parts.push(text('title', title.text, C.text1, title.size, tx, nameBase, { tracking: -0.03 }))
  const sub = fit('label', input.subtitle, room, 30 * s, 22 * s)
  parts.push(text('label', sub.text, C.text3, sub.size, tx, L.top + avatar - 6 * s))

  /* Which games the figures cover. */
  let cursor = L.top + avatar + Math.round((wide ? 58 : 70) * s)
  const kick = 22 * s
  parts.push(text('kicker', input.kicker, C.violet, kick, x0, cursor))
  if (input.kickerRight)
    parts.push(
      text('label', input.kickerRight, C.text3, kick, textRight, cursor, { anchor: 'end' })
    )
  cursor += Math.round(30 * s)

  const emblems: Record<string, { href: string; w: number; h: number }> = {}
  for (const [tier, bytes] of Object.entries(input.emblems))
    if (bytes) emblems[tier] = await dataUri(bytes, 400, true)

  if (input.kind === 'ranked' && input.ranked) {
    /* The emblem big, the rank in its colour and its LP, then the LP of the last 30 days. */
    const r = input.ranked
    const e = Math.round((wide ? 150 : 190) * s)
    const top = cursor + 8 * s
    if (emblems[r.tier]) parts.push(emblem(emblems[r.tier], x0 - e * 0.1, top - e * 0.08, e))
    const rx = x0 + e * 0.9 + 20 * s
    const big = (wide ? 76 : 84) * s
    const name = fit('title', r.name, textRight - rx, big, big * 0.6, -0.03)
    parts.push(
      text('title', name.text, TIER[r.tier] ?? C.text1, name.size, rx, top + e * 0.5, {
        tracking: -0.03,
      })
    )
    parts.push(text('kicker', `${r.lp} LP`, C.text2, 34 * s, rx, top + e * 0.5 + 46 * s))
    if (r.days.length >= 2) {
      const cy = top + e + 18 * s
      const ch = Math.max(60, H - L.bottom - 50 * s - cy - 28 * s)
      const head = 20 * s
      parts.push(text('label', 'LP, last 30 days', C.text3, head, x0, cy + head))
      parts.push(
        text(
          'kicker',
          `${r.gain >= 0 ? '+' : '−'}${Math.abs(r.gain)} LP`,
          C.violet,
          head * 1.15,
          textRight,
          cy + head,
          { anchor: 'end' }
        )
      )
      const y0 = cy + head + 14 * s
      const lo = Math.min(...r.days)
      const hi = Math.max(...r.days)
      const n = r.days.length
      const px = (i: number) => x0 + (i / (n - 1)) * (textRight - x0)
      const py = (v: number) => y0 + 6 + (ch - 12) * (1 - (v - lo) / Math.max(1, hi - lo))
      const d = r.days
        .map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`)
        .join(' ')
      defs.push(
        `<linearGradient id="lpfade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#7b6dff" stop-opacity="0.32"/><stop offset="1" stop-color="#7b6dff" stop-opacity="0"/></linearGradient>`
      )
      parts.push(
        `<path d="${d} L${px(n - 1).toFixed(1)} ${y0 + ch} L${px(0).toFixed(1)} ${y0 + ch} Z" fill="url(#lpfade)"/>`
      )
      parts.push(
        `<path d="${d}" fill="none" stroke="${C.line}" stroke-width="${(3 * s).toFixed(1)}" stroke-linejoin="round"/>`
      )
      parts.push(
        `<circle cx="${px(n - 1).toFixed(1)}" cy="${py(r.days[n - 1]).toFixed(1)}" r="${(6 * s).toFixed(1)}" fill="${C.violet}"/>`
      )
    }
  } else {
    /* The figures large, a hairline over each, the caption under. */
    const cells = input.lines
    // A wide card keeps its figures to the left: up to three a row, in rows of two or three.
    const columns = wide
      ? cells.length <= 3
        ? cells.length
        : cells.length === 4
          ? 2
          : 3
      : columnsFor(input.format, cells.length)
    const gap = Math.round(28 * s)
    const cw = (textRight - x0 - gap * (columns - 1)) / Math.max(1, columns)
    const rowHeight = Math.round((wide && cells.length > 3 ? 138 : 146) * s)
    cells.forEach((cell, i) => {
      const cx = x0 + (i % columns) * (cw + gap)
      const top = cursor + Math.floor(i / columns) * rowHeight
      parts.push(
        `<rect x="${cx.toFixed(1)}" y="${top}" width="${cw.toFixed(1)}" height="${Math.max(1, Math.round(1.5 * s))}" fill="#fff" fill-opacity="0.12"/>`
      )
      const tierEmblem = cell.tier ? emblems[cell.tier] : undefined
      const eSize = Math.round(52 * s)
      const vx = tierEmblem ? cx + eSize + 10 * s : cx
      const face: Face = cell.key === 'rank' ? 'title' : 'figure'
      const v = fit(face, cell.value, cx + cw - vx - 8 * s, 60 * s, 30 * s, -0.025)
      const base = top + Math.round(70 * s)
      if (tierEmblem) parts.push(emblem(tierEmblem, cx - 4 * s, base - eSize * 0.86, eSize))
      parts.push(
        text(face, v.text, cell.tier ? (TIER[cell.tier] ?? C.text1) : C.text1, v.size, vx, base, {
          tracking: -0.025,
        })
      )
      const cap = fit('label', cell.caption, cw - 8 * s, 21 * s, 16 * s)
      parts.push(text('label', cap.text, C.text2, cap.size, cx, base + Math.round(36 * s)))
    })
  }

  /* The mark and the date. */
  const g = Math.round(26 * s)
  const fy = H - L.bottom
  const k = g / 170
  parts.push(
    `<g transform="translate(${(x0 - 54 * k).toFixed(1)} ${(fy - g * 0.8 - 22 * k).toFixed(1)}) scale(${k.toFixed(4)})" fill="${C.brand}"><path d="${LOGO}"/><polygon points="55.54 130.51 73.97 130.39 85.04 143.21 66.99 144.45 55.54 130.51"/></g>`
  )
  parts.push(text('kicker', 'invade.lol', C.text1, 22 * s, x0 + g * 0.95 + 10 * s, fy))
  parts.push(text('label', input.date, C.text3, 20 * s, right, fy, { anchor: 'end' }))

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs.join('')}</defs>${parts.join('')}</svg>`
  return sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer()
}
