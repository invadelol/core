/**
 * Each page's stylesheets apply only while that page is shown.
 *
 * Vite adds a page's stylesheet the first time the page is visited and never takes it away. After
 * a few visits every page ran under every other page's rules, and a class one page styles for
 * itself restyled another page that uses the same name for something else: the home's `.tm`
 * stacked a team's header and greyed its logo, the Solo/Duo ladder's `.sl` put each number of a
 * KDA on its own line. The same address then looked different depending on where the visitor came
 * from. The layout writes, from the build's manifest, the stylesheets each page needs
 * (`window.__pageStyles`, app/services/page_styles.ts); on every visit the others are switched
 * off, so a page always looks as it does when opened directly. In development there is no map and
 * nothing changes.
 */

interface PageStyles {
  always: string[]
  pages: Record<string, string[]>
}

let map: PageStyles | null = null
/** Every page-level stylesheet the map knows: the only ones ever switched off. */
let managed = new Set<string>()
let current: string | null = null
/** The page whose module just loaded, about to replace the current one. */
let entering: string | null = null

function pathOf(link: HTMLLinkElement) {
  try {
    return new URL(link.href, location.href).pathname
  } catch {
    return null
  }
}

function links() {
  return Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
}

/**
 * A stylesheet is switched off by a media query nothing matches, not by `disabled`: Firefox stops
 * loading a disabled stylesheet, and Vite waits for the next page's stylesheets to load before it
 * shows that page, so a visit would never end.
 */
const OFF = 'not all'

function turn(link: HTMLLinkElement, on: boolean) {
  if (on && link.media === OFF) link.removeAttribute('media')
  else if (!on && !link.media) link.media = OFF
}

/**
 * Switches on the stylesheets `component` needs and, when `only`, off the other pages'. A page the
 * map does not know keeps everything on.
 */
function apply(component: string, only: boolean) {
  if (!map) return
  const need = map.pages[component]
  for (const link of links()) {
    const path = pathOf(link)
    if (!path || !managed.has(path)) continue
    if (!need || need.includes(path)) turn(link, true)
    else if (only) turn(link, false)
  }
}

function settle() {
  if (current) apply(current, true)
  if (entering) apply(entering, false)
}

/**
 * A stylesheet Vite adds for the next page loads while the current one is still shown: it waits,
 * off, until its page arrives.
 */
function watchNewSheets() {
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLLinkElement) || node.rel !== 'stylesheet') continue
        const path = pathOf(node)
        if (!path || !managed.has(path)) continue
        node.addEventListener('load', settle, { once: true })
      }
    }
  }).observe(document.head, { childList: true })
}

/** Called once with the first page; its stylesheets are the ones in the HTML. */
export function startPageStyles(component: string) {
  if (typeof window === 'undefined') return
  const data = (window as { __pageStyles?: PageStyles }).__pageStyles
  if (!data?.pages) return
  map = data
  managed = new Set(Object.values(data.pages).flat())
  for (const path of data.always) managed.delete(path)
  current = component
  apply(component, true)
  watchNewSheets()
}

/** A page's module has loaded, its stylesheets with it: on, for the page about to be drawn. */
export function enterPageStyles(component: string) {
  entering = component
  apply(component, false)
}

/** A page is shown: only its stylesheets stay on. */
export function showPageStyles(component: string) {
  current = component
  entering = null
  apply(component, true)
}
