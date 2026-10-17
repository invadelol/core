import { test } from '@japa/runner'
import { DISCORD_URL } from '../../inertia/lib/links.js'

test.group('Roadmap', () => {
  test('lists now, next and later, and links to Discord', async ({ client, assert }) => {
    const response = await client.get('/roadmap')
    response.assertStatus(200)
    const html = response.text()
    const stages = ['Now', 'Next', 'Later'].map((name) => html.indexOf(`id="stage-${name}"`))
    assert.isAbove(stages[0], -1)
    assert.isAbove(stages[1], stages[0])
    assert.isAbove(stages[2], stages[1])
    response.assertTextIncludes(`href="${DISCORD_URL}"`)
    response.assertTextIncludes('href="/roadmap"')
  })
})
