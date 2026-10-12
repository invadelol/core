import type { Directive } from 'vue'

/**
 * `v-reveal`: the element rises 10px and fades in once, the first time it enters the window, and
 * gets `.seen` (what draws a dial or a line in). Without IntersectionObserver, or with reduced
 * motion, it is simply there. Rendered on the server as it is, so the page reads without script.
 */
let observer: IntersectionObserver | null = null

function watch(el: Element) {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('seen')
        observer!.unobserve(entry.target)
      }
    },
    { rootMargin: '0px 0px -12% 0px' }
  )
  observer.observe(el)
}

export const vReveal: Directive<HTMLElement> = {
  getSSRProps: () => ({}),
  mounted(el) {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (still || typeof IntersectionObserver === 'undefined') {
      el.classList.add('seen')
      return
    }
    // Already on screen at load: no entrance, nothing moves under the reader.
    const box = el.getBoundingClientRect()
    if (box.top < innerHeight * 0.92 && box.bottom > 0) {
      el.classList.add('seen', 'instant')
      return
    }
    el.classList.add('reveal')
    watch(el)
  },
  unmounted(el) {
    observer?.unobserve(el)
  },
}
