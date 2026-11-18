import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import app from '@adonisjs/core/services/app'
import { C, TIER, LOGO, dataUri, emblem, fit, measure, text } from '#services/share_card'
import { GRAIN_PNG } from '#services/match_card_glyphs'
import { ROLE_ICONS } from '#services/presence_card'

/**
 * The multisearch page's link preview (`/og/multisearch.png?summoners=…`): the lobby as seats,
 * each player's icon in a ring of their tier's colour, their name and rank. The best player's
 * main champion fills the stage behind them, under the site's violet light and grain, and a poro
 * peeks in from the corner: the king when someone is Master or higher, a cheeky one otherwise,
 * a sleepy one guarding the empty seats of the page itself. Real data only: an unknown player
 * keeps an empty seat with their name.
 */
export const RENDERER = 3
const W = 1200
const H = 630

export interface LobbySeat {
  gameName: string
  tagLine: string
  icon: Buffer | null
  /** Lowercase tier and its words ("Gold II, 45 LP"), when ranked. */
  tier: string | null
  rank: string | null
}

export interface LobbyCardInput {
  seats: LobbySeat[]
  /** The best player's main champion, centred art. */
  art: Buffer | null
  emblems: Record<string, Buffer | null>
}

const PORO_DIR = () => app.publicPath('home')
async function poro(name: 'cheeky' | 'snoozy' | 'peace' | 'snax' | 'king') {
  const file =
    name === 'king'
      ? join(app.publicPath('menu-art'), 'poroking.webp')
      : join(PORO_DIR(), `poro-${name}.webp`)
  return readFile(file).catch(() => null)
}

const APEX = new Set(['master', 'grandmaster', 'challenger'])
const ROLES = [
  { key: 'top', label: 'Top' },
  { key: 'jungle', label: 'Jungle' },
  { key: 'mid', label: 'Mid' },
  { key: 'bot', label: 'Bot' },
  { key: 'support', label: 'Support' },
] as const

export async function renderLobbyCard(input: LobbyCardInput): Promise<Buffer> {
  const parts: string[] = []
  const defs: string[] = [
    `<radialGradient id="light" cx="${W}" cy="0" r="${W * 1.05}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7b6dff" stop-opacity="0.3"/><stop offset="0.45" stop-color="#7b6dff" stop-opacity="0.08"/><stop offset="1" stop-color="#7b6dff" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="sink" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${C.ink}" stop-opacity="0.55"/><stop offset="0.45" stop-color="${C.ink}" stop-opacity="0.78"/><stop offset="1" stop-color="${C.ink}" stop-opacity="0.96"/></linearGradient>`,
    `<pattern id="grain" width="256" height="256" patternUnits="userSpaceOnUse"><image href="data:image/png;base64,${GRAIN_PNG}" width="256" height="256"/></pattern>`,
  ]
  parts.push(`<rect width="${W}" height="${H}" fill="${C.ink}"/>`)

  /* The stage: the best player's champion, sunk into the ink. */
  if (input.art) {
    const art = await dataUri(input.art, 1600)
    const scale = Math.max(W / art.w, H / art.h)
    parts.push(
      `<image href="${art.href}" x="${((W - art.w * scale) / 2).toFixed(1)}" y="${((H - art.h * scale) * 0.3).toFixed(1)}" width="${(art.w * scale).toFixed(1)}" height="${(art.h * scale).toFixed(1)}" preserveAspectRatio="none"/>`
    )
  }
  parts.push(`<rect width="${W}" height="${H}" fill="url(#sink)"/>`)
  parts.push(`<rect width="${W}" height="${H}" fill="url(#light)"/>`)
  parts.push(`<rect width="${W}" height="${H}" fill="url(#grain)" opacity="0.5"/>`)

  /* The mark and what this is. */
  const g = 34
  const k = g / 170
  parts.push(
    `<g transform="translate(${(64 - 54 * k).toFixed(1)} ${(54 - 22 * k).toFixed(1)}) scale(${k.toFixed(4)})" fill="${C.brand}"><path d="${LOGO}"/><polygon points="55.54 130.51 73.97 130.39 85.04 143.21 66.99 144.45 55.54 130.51"/></g>`
  )
  parts.push(text('kicker', 'invade.lol', C.text1, 26, 64 + g * 0.95 + 12, 54 + g * 0.8))
  const seats = input.seats.slice(0, 10)
  const title = seats.length
    ? seats.length === 1
      ? 'Scouting 1 player'
      : `Scouting ${seats.length} players`
    : 'Scout a whole lobby'
  parts.push(text('title', title, C.text1, 68, 64, 178, { tracking: -0.03 }))
  parts.push(
    text(
      'label',
      seats.length
        ? 'Ranks, roles and champions side by side'
        : 'Paste champion select, see every player side by side',
      C.text2,
      26,
      64,
      222
    )
  )

  /* The seats. */
  const rows = seats.length > 5 ? 2 : 1
  const per = 5
  const gap = 16
  const cw = (W - 64 * 2 - gap * (per - 1)) / per
  const top = rows === 1 ? 268 : 262
  const ch = rows === 1 ? 296 : 150
  const emblems: Record<string, { href: string; w: number; h: number }> = {}
  for (const [tier, bytes] of Object.entries(input.emblems))
    if (bytes) emblems[tier] = await dataUri(bytes, 300, true)
  const list: Array<LobbySeat | null> = seats.length ? seats : [null, null, null, null, null]
  for (let i = 0; i < list.length; i++) {
    const seat = list[i]
    const x = 64 + (i % per) * (cw + gap)
    const y = top + Math.floor(i / per) * (ch + 14)
    // A lit sheet: a faint fill, a hairline rim and a lit top edge.
    parts.push(
      `<rect x="${x.toFixed(1)}" y="${y}" width="${cw.toFixed(1)}" height="${ch}" rx="18" fill="#ffffff" fill-opacity="0.045" stroke="#ffffff" stroke-opacity="0.08"/>`
    )
    parts.push(
      `<rect x="${(x + 18).toFixed(1)}" y="${y}" width="${(cw - 36).toFixed(1)}" height="1.5" fill="#ffffff" fill-opacity="0.14"/>`
    )
    const ring = seat?.tier ? (TIER[seat.tier] ?? C.text3) : 'rgb(214 208 255 / 0.25)'
    if (rows === 1) {
      const r = 50
      const cx = x + cw / 2
      const cy = y + 26 + r
      parts.push(
        `<circle cx="${cx.toFixed(1)}" cy="${cy}" r="${r + 5}" fill="none" stroke="${ring}" stroke-width="3" stroke-opacity="0.9"/>`
      )
      if (seat?.icon) {
        const icon = await dataUri(seat.icon, 240)
        defs.push(
          `<clipPath id="s${i}"><circle cx="${cx.toFixed(1)}" cy="${cy}" r="${r}"/></clipPath>`
        )
        parts.push(
          `<image href="${icon.href}" x="${(cx - r).toFixed(1)}" y="${cy - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#s${i})" preserveAspectRatio="xMidYMid slice"/>`
        )
      } else if (seat) {
        parts.push(
          `<circle cx="${cx.toFixed(1)}" cy="${cy}" r="${r}" fill="#ffffff" fill-opacity="0.05"/>`
        )
        parts.push(text('title', '?', C.text3, 46, cx - measure('title', '?', 46) / 2, cy + 16))
      } else {
        // An empty lobby: the five roles, one a seat.
        const role = ROLES[i]
        parts.push(
          `<circle cx="${cx.toFixed(1)}" cy="${cy}" r="${r}" fill="#ffffff" fill-opacity="0.04"/>`
        )
        const s = 44
        const paths = ROLE_ICONS[role.key]
          .map(([d, o]) => `<path d="${d}" fill="${C.text2}" fill-opacity="${o}"/>`)
          .join('')
        parts.push(
          `<g transform="translate(${(cx - s / 2).toFixed(1)} ${cy - s / 2}) scale(${s / 32})">${paths}</g>`
        )
      }
      if (seat) {
        const name = fit('title', seat.gameName, cw - 28, 28, 18, -0.02)
        parts.push(
          text(
            'title',
            name.text,
            C.text1,
            name.size,
            cx - measure('title', name.text, name.size, -0.02) / 2,
            y + 182,
            { tracking: -0.02 }
          )
        )
        const tag = fit('label', `#${seat.tagLine}`, cw - 28, 20, 14)
        parts.push(
          text(
            'label',
            tag.text,
            C.text3,
            tag.size,
            cx - measure('label', tag.text, tag.size) / 2,
            y + 210
          )
        )
        const rank = seat.rank ?? 'Unranked'
        const rs = fit('kicker', rank, cw - 64, 20, 14)
        const em = seat.tier && emblems[seat.tier] ? 30 : 0
        const rw = measure('kicker', rs.text, rs.size) + (em ? em + 6 : 0)
        const rx = cx - rw / 2
        if (em) parts.push(emblem(emblems[seat.tier!], rx, y + 236, em))
        parts.push(
          text(
            'kicker',
            rs.text,
            seat.tier ? (TIER[seat.tier] ?? C.text2) : C.text3,
            rs.size,
            rx + (em ? em + 6 : 0),
            y + 258
          )
        )
      } else {
        const role = ROLES[i].label
        parts.push(
          text('title', role, C.text2, 26, cx - measure('title', role, 26, -0.02) / 2, y + 182, {
            tracking: -0.02,
          })
        )
        parts.push(
          text(
            'label',
            'Open seat',
            C.text4,
            20,
            cx - measure('label', 'Open seat', 20) / 2,
            y + 212
          )
        )
      }
    } else if (seat) {
      // Ten players: two rows, the icon left of the name.
      const r = 30
      const cx = x + 18 + r
      const cy = y + 46
      parts.push(
        `<circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="none" stroke="${ring}" stroke-width="2.5" stroke-opacity="0.9"/>`
      )
      if (seat.icon) {
        const icon = await dataUri(seat.icon, 160)
        defs.push(`<clipPath id="s${i}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`)
        parts.push(
          `<image href="${icon.href}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#s${i})" preserveAspectRatio="xMidYMid slice"/>`
        )
      } else {
        parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" fill-opacity="0.05"/>`)
        parts.push(text('title', '?', C.text3, 28, cx - measure('title', '?', 28) / 2, cy + 10))
      }
      const room = cw - 18 * 2
      const name = fit('title', seat.gameName, room, 22, 15, -0.02)
      parts.push(text('title', name.text, C.text1, name.size, x + 18, y + 110, { tracking: -0.02 }))
      const rank = seat.rank ?? 'Unranked'
      const rs = fit('kicker', rank, room - 30, 17, 12)
      const em = seat.tier && emblems[seat.tier] ? 24 : 0
      if (em) parts.push(emblem(emblems[seat.tier!], x + 16, y + 118, em))
      parts.push(
        text(
          'kicker',
          rs.text,
          seat.tier ? (TIER[seat.tier] ?? C.text2) : C.text3,
          rs.size,
          x + 18 + (em ? em + 4 : 0),
          y + 136
        )
      )
    }
  }

  /* The poro, peeking in from the top right. */
  const best = seats.find((s) => s.tier && APEX.has(s.tier))
  const kind = !seats.length ? 'snoozy' : best ? 'king' : 'cheeky'
  const bytes = await poro(kind)
  if (bytes) {
    const p = await dataUri(bytes, 420)
    const size = kind === 'king' ? 230 : 210
    parts.push(
      `<image href="${p.href}" x="${W - size - 36}" y="${kind === 'snoozy' ? 30 : 18}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`
    )
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs.join('')}</defs>${parts.join('')}</svg>`
  return sharp(Buffer.from(svg)).jpeg({ quality: 86, mozjpeg: true }).toBuffer()
}
