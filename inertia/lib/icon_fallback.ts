/**
 * Last line of defence for game art.
 *
 * The /cdn proxy always answers with an image, so this should never fire.
 * It exists for the cases the proxy can't cover: our own origin returning a
 * 5xx, a request cancelled by a flaky connection, an <img> pointed somewhere
 * unexpected. Any of those would otherwise leave a broken-image glyph in the
 * layout, and an icon slot that renders nothing is the one outcome we don't
 * accept.
 *
 * Registered once, in the capture phase, because `error` does not bubble.
 */
const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
      '<rect width="64" height="64" fill="%23ececed"/>' +
      '<circle cx="32" cy="26" r="9" fill="%23c9cace"/>' +
      '<path d="M14 56c3-10 9-15 18-15s15 5 18 15z" fill="%23c9cace"/>' +
      '</svg>'
  )

export function installIconFallback() {
  if (typeof document === 'undefined') return

  document.addEventListener(
    'error',
    (event) => {
      const target = event.target as HTMLImageElement | null
      if (!target || target.tagName !== 'IMG') return
      // Guard against a loop if the fallback itself somehow fails.
      if (target.dataset.fallback === 'applied') return

      target.dataset.fallback = 'applied'
      target.src = FALLBACK
    },
    true
  )
}
