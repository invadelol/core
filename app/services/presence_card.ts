import sharp from 'sharp'

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

export async function renderPresenceCard(card: PresenceCard, artwork?: Uint8Array) {
  const size = PRESENCE_SIZE
  const dead = card.respawn !== undefined
  let art = artwork
    ? sharp(artwork).resize(size, size, { fit: 'cover', position: 'attention' })
    : sharp({ create: { width: size, height: size, channels: 4, background: '#101016' } })
  if (dead) art = art.grayscale().modulate({ brightness: 0.55 })
  const background = await art.png().toBuffer()

  const score = `${card.kills}/${card.deaths}/${card.assists}`
  // The score keeps clear of the badge's corner, whatever its length.
  const fontSize = Math.min(54, Math.floor(178 / (score.length * 0.62)))
  const caption = dead ? clock(card.respawn!) : card.caption
  const overlay =
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#08090c" stop-opacity=".25"/>
      <stop offset=".32" stop-color="#08090c" stop-opacity="0"/>
      <stop offset=".5" stop-color="#08090c" stop-opacity="0"/>
      <stop offset="1" stop-color="#08090c" stop-opacity=".94"/>
    </linearGradient></defs>
    <rect width="${size}" height="${size}" fill="url(#shade)"/>
    <g font-family="DejaVu Sans, sans-serif" font-weight="bold">
      <text x="16" y="${caption ? 196 : 232}" font-size="${fontSize}" fill="#ffffff" letter-spacing="-1">${score}</text>
      ${caption ? `<text x="18" y="236" font-size="28" fill="${dead ? '#ffffff' : '#b9bacb'}" letter-spacing="1.5">${caption}</text>` : ''}
    </g>
  </svg>`)
  return sharp(background)
    .composite([{ input: overlay }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}
