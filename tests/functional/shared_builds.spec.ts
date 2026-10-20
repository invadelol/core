import { test } from '@japa/runner'
import sharp from 'sharp'
import riotAssets from '#services/riot/assets'

const PAGE = '/desktop/build/1/ahri/mid/1056,2003-3020-3118,4646,3089-3157,3102-3135'

test.group('Shared builds', (group) => {
  const { get, names, championKeys } = riotAssets
  group.each.setup(async () => {
    const art = await sharp({
      create: { width: 1280, height: 720, channels: 3, background: '#335' },
    })
      .jpeg()
      .toBuffer()
    const icon = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#a85' } })
      .png()
      .toBuffer()
    riotAssets.championKeys = async () => ({ ahri: '103', jinx: '222' })
    riotAssets.names = (async (kind: string) =>
      kind === 'champion'
        ? { 103: 'Ahri', 222: 'Jinx' }
        : Object.fromEntries(
            [1056, 2003, 3020, 3118, 4646, 3089, 3157, 3102, 3135].map((id) => [id, `Item ${id}`])
          )) as typeof names
    riotAssets.get = (async (kind: string) => ({
      body: kind === 'item' ? icon : art,
      contentType: kind === 'item' ? 'image/png' : 'image/jpeg',
      placeholder: false,
      pinned: false,
    })) as typeof get
  })
  group.each.teardown(() => {
    Object.assign(riotAssets, { get, names, championKeys })
  })

  test('the page carries the link preview, the name escaped', async ({ client, assert }) => {
    const name = 'Burst </title><b>x</b> & "q"'
    const response = await client.get(`${PAGE}?n=${encodeURIComponent(name)}`)
    response.assertStatus(200)
    const html = response.text()
    assert.include(html, 'property="og:image" content="https://invade.lol/og/build/1/ahri/mid/')
    assert.include(html, 'name="twitter:card" content="summary_large_image"')
    assert.include(
      html,
      'content="Burst &lt;/title&gt;&lt;b&gt;x&lt;/b&gt; &amp; &quot;q&quot; — Ahri build"'
    )
    assert.include(html, '<title inertia>Burst ‹/title›‹b›x‹/b›')
    assert.notInclude(html, '<b>x</b>')
    assert.notInclude(html, 'Burst </title>')
  })

  test('the picture is a cached JPEG', async ({ client, assert }) => {
    const image = PAGE.replace('/desktop/build', '/og/build') + '.jpg?n=Burst&v=1'
    const response = await client.get(image)
    response.assertStatus(200)
    response.assertHeader('content-type', 'image/jpeg')
    assert.include(response.header('cache-control'), 'max-age=604800')
  })

  test('unknown champions, items and broken links are 404', async ({ client }) => {
    for (const path of [
      '/desktop/build/1/teemo/mid/-3020-3118',
      '/desktop/build/1/ahri/mid/-3020-9999',
      '/desktop/build/1/ahri/feeder/-3020-3118',
      '/desktop/build/2/ahri/mid/-3020-3118',
      '/og/build/1/ahri/mid/-3020-9999.jpg',
      '/og/build/1/ahri/mid/-3020-3118.png',
      '/og/build/1/ahri/mid/-3020-31%3C18.jpg',
    ]) {
      const response = await client.get(path)
      response.assertStatus(404)
    }
  })
})
