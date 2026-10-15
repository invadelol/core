import { test } from '@japa/runner'
import sharp from 'sharp'
import { parsePresenceQuery, PRESENCE_SIZE, renderPresenceCard } from '#services/presence_card'

test('presence queries take numbers and known roles only', ({ assert }) => {
  assert.deepEqual(parsePresenceQuery({ k: '7', d: '2', a: '9', r: 'mid' }), {
    kills: 7,
    deaths: 2,
    assists: 9,
    caption: 'MID',
    respawn: undefined,
  })
  assert.equal(parsePresenceQuery({ k: '7', d: '3', a: '9', t: '23' })?.respawn, 23)
  assert.equal(parsePresenceQuery({ k: '9', d: '2', a: '12', m: '31' })?.caption, '31 MIN')
  // The app's design version and anything else unknown is ignored.
  assert.equal(parsePresenceQuery({ k: '7', d: '2', a: '9', r: 'mid', v: '2' })?.caption, 'MID')
  for (const bad of [
    { k: '7', d: '2' },
    { k: '7', d: '2', a: '9', r: '<svg onload=x>' },
    { k: '1e3', d: '0', a: '0' },
    { k: '-1', d: '0', a: '0' },
    { k: '100', d: '0', a: '0' },
    { k: '7', d: '2', a: '9', t: '999' },
    { k: ['7'], d: '2', a: '9' },
  ]) {
    assert.isNull(parsePresenceQuery(bad), JSON.stringify(bad))
  }
})

test('presence card renders a square PNG, with and without art', async ({ assert }) => {
  const art = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#335' } })
    .jpeg()
    .toBuffer()
  for (const image of [
    await renderPresenceCard({ kills: 12, deaths: 10, assists: 15, caption: 'JGL' }, art),
    await renderPresenceCard({ kills: 0, deaths: 1, assists: 4, caption: '', respawn: 23 }),
  ]) {
    // Type is drawn as outlines (bundled Archivo): no server font is ever used.
    assert.notInclude(image.toString('latin1'), 'DejaVu')
    const meta = await sharp(image).metadata()
    assert.equal(meta.format, 'png')
    assert.equal(meta.width, PRESENCE_SIZE)
    assert.equal(meta.height, PRESENCE_SIZE)
  }
})
