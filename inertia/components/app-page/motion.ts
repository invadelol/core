import { onBeforeUnmount, onMounted, type Directive, type Ref } from 'vue'

/**
 * The page's motion, kept to two tools:
 * - `v-reveal`: a block enters once, its `.ln` children rising and fading in turn (IntersectionObserver).
 * - `useScrollFx`: one requestAnimationFrame loop for the whole page, calling each registered effect
 *   with its element's box while that element is near the viewport. Effects write transforms only.
 * With reduced motion, reveals are shown at once and effects are asked for their final state.
 */

export const EASE = 'cubic-bezier(0.25, 0.1, 0.25, 1)'

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** A symmetric ease-in-out (smootherstep), for values scrubbed by the scroll. */
export const ease = (t: number) => {
  const x = clamp(t)
  return x * x * x * (x * (x * 6 - 15) + 10)
}
/** Progress of `t` between `a` and `b`, clamped. */
export const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a))

export function prefersReduced() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// ── Reveals ──────────────────────────────────────────────────────────────

let revealer: IntersectionObserver | null = null
function reveal(el: Element) {
  el.classList.add('in')
  revealer?.unobserve(el)
}

/** `v-reveal`: the element (and its `.ln` children, staggered by `--i`) enters once. */
export const vReveal: Directive<HTMLElement> = {
  mounted(el) {
    el.classList.add('rv')
    el.querySelectorAll<HTMLElement>('.ln').forEach((child, i) => {
      if (!child.style.getPropertyValue('--i')) child.style.setProperty('--i', String(i))
    })
    if (prefersReduced() || !('IntersectionObserver' in window)) return reveal(el)
    revealer ??= new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && reveal(e.target)),
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
    )
    revealer.observe(el)
  },
  unmounted(el) {
    revealer?.unobserve(el)
  },
}

/** Runs `fn` once when the element is first well inside the viewport. */
export function onEnter(target: Ref<HTMLElement | undefined>, fn: () => void, threshold = 0.35) {
  let io: IntersectionObserver | undefined
  onMounted(() => {
    const el = target.value
    if (!el) return
    if (!('IntersectionObserver' in window)) return fn()
    io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io?.disconnect()
          fn()
        }
      },
      { threshold }
    )
    io.observe(el)
  })
  onBeforeUnmount(() => io?.disconnect())
}

// ── The scroll loop ──────────────────────────────────────────────────────

type Effect = (box: DOMRect, vh: number, vw: number) => boolean | void
interface Item {
  el: HTMLElement
  fn: Effect
  near: boolean
}

const items = new Set<Item>()
let frame = 0
let near: IntersectionObserver | null = null
let listening = false

function tick() {
  frame = 0
  const vh = window.innerHeight
  const vw = document.documentElement.clientWidth
  let again = false
  for (const item of items) {
    if (item.near && item.fn(item.el.getBoundingClientRect(), vh, vw) === true) again = true
  }
  // An effect that is still easing toward its target asks for another frame.
  if (again) request()
}

export function request() {
  if (!frame && typeof window !== 'undefined') frame = requestAnimationFrame(tick)
}

/**
 * Registers a scroll effect on an element. `fn` gets the element's box on every frame the page
 * moves while the element is within a viewport of the screen; returning `true` asks for one more
 * frame (for effects that ease toward their target).
 */
export function useScrollFx(target: Ref<HTMLElement | undefined>, fn: Effect) {
  let item: Item | undefined
  onMounted(() => {
    const el = target.value
    if (!el) return
    item = { el, fn, near: true }
    items.add(item)
    near ??= new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          for (const it of items) if (it.el === e.target) it.near = e.isIntersecting
        request()
      },
      { rootMargin: '100% 0px 100% 0px' }
    )
    near.observe(el)
    if (!listening) {
      listening = true
      window.addEventListener('scroll', request, { passive: true })
      window.addEventListener('resize', request, { passive: true })
    }
    request()
  })
  onBeforeUnmount(() => {
    if (!item) return
    near?.unobserve(item.el)
    items.delete(item)
  })
}

/**
 * Progress of an element through the viewport: 0 when its top reaches the bottom of the screen,
 * 1 when its top reaches `end` (a fraction of the viewport height from the top).
 */
export const entering = (box: DOMRect, vh: number, end = 0.25) =>
  clamp((vh - box.top) / (vh * (1 - end)))
