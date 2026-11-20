import { test } from '@japa/runner'
import env from '#start/env'
import { NEW_DAWN_META } from '../../inertia/lib/new_dawn.js'

test.group('New Dawn hub', () => {
  for (const [path, tab] of [
    ['/new-dawn', 'overview'],
    ['/new-dawn/posts', 'posts'],
    ['/new-dawn/rumours', 'rumours'],
  ] as const) {
    test(`${path} is its own page, with its own title and address`, async ({ client }) => {
      const page = await client.get(path)
      page.assertStatus(200)
      page.assertTextIncludes('&quot;component&quot;:&quot;new_dawn&quot;')
      page.assertTextIncludes(`&quot;tab&quot;:&quot;${tab}&quot;`)
      page.assertTextIncludes(NEW_DAWN_META[tab].title)
      page.assertTextIncludes(`<link rel="canonical" href="https://invade.lol${path}" />`)
      page.assertTextIncludes('"@type":"BreadcrumbList"')
    }).timeout(60_000)
  }

  test('the overview marks up its questions for search engines', async ({ client }) => {
    const page = await client.get('/new-dawn')
    page.assertTextIncludes('"@type":"FAQPage"')
    page.assertTextIncludes('Is New Dawn League of Legends 2?')
  }).timeout(60_000)

  test('the sitemap lists the three tabs', async ({ client }) => {
    const map = await client.get('/sitemap.xml').qs({ section: 'pages' })
    map.assertStatus(200)
    for (const path of ['/new-dawn', '/new-dawn/posts', '/new-dawn/rumours'])
      map.assertTextIncludes(`<loc>https://invade.lol${path}</loc>`)
  }).timeout(60_000)

  test('a vote only comes from the site itself', async ({ client }) => {
    const bare = await client.post('/api/new-dawn/votes/wild-rift-look').json({ choice: 'yes' })
    bare.assertStatus(403)
    const forged = await client
      .post('/api/new-dawn/votes/wild-rift-look')
      .header('origin', 'https://elsewhere.example')
      .json({ choice: 'yes' })
    forged.assertStatus(403)
  })

  test('a settled rumour takes no vote', async ({ client }) => {
    const settled = await client
      .post('/api/new-dawn/votes/league-next')
      .header('origin', `http://${env.get('HOST')}:${env.get('PORT')}`)
      .json({ choice: 'yes' })
    settled.assertStatus(404)
  })
})
