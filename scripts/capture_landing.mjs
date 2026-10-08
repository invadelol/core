/**
 * Re-captures every image on the /app landing page from the desktop app itself, so the page
 * always shows the real, current UI (DIRECTION.md §11: flat screenshots, real numbers).
 *
 *   1. In the desktop app repo, run its browser preview (mock data):   pnpm dev   → :1420
 *   2. Here, in core:                                                  node scripts/capture_landing.mjs
 *      or some parts only:      node scripts/capture_landing.mjs window|overlay|frame|video|clips
 *
 * Writes into public/landing/:
 *   app-*.webp        main-window pages, 1440×900 CSS px at 2×, with the boxes the page's camera
 *                     moves to (fractions of the image)
 *   ov-*.webp         in-game overlay widgets on transparency, 2×: a reference of how the app
 *                     draws them (the page redraws them live: components/landing/overlay)
 *   game-frame.webp   a frame of Riot's own gameplay footage, at the same reference
 *   rift-*.mp4/.webp  the hero's loop of Riot's footage (720p and 480p, no audio) and its poster
 *   clip-*.webp       frames of the same footage, the thumbnails of the recording chapter
 *   og.png            the /app social card, a 1200×630 crop of the home screen
 *   shots.json        every image's size, each widget's place on the screen and the camera boxes,
 *                     read by components/landing/SceneChampions.vue
 *
 * Needs Chrome, and puppeteer-core from the desktop app repo (INVADE_DIR, default ../invade).
 */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public/landing')
const INVADE = process.env.INVADE_DIR ?? path.resolve(ROOT, '../invade')
const BASE = process.env.INVADE_URL ?? 'http://localhost:1420'
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FFMPEG = process.env.FFMPEG ?? '/opt/homebrew/bin/ffmpeg'
/** Riot's footage, the top-down clip, at a moment with two champions on a lane. */
const FOOTAGE = path.join(INVADE, 'video/public/riot/rift-topdown.mp4')
const FRAME_AT = '6.2'

const require = createRequire(path.join(INVADE, 'video/package.json'))
const puppeteer = require('puppeteer-core')

const only = process.argv.slice(2)
const want = (part) => !only.length || only.includes(part)
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** A box on the page as fractions of the 1440×900 window, for the landing page's camera. */
async function box(page, find) {
  const rect = await page.evaluate(find)
  if (!rect) return null
  const round = (n) => +n.toFixed(4)
  return {
    x: round(rect.x / 1440),
    y: round(rect.y / 900),
    w: round(rect.w / 1440),
    h: round(rect.h / 900),
  }
}

const rectOf = (el) => {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height }
}

/** Main-window pages: [file, hash, optional preparation returning extra manifest fields]. */
const PAGES = [
  ['app-dashboard', '#dashboard'],
  [
    // The ranking, Mid at the player's rank: the row the landing page "opens" is Ahri's.
    'app-tierlist',
    '#champions',
    async (page) => ({
      focus: await box(
        page,
        `(${rectOf})([...document.querySelectorAll('.rk tr')].find((tr) => [...tr.querySelectorAll('*')].some((el) => el.textContent?.trim() === 'Ahri')))`
      ),
    }),
  ],
  [
    'app-champion',
    '#champions:103',
    async (page) => ({
      header: await box(page, `(${rectOf})(document.querySelector('.cp-head'))`),
      build: await box(page, `(${rectOf})(document.querySelector('.bp'))`),
      runes: await box(page, `(${rectOf})(document.querySelector('.bp-runes'))`),
      action: await box(
        page,
        `(${rectOf})([...document.querySelectorAll('button')].find((b) => /Use this setup/.test(b.textContent ?? '')))`
      ),
    }),
  ],
]

/** Overlay widgets, by the title the app gives them (overlay-config.ts). */
const WIDGETS = {
  'Objectives': 'objectives',
  'Win & gold': 'lead',
  'Performance': 'perf',
  'Next item': 'build',
}

const manifest = existsSync(path.join(OUT, 'shots.json'))
  ? JSON.parse(await readFile(path.join(OUT, 'shots.json'), 'utf8'))
  : {}

await mkdir(OUT, { recursive: true })
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none'],
})

async function open(
  target,
  { width = 1440, height = 900, transparent = false, storage = {} } = {}
) {
  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 2 })
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
  await page.evaluateOnNewDocument((entries) => {
    localStorage.setItem('invade.locale', 'en')
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value)
  }, storage)
  if (transparent) {
    const cdp = await page.createCDPSession()
    await cdp.send('Emulation.setDefaultBackgroundColorOverride', {
      color: { r: 0, g: 0, b: 0, a: 0 },
    })
  }
  await page.goto(BASE + '/' + target, { waitUntil: 'networkidle0', timeout: 60_000 })
  await page.evaluate(() => document.fonts.ready)
  await wait(1800)
  return page
}

async function save(name, png, { quality = 80 } = {}) {
  const image = sharp(png)
  const { width, height } = await image.metadata()
  await image.webp({ quality, alphaQuality: 90, effort: 6 }).toFile(path.join(OUT, `${name}.webp`))
  manifest[name] = { width, height }
  console.log(name, `${width}×${height}`)
}

if (want('window')) {
  for (const [name, hash, prepare] of PAGES) {
    const page = await open(hash)
    const extra = prepare ? await prepare(page) : null
    await page.mouse.move(1439, 899)
    const png = await page.screenshot({ type: 'png' })
    await save(name, png)
    if (extra) Object.assign(manifest[name], extra)
    if (name === 'app-dashboard') {
      // The social card: the home screen past the sidebar and the top bar, at 1200×630.
      await sharp(png)
        .extract({ left: 400, top: 96, width: 2400, height: 1260 })
        .resize(1200, 630)
        .png({ compressionLevel: 9, palette: false })
        .toFile(path.join(OUT, 'og.png'))
      console.log('og.png 1200×630')
    }
    await page.close()
  }
}

if (want('overlay')) {
  const conf = { widgets: { lead: { on: true, scale: 1 } } }
  const page = await open('', {
    width: 1600,
    height: 1000,
    transparent: true,
    storage: { 'invade.overlay.v2': JSON.stringify(conf) },
  })
  await wait(1500)
  const placed = []
  for (const el of await page.$$('section.widget')) {
    const label = await el.evaluate((node) => node.getAttribute('aria-label') ?? '')
    const id = WIDGETS[label]
    if (!id) continue
    const box = await el.boundingBox()
    await save(`ov-${id}`, await el.screenshot({ type: 'png', omitBackground: true }), {
      quality: 90,
    })
    // Where the widget sits on the screen, as fractions, so the page can place it the same way.
    placed.push({
      id,
      title: label,
      x: +(box.x / 1600).toFixed(4),
      y: +(box.y / 1000).toFixed(4),
      w: +(box.width / 1600).toFixed(4),
    })
  }
  manifest.overlay = placed
  await page.close()
}

if (want('frame')) {
  const png = execFileSync(
    FFMPEG,
    [
      ...['-v', 'error', '-ss', FRAME_AT, '-i', FOOTAGE],
      ...['-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'],
    ],
    { maxBuffer: 64 * 1024 * 1024 }
  )
  await save('game-frame', png, { quality: 72 })
}

/** Riot's own footage, as the hero's muted loop: a crossfade at the seam so it never jumps. */
if (want('video')) {
  const source = path.join(INVADE, 'video/public/riot/rift-leesin.mp4')
  const [from, length, fade] = [0.4, 12, 0.8]
  const encode = (height, crf, out) =>
    execFileSync(FFMPEG, [
      ...['-v', 'error', '-y', '-ss', String(from), '-t', String(length), '-i', source],
      '-filter_complex',
      // The loop plays [fade, length] and ends by fading into [0, fade]: last frame = first.
      `[0:v]split[a][b];[a]trim=${fade}:${length},setpts=PTS-STARTPTS[main];` +
        `[b]trim=0:${fade},setpts=PTS-STARTPTS[head];` +
        `[main][head]xfade=transition=fade:duration=${fade}:offset=${length - 2 * fade},` +
        `scale=-2:${height}:flags=lanczos,fps=30,format=yuv420p[v]`,
      ...['-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'veryslow', '-crf', String(crf)],
      ...['-profile:v', 'high', '-movflags', '+faststart', path.join(OUT, out)],
    ])
  encode(720, 27, 'rift-loop-720.mp4')
  encode(480, 28, 'rift-loop-480.mp4')
  const poster = execFileSync(
    FFMPEG,
    [
      ...['-v', 'error', '-ss', String(from + fade), '-i', source],
      ...['-frames:v', '1', '-vf', 'scale=1280:-2', '-f', 'image2pipe', '-vcodec', 'png', '-'],
    ],
    { maxBuffer: 64 * 1024 * 1024 }
  )
  await save('rift-loop-poster', poster, { quality: 70 })
}

/** Thumbnails for the recording chapter: frames of the same footage, 16:9. */
if (want('clips')) {
  const frames = [
    ['clip-kill', 'rift-leesin.mp4', '3.1'],
    ['clip-baron', 'rift-howto.mp4', '7.6'],
    ['clip-saved', 'rift-leesin.mp4', '9.4'],
    ['clip-death', 'rift-topdown.mp4', '9.2'],
  ]
  for (const [name, file, at] of frames) {
    const png = execFileSync(
      FFMPEG,
      [
        ...['-v', 'error', '-ss', at, '-i', path.join(INVADE, 'video/public/riot', file)],
        ...['-frames:v', '1', '-vf', 'scale=480:-2', '-f', 'image2pipe', '-vcodec', 'png', '-'],
      ],
      { maxBuffer: 64 * 1024 * 1024 }
    )
    await save(name, png, { quality: 70 })
  }
}

await browser.close()
await writeFile(path.join(OUT, 'shots.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log('wrote', path.join(OUT, 'shots.json'))
