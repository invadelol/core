import { test } from '@japa/runner'
import sharp from 'sharp'
import { changelog } from '#services/changelog'
import { changelogCardVersion } from '#services/changelog_card'

/** The `v` a page links, from its og:image. */
function linkedImage(html: string) {
  const image = /property="og:image" content="([^"]+)"/.exec(html)?.[1] ?? ''
  return new URL(image.replaceAll('&amp;', '&'))
}

test.group('Desktop app changelog', () => {
  test('lists every version, newest first, with the newest one’s link preview', async ({
    client,
    assert,
  }) => {
    const { releases } = await changelog()
    const response = await client.get('/app/changelog').header('user-agent', 'Discordbot/2.0')
    response.assertStatus(200)
    const html = response.text()
    let at = -1
    for (const r of releases) {
      const here = html.indexOf(`id="v${r.version}"`)
      assert.isAbove(here, at, r.version)
      at = here
    }
    const latest = releases[0].version
    response.assertTextIncludes('property="og:title" content="Invade changelog"')
    response.assertTextIncludes('rel="canonical" href="https://invade.lol/app/changelog"')
    response.assertTextIncludes('name="twitter:card" content="summary_large_image"')
    response.assertTextIncludes('property="og:image:type" content="image/jpeg"')
    const image = linkedImage(html)
    assert.equal(image.pathname, `/og/app/changelog/${latest}.jpg`)
    assert.equal(image.searchParams.get('v'), changelogCardVersion(latest))
    // The words are in the page the server sends, screenshots with their size.
    response.assertTextIncludes('Summoner spells go in with the runes')
    assert.match(html, /<img src="\/changelog\/spells\.webp\?v=[\w-]{8}" width="\d+" height="\d+"/)
  })

  test('a version has its own address and link preview', async ({ client, assert }) => {
    const response = await client.get('/app/changelog/0.3.1').header('user-agent', 'Discordbot/2.0')
    response.assertStatus(200)
    const html = response.text()
    response.assertTextIncludes('property="og:title" content="Invade 0.3.1"')
    response.assertTextIncludes(
      'property="og:url" content="https://invade.lol/app/changelog/0.3.1"'
    )
    response.assertTextIncludes('rel="canonical" href="https://invade.lol/app/changelog/0.3.1"')
    assert.match(
      html,
      /property="og:description" content="Summoner spells go in with the runes\. Every player of your game is read from the loading screen on\. Enemy ranks and profile links are back in game\."/
    )
    assert.equal(linkedImage(html).pathname, '/og/app/changelog/0.3.1.jpg')
    assert.match(html, /<title[^>]*>Invade 0\.3\.1<\/title>/)
  })

  test('v0.3.1 leads to 0.3.1; an unknown version is not found', async ({ client }) => {
    const v = await client.get('/app/changelog/v0.3.1').redirects(0)
    v.assertStatus(301)
    v.assertHeader('location', '/app/changelog/0.3.1')
    for (const path of ['/app/changelog/9.9.9', '/app/changelog/nope', '/app/changelog/v9.9.9']) {
      const response = await client.get(path)
      response.assertStatus(404)
      response.assertTextIncludes('This page doesn’t exist')
    }
  })

  test('the version image: a JPEG kept for good at its v, five minutes otherwise', async ({
    client,
    assert,
  }) => {
    for (const version of ['0.3.2', '0.3.1', '0.2.9']) {
      const path = `/og/app/changelog/${version}.jpg`
      const current = await client.get(`${path}?v=${changelogCardVersion(version)}`)
      current.assertStatus(200)
      current.assertHeader('content-type', 'image/jpeg')
      current.assertHeader('cache-control', 'public, max-age=31536000, immutable')
      const body = current.response.body as Buffer
      assert.isAtMost(body.byteLength, 150_000)
      const meta = await sharp(body).metadata()
      assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', 1200, 630])
      for (const other of [`${path}?v=0000000000`, path]) {
        const response = await client.get(other)
        response.assertStatus(200)
        response.assertHeader('cache-control', 'public, max-age=300')
      }
    }
    const prefixed = await client.get('/og/app/changelog/v0.3.2.jpg')
    prefixed.assertStatus(200)
  })

  test('no image for a version the changelog does not list', async ({ client }) => {
    for (const path of [
      '/og/app/changelog/9.9.9.jpg',
      '/og/app/changelog/0.3.2.png',
      '/og/app/changelog/hello.jpg',
    ]) {
      const response = await client.get(path)
      response.assertStatus(404)
      response.assertHeader('cache-control', 'public, max-age=60')
    }
  })

  test('the app page and the footer link the changelog', async ({ client }) => {
    const response = await client.get('/app')
    response.assertStatus(200)
    response.assertTextIncludes('href="/app/changelog"')
  })
})
