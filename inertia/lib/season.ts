import { shallowRef } from 'vue'

/**
 * The site's seasonal dress, on top of the light or dark theme, as in the desktop app: Christmas
 * from 15 November to 31 December, by the visitor's local date. The layout's head script puts
 * `data-season="christmas"` on <html> before the first paint (the winter light, ../css/season.css);
 * the header then draws the snow and the lights (../components/SeasonLayer.vue).
 */
export type Season = 'christmas'

/** The season a local date falls in. Keep in step with the head script (inertia_layout.edge). */
export function seasonOf(date: Date): Season | null {
  const month = date.getMonth()
  return (month === 10 && date.getDate() >= 15) || month === 11 ? 'christmas' : null
}

/** Dev only: `?date=2026-12-24` sets the day, `?season=off` hides the season. */
function today(): Date {
  const forced = import.meta.env.DEV ? new URLSearchParams(location.search).get('date') : null
  if (forced) {
    const [y, m, d] = forced.split('-').map(Number)
    if (y && m && d) return new Date(y, m - 1, d)
  }
  return new Date()
}

function current(): Season | null {
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('season') === 'off')
    return null
  return seasonOf(today())
}

/** The season the page shows; null on the server, so the decorations only ever render client-side. */
export const season = shallowRef<Season | null>(null)
let started = false

function check() {
  season.value = current()
  const root = document.documentElement
  if (season.value) root.dataset.season = season.value
  else delete root.dataset.season
}

/** Reads the date on the first mount, and again when a tab left open comes back on another day. */
export function startSeason() {
  if (started) return
  started = true
  check()
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) check()
  })
}
