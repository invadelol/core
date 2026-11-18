/**
 * Writes resources/og/poros/<mood>.png: the poros the link previews (`app/services/og/`) place,
 * from Riot's summoner emotes on CommunityDragon. Each emote's coloured halo is taken off (its
 * half-transparent pixels), so the poro stands on the card's own light, then trimmed.
 *
 *     node scripts/og_poros.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const ROOT = new URL('..', import.meta.url).pathname
const OUT = join(ROOT, 'resources/og/poros')
const CDRAGON =
  'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/loadouts/summoneremotes'

/** Mood: the emote's inventory art. */
export const POROS = {
  cheeky: 'flairs/poro_happy_taunt_inventory.png',
  peace: 'flairs/poro_happy_cheers_inventory.png',
  snax: 'events/arammayhem/5047_porosnax_please_inventory.png',
  snoozy: 'events/poolparty/em_pool_party_poro_01_inventory.png',
  love: 'events/snowdown/event_snowdown_poro_love_inventory.png',
  fan: 'rewards/watchrewards/teampass/em_esports_poro_inventory.png',
  hype: 'rewards/watchrewards/em_esports_porohype_inventory.png',
  buddies: 'flairs/em_poro_buddies_inventory.png',
  rocker: 'events/mayhem/5205_pentakill_poro_inventory.accessories_16_21.png',
  bouncer: 'events/mayhem/5209_bouncer_poro_inventory.accessories_16_21.png',
  ghost: 'events/s3a1_2026/5124_ghostly_poro_inventory.accessories_16_15.png',
}

/**
 * The halo: pixels under LOW alpha go. Then the opaque ring it leaves around the fur goes too,
 * found by colour: from the transparent outside inwards, every pixel of the halo's hue (taken
 * from its half-transparent pixels) and strong enough colour, until the fur (white, grey) or an
 * outline (dark) stops it.
 */
const LOW = 140
const KEEP_COLOUR = new Set(['rocker'])
const CHROMA = 50
const HUE_SPREAD = 32

function hueOf(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (!d) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

await mkdir(OUT, { recursive: true })
for (const [mood, path] of Object.entries(POROS)) {
  const response = await fetch(`${CDRAGON}/${path}`)
  if (!response.ok) throw new Error(`${mood}: ${response.status}`)
  const { data, info } = await sharp(Buffer.from(await response.arrayBuffer()))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const n = width * height
  // The halo's hue: the mean direction of its half-transparent, coloured pixels.
  let hx = 0
  let hy = 0
  for (let i = 0; i < n; i++) {
    const [r, g, b, a] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]]
    if (a < 40 || a > 200 || Math.max(r, g, b) - Math.min(r, g, b) < CHROMA) continue
    const h = (hueOf(r, g, b) * Math.PI) / 180
    hx += Math.cos(h)
    hy += Math.sin(h)
  }
  const halo = ((Math.atan2(hy, hx) * 180) / Math.PI + 360) % 360
  // A poro holding things the halo's colour (a hat, flames, gems) keeps them: only its faint halo goes.
  const keep = KEEP_COLOUR.has(mood)
  const isHalo = (i) => {
    if (keep) return false
    const [r, g, b] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]
    if (Math.max(r, g, b) - Math.min(r, g, b) < CHROMA || Math.max(r, g, b) < 90) return false
    const d = Math.abs(hueOf(r, g, b) - halo)
    return Math.min(d, 360 - d) <= HUE_SPREAD
  }
  const gone = new Uint8Array(n)
  const queue = []
  for (let i = 0; i < n; i++)
    if (data[i * 4 + 3] <= LOW) {
      gone[i] = 1
      queue.push(i)
    }
  while (queue.length) {
    const i = queue.pop()
    const x = i % width
    const y = (i / width) | 0
    for (const j of [
      x > 0 ? i - 1 : -1,
      x < width - 1 ? i + 1 : -1,
      y > 0 ? i - width : -1,
      y < height - 1 ? i + width : -1,
    ]) {
      if (j < 0 || gone[j] || !isHalo(j)) continue
      gone[j] = 1
      queue.push(j)
    }
  }
  // A soft edge: each kept pixel loses alpha with the gone pixels around it.
  for (let i = 0; i < n; i++) {
    if (gone[i]) {
      data[i * 4 + 3] = 0
      continue
    }
    const x = i % width
    const y = (i / width) | 0
    let around = 0
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ])
      if (
        x + dx < 0 ||
        x + dx >= width ||
        y + dy < 0 ||
        y + dy >= height ||
        gone[(y + dy) * width + x + dx]
      )
        around++
    data[i * 4 + 3] = Math.round(data[i * 4 + 3] * (1 - around * 0.2))
  }
  const png = await sharp(data, { raw: info }).trim({ threshold: 1 }).png().toBuffer()
  await writeFile(
    join(OUT, `${mood}.png`),
    await sharp(png).png({ compressionLevel: 9 }).toBuffer()
  )
  console.log(mood, (await sharp(png).metadata()).width, (await sharp(png).metadata()).height)
}
