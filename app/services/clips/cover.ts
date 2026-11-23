import riotAssets from '#services/riot/assets'
import { keyEvent } from '#services/clips/events'
import { clipKey, clipStore } from '#services/clips/storage'
import {
  C,
  FOOT,
  H,
  PAD,
  W,
  foot,
  maybe,
  measure,
  portrait,
  render,
  stage,
  text,
  title,
} from '#services/og/kit'
import type { Clip } from '../../../inertia/lib/clip_types.js'

/** The game clock of a moment: "9:12". */
const clock = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** The duel's crossed swords (the site's `swords` icon, 24 by 24 strokes), `size` wide at (x, y). */
function swords(x: number, y: number, size: number) {
  const k = size / 24
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k.toFixed(4)})" fill="none" stroke="${C.text1}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5 18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2"/></g>`
}

async function posterBytes(id: string): Promise<Buffer | null> {
  const file = await clipStore()
    .read(clipKey(id, 'poster'))
    .catch(() => null)
  if (file) {
    const chunks: Buffer[] = []
    for await (const chunk of file.stream) chunks.push(chunk as Buffer)
    return Buffer.concat(chunks)
  }
  const url = await clipStore()
    .url(clipKey(id, 'poster'))
    .catch(() => null)
  if (!url) return null
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null)
  return response?.ok ? Buffer.from(await response.arrayBuffer()) : null
}

/**
 * A clip's link preview (the moment cover): its picture faded into the ink, the title large, the
 * duel (the clip's champion and the other one of its key event), the moment in violet with its
 * game time.
 */
export async function renderClipCover(clip: Clip) {
  const key = keyEvent(clip.events, clip.championId)
  const rival = (key?.kind === 'death' ? key.killer : key?.victim) ?? null
  const [poster, mine, theirs] = await Promise.all([
    posterBytes(clip.id).then((b) => maybe(b, 1280)),
    riotAssets.get('champion', String(clip.championId)).then((a) => maybe(a.body, 144)),
    rival ? riotAssets.get('champion', String(rival)).then((a) => maybe(a.body, 144)) : null,
  ])
  const scene = stage({
    art: poster,
    box: { x: 0, y: 0, w: W, h: H },
    focus: { fx: 0.6, fy: 0.5 },
    fadeLeft: 0.7,
    fadeFoot: 0.5,
    dim: 0.95,
  })
  let body = scene.svg
  body += title([[clip.title, C.text1]], PAD, PAD + 8, 620, { max: 92, min: 54, lines: 3 }).svg

  const size = 76
  const top = FOOT - 64 - size
  let x = PAD
  body += portrait(mine, x, top, size)
  x += size
  if (rival) {
    body += swords(x + 13, top + size / 2 - 14, 28)
    x += 54
    body += portrait(theirs, x, top, size)
    x += size
  }
  const word = clip.moment?.replace(/ (on|to) .*$/, '') ?? 'Clip'
  const at = clock(clip.momentAt ?? clip.startMs)
  x += 28
  const baseline = top + size / 2 + 15
  body += text('display', word, C.brand, 44, x, baseline)
  body += text('display', at, C.text1, 44, x + measure('display', word, 44) + 16, baseline)
  body += foot()
  return render(scene.defs, body)
}
