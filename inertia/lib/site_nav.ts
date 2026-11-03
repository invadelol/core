import { shallowRef } from 'vue'
import type { SiteNav } from './home.js'

/**
 * What the header's menus show beside their links (`/api/site/nav`): the tier list's best picks,
 * the climbers and the top pros. Nothing is fetched with the page: the first hover, focus or tap
 * on a menu asks for it, once for the whole visit, and every header on every page reads the same
 * answer. A menu opened before it lands paints its links at once and its list a moment later.
 */
export const siteNav = shallowRef<SiteNav | null>(null)

let asked: Promise<void> | null = null

export function loadSiteNav() {
  if (asked || typeof window === 'undefined') return
  asked = fetch('/api/site/nav', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? (r.json() as Promise<SiteNav>) : Promise.reject(r.status)))
    .then((nav) => {
      siteNav.value = nav
    })
    // A failed answer is asked again on the next open; the links never depended on it.
    .catch(() => {
      asked = null
    })
}
