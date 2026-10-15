import sharp from 'sharp'
import { GLYPHS } from '#services/presence_glyphs'

/**
 * The picture of the desktop app's Discord presence: the champion's art, the score at the bottom
 * left, and under it the app's role icon or, while dead, the respawn countdown. It holds no word,
 * so it reads the same in every language. Discord shows it at about 96 px with the app's round
 * badge over the bottom right corner, so that corner stays empty. Everything drawn comes from the
 * query, validated to numbers and five roles: no free text.
 */
export const PRESENCE_SIZE = 256

export type PresenceRole = 'top' | 'jungle' | 'mid' | 'bot' | 'support'

export interface PresenceCard {
  kills: number
  deaths: number
  assists: number
  role?: PresenceRole
  /** Seconds to respawn: the art turns grey and the countdown replaces the role. */
  respawn?: number
}

/** The role icons of @invadelol/ui (`RoleIcon`, 34 by 34): [path, opacity]. */
const ROLE_ICONS: Record<PresenceRole, [string, number][]> = {
  top: [
    ['M21 14h-7v7h7v-7Zm5-3v15H11.014l-4 4H30V7.016Z', 0.5],
    ['m4 4 .003 24.045 4.997-5V9h14l5.045-4.997Z', 1],
  ],
  jungle: [
    [
      'M25 3c-2.128 3.3-5.147 6.851-6.966 11.469A42.373 42.373 0 0 1 20 20a27.7 27.7 0 0 1 1-3c0-4.977 1.856-8.723 4-14ZM13 20c-1.488-4.487-4.76-6.966-9-9 3.868 3.136 4.422 7.52 5 12l3.743 3.312C14.215 27.917 16.527 30.451 17 31c4.555-9.445-3.366-20.8-8-28 2.67 6.573 4.717 10.342 4 17Zm8 5a15.271 15.271 0 0 1 0 2l4-4c.578-4.48 1.132-8.864 5-12-5.288 2.537-7.866 7.854-9 14Z',
      1,
    ],
  ],
  mid: [
    ['m30 12.968-4.008 4L26 26h-9l-4 4h17ZM16.979 8 21 4H4v16.977L8 17V8Z', 0.5],
    ['M25 4 4 25v5h5L30 9V4Z', 1],
  ],
  bot: [
    ['M13 20h7v-7h-7v7ZM4 4v22.984l3.955-4L8 8h14.986l4-4Z', 0.5],
    ['m29.997 5.955-4.997 5V25H11l-5.045 4.997L30 30Z', 1],
  ],
  support: [
    [
      'M26 13c3.535 0 8-4 8-4H23l-3 3 2 7 5-2-3-4h2ZM22 5l-1.173-2H13.062L12 5l5 6Zm-5 9-1-1-3 15 4 3 4-3-3-15ZM11 9H0s4.465 4 8 4h2l-3 4 5 2 2-7Z',
      1,
    ],
  ],
}

/** The card a query asks for, or `null` when anything in it is not a plain number or role. */
export function parsePresenceQuery(query: Record<string, unknown>): PresenceCard | null {
  const int = (value: unknown, max: number) => {
    if (typeof value !== 'string' || !/^\d{1,3}$/.test(value)) return null
    const n = Number(value)
    return n <= max ? n : null
  }
  const [kills, deaths, assists] = [int(query.k, 99), int(query.d, 99), int(query.a, 199)]
  if (kills === null || deaths === null || assists === null) return null
  const respawn = query.t === undefined ? undefined : int(query.t, 200)
  // `m`, the game's length, came with the first design: still accepted, no longer drawn.
  const minutes = query.m === undefined ? undefined : int(query.m, 180)
  const role =
    typeof query.r === 'string' && Object.hasOwn(ROLE_ICONS, query.r)
      ? (query.r as PresenceRole)
      : undefined
  if (respawn === null || minutes === null || (query.r !== undefined && !role)) return null
  return { kills, deaths, assists, role, respawn }
}

/** `0:23`. */
function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** Text in one colour, with `pad` em of air on each side. */
type Run = { text: string; fill: string; pad?: number }

/**
 * Sets `runs` in one of the bundled Archivo faces (`presence_glyphs`) as SVG paths, from `x` on
 * the `baseline`, at `size` px with `tracking` em between letters. Returns the markup and the
 * width it takes.
 */
function setType(
  face: keyof typeof GLYPHS,
  runs: Run[],
  size: number,
  tracking: number,
  x: number,
  baseline: number
) {
  const font = GLYPHS[face]
  const glyphs = font.glyphs as Record<string, readonly [number, string]>
  let advance = 0
  const paths: string[] = []
  for (const run of runs) {
    advance += (run.pad ?? 0) * font.units
    for (const char of run.text) {
      const glyph = glyphs[char]
      if (!glyph) continue
      if (glyph[1])
        paths.push(`<path transform="translate(${advance} 0)" fill="${run.fill}" d="${glyph[1]}"/>`)
      advance += glyph[0] + tracking * font.units
    }
    advance += (run.pad ?? 0) * font.units
  }
  const scale = size / font.units
  const width = (advance - tracking * font.units) * scale
  return {
    svg: `<g transform="translate(${x} ${baseline}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})">${paths.join('')}</g>`,
    width,
  }
}

/** The score in figures, the slashes quieter: `7 / 2 / 9`. */
function scoreRuns(card: PresenceCard): Run[] {
  const slash = { text: '/', fill: '#ffffff6b', pad: 0.05 }
  const figure = (n: number) => ({ text: String(n), fill: '#ffffff' })
  return [figure(card.kills), slash, figure(card.deaths), slash, figure(card.assists)]
}

export async function renderPresenceCard(card: PresenceCard, artwork?: Uint8Array) {
  const size = PRESENCE_SIZE
  const dead = card.respawn !== undefined
  let art = artwork
    ? sharp(artwork).resize(size, size, { fit: 'cover', position: 'attention' })
    : sharp({ create: { width: size, height: size, channels: 4, background: '#101016' } })
  if (dead) art = art.grayscale().modulate({ brightness: 0.55 })
  const background = await art.png().toBuffer()

  const left = 18
  const captionLine = 230
  let label = ''
  if (dead) {
    const countdown = [{ text: clock(card.respawn!), fill: '#ffffff' }]
    label = setType('caption', countdown, 24, 0.06, left + 1, captionLine).svg
  } else if (card.role) {
    const icon = ROLE_ICONS[card.role]
      .map(([d, opacity]) => `<path d="${d}" fill="#d3d4e0" opacity="${opacity}"/>`)
      .join('')
    label = `<g transform="translate(${left} ${captionLine - 22}) scale(${(26 / 34).toFixed(4)})">${icon}</g>`
  }
  // The score fills what the badge's corner leaves (about 178 px), at most 62 px tall type.
  const scoreLine = label ? 197 : captionLine
  let fontSize = 62
  let score = setType('score', scoreRuns(card), fontSize, 0.01, left, scoreLine)
  if (score.width > 178) {
    fontSize = Math.floor((fontSize * 178) / score.width)
    score = setType('score', scoreRuns(card), fontSize, 0.01, left, scoreLine)
  }

  const overlay =
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#08090c" stop-opacity=".2"/>
      <stop offset=".3" stop-color="#08090c" stop-opacity="0"/>
      <stop offset=".46" stop-color="#08090c" stop-opacity="0"/>
      <stop offset=".78" stop-color="#08090c" stop-opacity=".78"/>
      <stop offset="1" stop-color="#08090c" stop-opacity=".95"/>
    </linearGradient></defs>
    <rect width="${size}" height="${size}" fill="url(#shade)"/>
    ${score.svg}
    ${label}
  </svg>`)
  return sharp(background)
    .composite([{ input: overlay }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}
