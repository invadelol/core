/**
 * Small flags for the server menus (EUW, NA, KR…), drawn here as SVG and served as data URLs, so
 * they work anywhere a picture does (a `Select` option's `icon`, an `<img>`), with no image host.
 *
 * Every server shows a flag, simplified to read at 16 px: its country's, or for a server that
 * spans several, the flag of the union (EUW, EUNE: Europe) or of its main country (LAN: Mexico,
 * LAS: Argentina, OCE: Australia, SEA: Singapore, ME: the Emirates). TW stays neutral, a globe
 * with a lit dot. Every server at once is the globe without a dot.
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

function europe() {
  // The twelve gold stars in their ring.
  let body = `<rect width="${W}" height="${H}" fill="#003399"/>`
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6
    body += star(10.5 + 4.6 * Math.cos(a), 7.5 + 4.6 * Math.sin(a), 0.85, '#ffcc00')
  }
  return body
}

function mexico() {
  return (
    `<rect width="7" height="${H}" fill="#006847"/>` +
    `<rect x="7" width="7" height="${H}" fill="#fff"/>` +
    `<rect x="14" width="7" height="${H}" fill="#ce1126"/>` +
    `<circle cx="10.5" cy="7.5" r="1.6" fill="#8c5a2b"/>`
  )
}

function argentina() {
  return (
    `<rect width="${W}" height="${H}" fill="#74acdf"/>` +
    `<rect y="5" width="${W}" height="5" fill="#fff"/>` +
    `<circle cx="10.5" cy="7.5" r="1.5" fill="#f6b40e"/>`
  )
}

function australia() {
  // The Union Jack canton, simplified, and the Southern Cross.
  return (
    `<rect width="${W}" height="${H}" fill="#012169"/>` +
    `<path d="M0 0 10 7.5M10 0 0 7.5" stroke="#fff" stroke-width="1.5"/>` +
    `<path d="M0 0 10 7.5M10 0 0 7.5" stroke="#c8102e" stroke-width=".6"/>` +
    `<path d="M5 0v7.5M0 3.75h10" stroke="#fff" stroke-width="2.2"/>` +
    `<path d="M5 0v7.5M0 3.75h10" stroke="#c8102e" stroke-width="1.2"/>` +
    star(5, 11.3, 1.6, '#fff') +
    star(15.8, 3, 0.9, '#fff') +
    star(13.2, 7, 0.9, '#fff') +
    star(18.3, 6.3, 0.9, '#fff') +
    star(15.8, 12, 0.9, '#fff')
  )
}

function singapore() {
  return (
    `<rect width="${W}" height="7.5" fill="#ef3340"/>` +
    `<rect y="7.5" width="${W}" height="7.5" fill="#fff"/>` +
    `<circle cx="4.6" cy="3.75" r="2.6" fill="#fff"/><circle cx="5.6" cy="3.75" r="2.4" fill="#ef3340"/>` +
    star(7.4, 2.3, 0.5, '#fff') +
    star(8.8, 3.3, 0.5, '#fff') +
    star(8.3, 5, 0.5, '#fff') +
    star(6.5, 5, 0.5, '#fff') +
    star(6, 3.3, 0.5, '#fff')
  )
}

function emirates() {
  return (
    `<rect width="${W}" height="5" fill="#00732f"/>` +
    `<rect y="5" width="${W}" height="5" fill="#fff"/>` +
    `<rect y="10" width="${W}" height="5" fill="#000"/>` +
    `<rect width="5.5" height="${H}" fill="#ff0000"/>`
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
  euw: europe,
  eune: europe,
  lan: mexico,
  las: argentina,
  oce: australia,
  sea: singapore,
  me: emirates,
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
