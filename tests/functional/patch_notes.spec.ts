import { test } from '@japa/runner'

test.group('Patch notes', () => {
  for (const patch of ['26.20', '26.21', '26.22', '26.23']) {
    test(`/patch/${patch} holds Riot's notes`, async ({ client }) => {
      const page = await client.get(`/patch/${patch}`)
      page.assertStatus(200)
      page.assertTextIncludes(`Patch ${patch} notes`)
      page.assertTextIncludes('&quot;champions&quot;:[{')
    }).timeout(60_000)
  }

  test('the header menus list every patch with notes, newest first', async ({ client, assert }) => {
    const nav = await client.get('/api/site/nav')
    nav.assertStatus(200)
    const notes = nav.body().patchNotes as { patch: string; published: string }[]
    assert.includeMembers(
      notes.map((n) => n.patch),
      ['26.23', '26.22', '26.21', '26.20']
    )
    const dates = notes.map((n) => n.published)
    assert.deepEqual(dates, [...dates].sort().reverse())
  }).timeout(60_000)
})
