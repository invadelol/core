import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue'

/**
 * Keeps a `position: sticky` column beside a longer one in view, both ways. A column that fits
 * the window holds `gap` under its top. A taller one scrolls with the page until its end shows,
 * holds there, and going back up scrolls down with the page until its start shows and holds
 * again: every part of it stays reachable without a scrollbar of its own.
 *
 * Only `top` is set; where the stylesheet does not make the column sticky (narrow layouts), it
 * does nothing.
 */
export function useStickyColumn(target: Ref<HTMLElement | null>, gap = 16) {
  /** Where the column's top would sit in the window, the page's own flow aside. */
  let top = gap
  let lastY = 0
  let frame = 0
  let observer: ResizeObserver | undefined

  function place() {
    frame = 0
    const el = target.value
    const y = window.scrollY
    const dy = y - lastY
    lastY = y
    if (!el) return
    // Tallest first: a column longer than the window may go above it by what does not fit.
    const lowest = Math.min(gap, window.innerHeight - el.offsetHeight - gap)
    top = Math.min(gap, Math.max(lowest, top - dy))
    el.style.top = `${Math.round(top)}px`
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(place)
  }

  onMounted(() => {
    lastY = window.scrollY
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    observer = new ResizeObserver(schedule)
    watch(
      target,
      (el, old) => {
        if (old) observer?.unobserve(old)
        if (el) observer?.observe(el)
        schedule()
      },
      { immediate: true }
    )
  })

  onBeforeUnmount(() => {
    window.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    observer?.disconnect()
    cancelAnimationFrame(frame)
  })
}
