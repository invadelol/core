import { router } from '@inertiajs/vue3'

/**
 * A visit answered by something other than a page: the proxy's "Bad Gateway" while the server
 * restarts, a timeout, an error some route sends as JSON. Inertia would open its debugging modal
 * over the site with the raw body in it; a prefetch made it worse, keeping that answer as if it
 * were a page and spreading its text into an object (`{"0":"B","1":"a",…,"flash":{}}`), then
 * showing it on the click that used it. Here such an answer is never kept, and a visit that gets
 * one shows the site's own error page at the address that failed, whose "Try again" asks the
 * server afresh.
 */

/** An Inertia page as it travels: JSON with the component's name. */
function isPage(body: unknown) {
  if (body && typeof body === 'object') return 'component' in body
  return typeof body === 'string' && /^\s*\{/.test(body) && body.includes('"component"')
}

interface FailedResponse {
  status?: number
  request?: { responseURL?: string }
  config?: { url?: string; headers?: Record<string, unknown> }
}

/** Where the failed visit was going, as a path on this site. */
function addressOf(response: FailedResponse) {
  const raw = response.request?.responseURL || response.config?.url || location.href
  try {
    const url = new URL(raw, location.href)
    return url.origin === location.origin ? `${url.pathname}${url.search}${url.hash}` : null
  } catch {
    return null
  }
}

export function installVisitErrors() {
  // A prefetched answer that is not a page is dropped once Inertia has stored it.
  router.on('prefetched', (event) => {
    if (!isPage(event.detail.response)) setTimeout(() => router.flushAll(), 0)
  })

  router.on('invalid', (event) => {
    event.preventDefault()
    router.flushAll()
    const response = event.detail.response as FailedResponse
    const status = Number(response.status) || 0
    // A partial reload (a filter, more rows) keeps the page it was refreshing.
    if (response.config?.headers?.['X-Inertia-Partial-Component']) return
    const address = addressOf(response)
    // Not an error (a file, a page of another kind): the browser opens it itself.
    if (status > 0 && status < 400) {
      window.location.href = address ?? location.href
      return
    }
    router.push({
      url: address ?? location.pathname,
      component: status === 404 ? 'errors/not_found' : 'errors/server_error',
      props: (current) => ({
        patch: (current as { patch?: unknown }).patch ?? null,
        error: { status: status || 503, message: null },
      }),
    })
  })
}
