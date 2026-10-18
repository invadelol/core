/** Local review assets from the production renderer and public CDN art. */
import { writeFile, mkdir } from 'node:fs/promises'
import { renderPresenceCard, parsePresenceQuery } from '../app/services/presence_card.js'
const out = new URL('../docs/review-presence/revision-4/', import.meta.url)
await mkdir(out, { recursive: true })
const get = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status}: ${url}`)
  return new Uint8Array(await response.arrayBuffer())
}
const art = await get('https://invade.lol/cdn/16.20/centered/103')
await writeFile(new URL('art.jpg', out), art)
for (const [name, query] of [
  ['idle', { p: 'idle', tier: 'emerald' }],
  ['planning', { p: 'draft', s: 'planning' }],
  ['banning', { p: 'draft', s: 'banning' }],
  ['picking', { p: 'draft', s: 'picking' }],
  ['locked', { p: 'draft', s: 'locked', r: 'mid' }],
  ['loading', { p: 'draft', s: 'loading', r: 'mid' }],
  ['game', { k: '7', d: '2', a: '9', r: 'mid' }],
  ['result', { k: '7', d: '2', a: '9', r: 'mid' }],
] as const) {
  const card = parsePresenceQuery(query)!
  const image = await renderPresenceCard(
    card,
    ['planning', 'banning', 'picking'].includes(name) ? undefined : art
  )
  await writeFile(new URL(`${name}.png`, out), image)
}
