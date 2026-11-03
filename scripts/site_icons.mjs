// Draws the site's app icons (public/icons/): the desktop app icon's mark on its dark ground, as
// the Discord presence badge draws it (presence_badge.mjs), for phones' home screens and the web
// app manifest (public/site.webmanifest). The maskable one keeps the mark inside the safe circle.
//   node scripts/site_icons.mjs
import sharp from 'sharp'

const MARK = `
  <path d="M140.32,114.78l66.57-52.4-84.5,29.38,18.32-28.35-30.09,17.83,39.13-56.71-79.86,45.07-7.92,13.62.91,24.19,31.05,8.35,9.9,22.32,25.04,9.9-8.54,18.83-36.29.19v8.54l67.35,14.75-21.54-28.53,71.03-44.25-60.55-2.72ZM73.47,105.37l14.19-27.76,4.98,27.76h-19.17Z"/>
  <polygon points="55.54 130.51 73.97 130.39 85.04 143.21 66.99 144.45 55.54 130.51"/>`

/** The icon on a 256 grid: `scale` sizes the mark (0.98 fills the square, less leaves a margin). */
const icon = (
  scale
) => `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <radialGradient id="glow" cx="0.5" cy="0.47" r="0.5"><stop offset="0" stop-color="#7b6dff" stop-opacity="0.5"/><stop offset="1" stop-color="#7b6dff" stop-opacity="0"/></radialGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b7afff"/><stop offset="0.55" stop-color="#7b6dff"/><stop offset="1" stop-color="#5448e0"/></linearGradient>
  </defs>
  <rect width="256" height="256" fill="#0d0c14"/>
  <circle cx="128" cy="124" r="${118 * scale}" fill="url(#glow)"/>
  <g transform="translate(133 130) scale(${scale}) translate(-131.5 -107)" fill="url(#mark)">${MARK}</g>
</svg>`

const out = [
  ['icon-192.png', 192, 0.86],
  ['icon-512.png', 512, 0.86],
  ['maskable-512.png', 512, 0.62],
  ['apple-touch-icon.png', 180, 0.8],
]
for (const [file, size, scale] of out) {
  await sharp(Buffer.from(icon(scale)), { density: (72 * size) / 256 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(`public/icons/${file}`)
}
