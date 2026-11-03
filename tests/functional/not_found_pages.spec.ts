import { test } from '@japa/runner'

/** The Inertia version the site serves, read from a full page load. */
function versionOf(html: string) {
  return /&quot;version&quot;:&quot;([^&]+)&quot;/.exec(html)?.[1] ?? ''
}

test.group('Not found pages', (group) => {
  group.each.setup(() => {
    // Upstream is down: no champion list, so no champion is found.
    const original = globalThis.fetch
    globalThis.fetch = (async () => new Response('not found', { status: 404 })) as typeof fetch
    return () => (globalThis.fetch = original)
  })

  for (const path of ['/champions/notachampion', '/pro/notapro', '/team/notateam']) {
    test(`${path} is the site’s 404 page, on an Inertia visit too`, async ({ client }) => {
      const page = await client.get(path)
      page.assertStatus(404)
      page.assertTextIncludes('&quot;component&quot;:&quot;errors/not_found&quot;')

      const visit = await client
        .get(path)
        .header('x-inertia', 'true')
        .header('x-inertia-version', versionOf(page.text()))
      visit.assertStatus(404)
      visit.assertHeader('x-inertia', 'true')
      visit.assertBodyContains({ component: 'errors/not_found' })
    })
  }
})
