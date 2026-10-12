/**
 * A touch screen has no hover, so a `title` (an item's name, a rune, a champion, a heatmap day…)
 * never shows there. On a tap, the nearest titled element that is not itself a control shows its
 * title in a small tip, which goes on the next touch, on a scroll, or after a few seconds. A mouse
 * keeps the browser's own tooltips: nothing here runs for it.
 */

/** A control does what it says when tapped: its title is not shown over it. */
const CONTROL = 'a[href], button, input, select, textarea, label, summary, [role="button"]'
const SHOWN_MS = 3200

export function installTouchTitles() {
  if (typeof window === 'undefined') return

  let tip: HTMLElement | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let touchedAt = 0

  function hide() {
    clearTimeout(timer)
    tip?.remove()
    tip = null
  }

  function show(owner: Element, text: string) {
    tip = document.createElement('div')
    tip.className = 'touch-tip'
    tip.setAttribute('aria-hidden', 'true')
    tip.textContent = text
    document.body.append(tip)

    // Above the element, centred on it; below when the top of the screen is too close.
    const box = owner.getBoundingClientRect()
    const { width, height } = tip.getBoundingClientRect()
    const left = Math.min(
      Math.max(8, box.left + box.width / 2 - width / 2),
      window.innerWidth - width - 8
    )
    const top = box.top - height - 8 >= 8 ? box.top - height - 8 : box.bottom + 8
    tip.style.left = `${Math.round(left)}px`
    tip.style.top = `${Math.round(top)}px`
    timer = setTimeout(hide, SHOWN_MS)
  }

  document.addEventListener(
    'pointerdown',
    (event) => {
      hide()
      if (event.pointerType === 'touch') touchedAt = Date.now()
    },
    { capture: true, passive: true }
  )

  document.addEventListener('click', (event) => {
    if (Date.now() - touchedAt > 1000) return
    const target = event.target instanceof Element ? event.target : null
    const owner = target?.closest('[title]')
    const text = owner?.getAttribute('title')?.trim()
    // A control, or anything that acts on a tap (a row that opens): the tap is for that.
    if (!owner || !text || owner.closest(CONTROL) || getComputedStyle(owner).cursor === 'pointer')
      return
    show(owner, text)
  })

  window.addEventListener('scroll', hide, { capture: true, passive: true })
}
