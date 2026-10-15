import { test } from '@japa/runner'
import sharp from 'sharp'
import riotAssets from '#services/riot/assets'

test.group('Presence cards', (group) => {
  const get = riotAssets.get
  group.each.teardown(() => {
    riotAssets.get = get
  })

  test('draws the champion with the score and keeps it for good', async ({ client, assert }) => {
    const art = await sharp({
      create: { width: 1280, height: 720, channels: 3, background: '#335' },
    })
      .jpeg()
      .toBuffer()
    const asked: string[] = []
    riotAssets.get = (async (kind: string, id: string) => {
      asked.push(`${kind}/${id}`)
      return { body: art, contentType: 'image/jpeg', placeholder: false, pinned: false }
    }) as typeof get
    const response = await client.get('/presence/103.png?k=7&d=2&a=9&r=mid')
    response.assertStatus(200)
    response.assertHeader('content-type', 'image/png')
    assert.include(response.header('cache-control'), 'immutable')
    assert.deepEqual(asked, ['centered/103'])
  })

  test('refuses anything but numbers and roles, and unknown champions', async ({ client }) => {
    riotAssets.get = (async () => ({
      body: new Uint8Array(),
      contentType: 'image/svg+xml',
      placeholder: true,
      pinned: false,
    })) as typeof get
    for (const path of [
      '/presence/103.png?k=7&d=2',
      '/presence/103.png?k=7&d=2&a=9&r=<b>',
      '/presence/x.png?k=1&d=1&a=1',
      '/presence/9999.png?k=1&d=1&a=1',
    ]) {
      const response = await client.get(path)
      response.assertStatus(404)
    }
  })

  test('the Invade badge is a static picture', async ({ client }) => {
    const response = await client.get('/presence/invade.png')
    response.assertStatus(200)
    response.assertHeader('content-type', 'image/png')
  })
})
