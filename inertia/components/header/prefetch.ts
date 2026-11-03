import { router } from '@inertiajs/vue3'

/**
 * A touch on a link warms its page while the finger is still down, as a hover does with a mouse
 * (Inertia's `prefetch` on `Link`): the visit that follows the tap finds its answer ready.
 */
export function prefetchOnTouch(href: string) {
  try {
    router.prefetch(href, { method: 'get' }, { cacheFor: '30s' })
  } catch {
    // Prefetching only saves time; a visit without it still works.
  }
}
