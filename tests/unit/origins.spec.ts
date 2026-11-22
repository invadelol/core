import { test } from '@japa/runner'
import { allowedOrigin, crossSiteRequest } from '#utils/origins'

/** A request as the guard reads it, served at `host`. */
function request(headers: Record<string, string>, host = 'invade.lol') {
  return { header: (name: string) => headers[name.toLowerCase()], host: () => host }
}

test.group('Allowed origins', () => {
  test('the site, its preview and the desktop webviews, everywhere', ({ assert }) => {
    for (const origin of [
      'https://invade.lol',
      'https://www.invade.lol',
      'https://pp.invade.lol',
      'tauri://localhost',
      'http://tauri.localhost',
      'https://tauri.localhost',
    ]) {
      assert.isTrue(allowedOrigin(origin, false), origin)
    }
  })

  test('localhost only while developing', ({ assert }) => {
    for (const origin of ['http://localhost:3362', 'http://127.0.0.1:1420', 'http://[::1]:5173']) {
      assert.isTrue(allowedOrigin(origin, true), origin)
      assert.isFalse(allowedOrigin(origin, false), origin)
    }
  })

  test('nothing else, look-alikes included', ({ assert }) => {
    for (const origin of [
      'https://evil.example',
      'http://invade.lol',
      'https://invade.lol.evil.example',
      'https://evilinvade.lol',
      'https://invade.lol:8443',
      'https://localhost.evil.example',
      'http://localhost.evil.example:3000',
      'null',
      '',
    ]) {
      assert.isFalse(allowedOrigin(origin, true), origin)
    }
  })
})

test.group('Cross-site requests', () => {
  test("a browser's request for another site's page is one", ({ assert }) => {
    // fetch(…, { mode: 'no-cors' }) or an image: no Origin on a GET, only Fetch Metadata.
    assert.isTrue(crossSiteRequest(request({ 'sec-fetch-site': 'cross-site' }), false))
    assert.isTrue(
      crossSiteRequest(
        request({ 'sec-fetch-site': 'cross-site', 'origin': 'https://evil.example' }),
        false
      )
    )
    // A browser too old for Fetch Metadata still names the page's origin on a cross-site fetch.
    assert.isTrue(crossSiteRequest(request({ origin: 'https://evil.example' }), false))
    assert.isTrue(crossSiteRequest(request({ origin: 'null' }), false))
  })

  test('the site itself, its other hosts and the allowed origins are not', ({ assert }) => {
    assert.isFalse(crossSiteRequest(request({ 'sec-fetch-site': 'same-origin' }), false))
    assert.isFalse(crossSiteRequest(request({ 'sec-fetch-site': 'same-site' }), false))
    assert.isFalse(crossSiteRequest(request({ 'sec-fetch-site': 'none' }), false))
    assert.isFalse(
      crossSiteRequest(
        request({ 'sec-fetch-site': 'cross-site', 'origin': 'tauri://localhost' }),
        false
      )
    )
    // An old browser on the page's own host (a preview, the server's address).
    assert.isFalse(
      crossSiteRequest(request({ origin: 'https://preview.example' }, 'preview.example'), false)
    )
  })

  test('the desktop app and scripts send neither header and are left to the quotas', ({
    assert,
  }) => {
    assert.isFalse(crossSiteRequest(request({ 'user-agent': 'Invade/0.3.9 (windows)' }), false))
  })
})
