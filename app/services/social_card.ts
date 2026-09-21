import sharp from 'sharp'
import type { SummonerStats } from '#types/summoner'

export interface SocialCardProfile {
  gameName: string
  tagLine: string
  platform: string
}

export function escapeSvg(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!
  )
}

/** Render bytes on the server: social crawlers never execute the share-dialog canvas. */
export async function renderSocialCard(
  profile: SocialCardProfile,
  stats: SummonerStats['global'] | null,
  artwork?: Uint8Array
) {
  const background = artwork
    ? await sharp(artwork).resize(1200, 630, { fit: 'cover' }).png().toBuffer()
    : await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#101722' } })
        .png()
        .toBuffer()
  const name = escapeSvg(profile.gameName)
  const size = Math.min(
    66,
    Math.floor(1050 / Math.max(1, Array.from(profile.gameName).length) / 0.65)
  )
  const cells = stats?.total
    ? [
        ['WIN RATE', `${Math.round(stats.winrate * 100)}%`],
        ['KDA', stats.kda.toFixed(2)],
        ['CS / MIN', stats.csMin.toFixed(1)],
      ]
    : []
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs><linearGradient id="shade" x2="1" y2="1"><stop stop-color="#08090e" stop-opacity=".65"/><stop offset="1" stop-color="#08090e" stop-opacity=".94"/></linearGradient></defs>
    <rect width="1200" height="630" fill="url(#shade)"/>
    <g font-family="DejaVu Sans, sans-serif" fill="white">
      <text x="64" y="78" font-size="24" font-weight="bold">invade.lol</text>
      <text x="64" y="280" font-size="${size}" font-weight="bold">${name}</text>
      <text x="64" y="328" font-size="28" fill="#aab2c2">#${escapeSvg(profile.tagLine)} · ${escapeSvg(profile.platform)}</text>
      ${cells.map(([label, value], index) => `<text x="${64 + index * 340}" y="470" font-size="50" font-weight="bold">${value}</text><text x="${64 + index * 340}" y="505" font-size="17" fill="#a99aff">${label}</text>`).join('')}
    </g>
  </svg>`)
  return sharp(background)
    .composite([{ input: overlay }])
    .png()
    .toBuffer()
}
