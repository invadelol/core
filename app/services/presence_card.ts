import sharp from 'sharp'
import { GLYPHS } from '#services/presence_glyphs'

/**
 * The picture of the desktop app's Discord presence: the champion's art, the score line at the
 * bottom left, and under it the role or, while dead, the respawn countdown. Discord shows it at
 * about 96 px with the app's round badge over the bottom right corner, so that corner stays empty.
 * Everything drawn comes from the query, validated to numbers and a few words: no free text.
 */
export const PRESENCE_SIZE = 256

export interface PresenceCard {
  kills: number
  deaths: number
  assists: number
  /** `TOP`, `JGL`, `MID`, `BOT`, `SUP`, or a game length such as `31 MIN`. */
  caption: string
  /** Seconds to respawn: the art turns grey and the caption counts down. */
  respawn?: number
}

const ROLES: Record<string, string> = {
  top: 'TOP',
  jungle: 'JGL',
  mid: 'MID',
  bot: 'BOT',
  support: 'SUP',
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
  const minutes = query.m === undefined ? undefined : int(query.m, 180)
  const role = typeof query.r === 'string' ? ROLES[query.r] : undefined
  if (respawn === null || minutes === null || (query.r !== undefined && !role)) return null
  const caption =
    respawn !== undefined ? '' : minutes !== undefined ? `${minutes} MIN` : (role ?? '')
  return { kills, deaths, assists, caption, respawn }
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
  const caption = dead ? clock(card.respawn!) : card.caption
  const captionLine = 230
  // The score fills what the badge's corner leaves (about 178 px), at most 62 px tall type.
  const scoreLine = caption ? 197 : captionLine
  let fontSize = 62
  let score = setType('score', scoreRuns(card), fontSize, 0.01, left, scoreLine)
  if (score.width > 178) {
    fontSize = Math.floor((fontSize * 178) / score.width)
    score = setType('score', scoreRuns(card), fontSize, 0.01, left, scoreLine)
  }
  const label = caption
    ? setType(
        'caption',
        [{ text: caption, fill: dead ? '#ffffff' : '#c3c4d3' }],
        24,
        0.12,
        left + 1,
        captionLine
      ).svg
    : ''

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
