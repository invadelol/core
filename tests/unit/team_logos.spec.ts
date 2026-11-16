import { test } from '@japa/runner'
import { readdir } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import teamLogoService from '#services/team_logo_service'

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
})
