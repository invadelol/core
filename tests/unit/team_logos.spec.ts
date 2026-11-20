import { test } from '@japa/runner'
import { readdir } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import sharp from 'sharp'
import teamLogoService, { forGround, groundOf, type Logo } from '#services/team_logo_service'

/** A 64 px logo: a disc of one colour on transparency, with an optional inner disc. */
async function disc(
  outer: [number, number, number],
  inner?: [number, number, number]
): Promise<Logo> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
    <circle cx="32" cy="32" r="28" fill="rgb(${outer.join(',')})"/>
    ${inner ? `<circle cx="32" cy="32" r="12" fill="rgb(${inner.join(',')})"/>` : ''}
  </svg>`
  const body = await sharp(Buffer.from(svg)).png().toBuffer()
  return { body: new Uint8Array(body), contentType: 'image/png' }
}

/** The colour at the centre and on the ring of a logo. */
async function colours(logo: Logo) {
  const { data, info } = await sharp(logo.body)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const at = (x: number, y: number) => {
    const i = (y * info.width + x) * 4
    return [data[i], data[i + 1], data[i + 2]]
  }
  return { centre: at(32, 32), ring: at(32, 10) }
}

test.group('Team logos', () => {
  test('a team with a logo file is served from it, without asking anyone', async ({ assert }) => {
    const [file] = (await readdir(app.makePath('resources/teams'))).filter((f) =>
      f.endsWith('.webp')
    )
    assert.exists(file)
    const original = globalThis.fetch
    let asked = 0
    globalThis.fetch = (async () => {
      asked++
      return new Response('gone', { status: 404 })
    }) as typeof fetch
    try {
      const logo = await teamLogoService.get(file.slice(0, -5), 32)
      assert.equal(logo?.contentType, 'image/webp')
      assert.isAbove(logo!.body.byteLength, 100)
      assert.equal(asked, 0)
    } finally {
      globalThis.fetch = original
    }
  })

  test('an id that is not a team id reads no file', async ({ assert }) => {
    assert.isNull(await teamLogoService.get('../../.env'))
  })

  test('a black logo is redrawn light for the dark ground, and kept for the light one', async ({
    assert,
  }) => {
    const black = await disc([12, 12, 14])
    const dark = await colours(await forGround(black, 'dark'))
    assert.isAbove(dark.ring[0], 180)
    assert.strictEqual(await forGround(black, 'light'), black)
  })

  test('a white logo is redrawn dark for the light ground only', async ({ assert }) => {
    const white = await disc([245, 245, 245])
    assert.strictEqual(await forGround(white, 'dark'), white)
    const light = await colours(await forGround(white, 'light'))
    assert.isBelow(light.ring[0], 60)
  })

  test('a colourful logo and one with light parts of its own are kept', async ({ assert }) => {
    const orange = await disc([255, 90, 0])
    assert.strictEqual(await forGround(orange, 'dark'), orange)
    assert.strictEqual(await forGround(orange, 'light'), orange)
    // A white mark inside a black disc already reads on the dark ground.
    const badge = await disc([10, 10, 10], [250, 250, 250])
    assert.strictEqual(await forGround(badge, 'dark'), badge)
  })

  test('a dark navy keeps its hue, lighter', async ({ assert }) => {
    const navy = await colours(await forGround(await disc([16, 28, 92]), 'dark'))
    assert.isAbove(navy.ring[2], navy.ring[0])
    assert.isAbove(navy.ring[2], 150)
  })

  test('only `on=light` asks for the light ground', ({ assert }) => {
    assert.equal(groundOf('light'), 'light')
    assert.equal(groundOf('dark'), 'dark')
    assert.equal(groundOf(undefined), 'dark')
    assert.equal(groundOf('LIGHT'), 'dark')
  })
})
