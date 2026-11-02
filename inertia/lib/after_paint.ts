/**
 * Runs `fn` once the next frame has painted. A tap that sets off heavy work (a game's scoreboard,
 * the whole page's restyle for a theme) shows its own answer first, and the heavy part lands in
 * the frame after: on a phone the tap would otherwise wait for it (Interaction to Next Paint).
 */
export function afterPaint(fn: () => void) {
  if (typeof requestAnimationFrame === 'undefined') return fn()
  requestAnimationFrame(() => setTimeout(fn, 0))
}
