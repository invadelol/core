/**
 * Small flags for the server menus (EUW, NA, KR…), drawn here as SVG and served as data URLs, so
 * they work anywhere a picture does (a `Select` option's `icon`, an `<img>`), with no image host.
 *
 * A server that is one country shows that country's flag, simplified to read at 16 px. A server
 * that spans several countries (EUW, EUNE, LAN, LAS, OCE, ME, SEA, and TW, kept neutral) shows
 * the same regional mark: a small globe with a lit dot where the server plays. Every server at
 * once is the globe without a dot.
 */

const W = 21
const H = 15

/** A flag's frame: rounded corners and a hairline that holds a white flag on a white page. */
function frame(body: string) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">` +
    `<defs><clipPath id="c"><rect width="${W}" height="${H}" rx="2.5"/></clipPath></defs>` +
    `<g clip-path="url(#c)">${body}</g>` +
    `<rect x=".25" y=".25" width="${W - 0.5}" height="${H - 0.5}" rx="2.3" fill="none" stroke="#000" stroke-opacity=".22" stroke-width=".5"/>` +
    `</svg>`
  )
}

/** A five-pointed star of radius `r` at (`x`, `y`). */
function star(x: number, y: number, r: number, fill: string) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 ? r * 0.4 : r
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    return `${(x + radius * Math.cos(angle)).toFixed(2)},${(y + radius * Math.sin(angle)).toFixed(2)}`
  })
  return `<polygon points="${points.join(' ')}" fill="${fill}"/>`
}

function usa() {
  const stripe = H / 13
  let body = `<rect width="${W}" height="${H}" fill="#fff"/>`
  for (let i = 0; i < 13; i += 2) {
    body += `<rect y="${(i * stripe).toFixed(3)}" width="${W}" height="${stripe.toFixed(3)}" fill="#b22234"/>`
  }
  body += `<rect width="8.6" height="${(7 * stripe).toFixed(3)}" fill="#3c3b6e"/>`
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      body += `<circle cx="${1.3 + col * 2}" cy="${1.4 + row * 2.6}" r=".42" fill="#fff"/>`
    }
  }
  return body
}

function korea() {
  // The taegeuk turned as on the flag, and the four trigrams as plain bars.
  const bars = (x: number, y: number, angle: number) =>
    `<g transform="translate(${x} ${y}) rotate(${angle})" fill="#111">` +
    `<rect x="-1.7" y="-1.25" width="3.4" height=".55"/><rect x="-1.7" y="-.27" width="3.4" height=".55"/><rect x="-1.7" y=".71" width="3.4" height=".55"/></g>`
  return (
    `<rect width="${W}" height="${H}" fill="#fff"/>` +
    `<g transform="rotate(33.7 10.5 7.5)">` +
    `<path d="M6.7 7.5a3.8 3.8 0 0 1 7.6 0Z" fill="#cd2e3a"/>` +
    `<path d="M6.7 7.5a3.8 3.8 0 0 0 7.6 0Z" fill="#0047a0"/>` +
    `<circle cx="8.6" cy="7.5" r="1.9" fill="#cd2e3a"/><circle cx="12.4" cy="7.5" r="1.9" fill="#0047a0"/></g>` +
    bars(3.6, 3.3, -56.3) +
    bars(17.4, 11.7, -56.3) +
    bars(17.4, 3.3, 56.3) +
    bars(3.6, 11.7, 56.3)
  )
}

function brazil() {
  return (
    `<rect width="${W}" height="${H}" fill="#009c3b"/>` +
    `<path d="M2 7.5 10.5 1.6 19 7.5 10.5 13.4Z" fill="#ffdf00"/>` +
    `<circle cx="10.5" cy="7.5" r="3.4" fill="#002776"/>` +
    `<path d="M7.3 6.6c2.2-.5 4.6-.2 6.4 1.1" fill="none" stroke="#fff" stroke-width=".55"/>`
  )
}

function japan() {
  return `<rect width="${W}" height="${H}" fill="#fff"/><circle cx="10.5" cy="7.5" r="4.2" fill="#bc002d"/>`
}

function turkey() {
  return (
    `<rect width="${W}" height="${H}" fill="#e30a17"/>` +
    `<circle cx="8.2" cy="7.5" r="3.75" fill="#fff"/><circle cx="9.15" cy="7.5" r="3" fill="#e30a17"/>` +
    star(12.9, 7.5, 1.45, '#fff')
  )
}

function vietnam() {
  return `<rect width="${W}" height="${H}" fill="#da251d"/>${star(10.5, 7.9, 4.3, '#ffff00')}`
}

function russia() {
  return (
    `<rect width="${W}" height="5" fill="#fff"/>` +
    `<rect y="5" width="${W}" height="5" fill="#0039a6"/>` +
    `<rect y="10" width="${W}" height="5" fill="#d52b1e"/>`
  )
}

/** The regional mark: a globe, and a lit dot at (`lon`, `lat`) when the server has a place. */
function globe(at: [number, number] | null) {
  const x = at ? 10.5 + (at[0] / 180) * 4.7 : 0
  const y = at ? 7.5 - (at[1] / 90) * 4.7 : 0
  return (
    `<rect width="${W}" height="${H}" fill="#2a2440"/>` +
    `<g fill="none" stroke="#9d93d6" stroke-opacity="${at ? 0.5 : 1}" stroke-width=".7">` +
    `<circle cx="10.5" cy="7.5" r="5.3"/><ellipse cx="10.5" cy="7.5" rx="2.3" ry="5.3"/>` +
    `<path d="M5.2 7.5h10.6M6.1 4.6h8.8M6.1 10.4h8.8"/></g>` +
    (at
      ? `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.5" fill="#2a2440"/>` +
        `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.9" fill="#d9d0ff"/>`
      : '')
  )
}

/** Where each regional server plays, roughly (longitude, latitude). */
const REGIONAL: Record<string, [number, number]> = {
  euw: [2, 49],
  eune: [24, 58],
  lan: [-92, 17],
  las: [-64, -31],
  oce: [140, -30],
  me: [46, 25],
  sea: [104, 4],
  tw: [121, 24],
}

const COUNTRY: Record<string, () => string> = {
  na: usa,
  kr: korea,
  br: brazil,
  jp: japan,
  tr: turkey,
  vn: vietnam,
  ru: russia,
}

/** The servers' platform ids (`EUW1`) as the menus' slugs. */
const PLATFORM_SLUG: Record<string, string> = {
  EUW1: 'euw',
  EUN1: 'eune',
  NA1: 'na',
  KR: 'kr',
  BR1: 'br',
  LA1: 'lan',
  LA2: 'las',
  TR1: 'tr',
  JP1: 'jp',
  OC1: 'oce',
  VN2: 'vn',
  TW2: 'tw',
  SG2: 'sea',
  ME1: 'me',
  RU: 'ru',
}

const made = new Map<string, string>()

/**
 * A server's flag or regional mark as a data URL, from its slug (`euw`, `na`), its label
 * (`EUNE`) or its platform (`EUN1`). Anything else, or nothing ("every server"), is the globe.
 */
export function regionFlag(region: string | null | undefined): string {
  const raw = String(region ?? '').trim()
  const slug = PLATFORM_SLUG[raw.toUpperCase()] ?? raw.toLowerCase()
  const key = COUNTRY[slug] || REGIONAL[slug] ? slug : ''
  const known = made.get(key)
  if (known) return known
  const svg = frame(COUNTRY[key] ? COUNTRY[key]() : globe(REGIONAL[key] ?? null))
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`
  made.set(key, url)
  return url
}
