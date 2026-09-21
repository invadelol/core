import { test } from '@japa/runner'
import { sitemapPlayers, SITEMAP_PAGE_SIZE } from '#services/sitemap'

test.group('Player sitemap', (group) => {
  const count = sitemapPlayers.count
  const page = sitemapPlayers.page
  group.each.teardown(() => {
    sitemapPlayers.count = count
    sitemapPlayers.page = page
  })

  test('lists canonical player URLs with encoded names and XML-safe text', async ({ client }) => {
    sitemapPlayers.count = async () => 3
    sitemapPlayers.page = async () => [
      { game_name: 'Louhi', tag_line: '727' },
      { game_name: 'MRS PauluX', tag_line: 'KCWIN' },
      { game_name: "A&B's 玩家", tag_line: 'EUW' },
    ]
    const response = await client.get('/sitemap.xml')
    response.assertStatus(200)
    response.assertHeader('content-type', 'application/xml; charset=utf-8')
    response.assertHeader('cache-control', 'public, max-age=300')
    response.assertTextIncludes('<loc>https://invade.lol/Louhi-727</loc>')
    response.assertTextIncludes('<loc>https://invade.lol/MRS%20PauluX-KCWIN</loc>')
    response.assertTextIncludes('A%26B&apos;s%20%E7%8E%A9%E5%AE%B6-EUW')
  })

  test('large directories use an index and expose the final page', async ({ client, assert }) => {
    sitemapPlayers.count = async () => SITEMAP_PAGE_SIZE + 1
    sitemapPlayers.page = async (number) => {
      assert.equal(number, 2)
      return [{ game_name: 'Last', tag_line: 'EUW' }]
    }
    const index = await client.get('/sitemap.xml')
    index.assertStatus(200)
    index.assertTextIncludes('<sitemapindex')
    index.assertTextIncludes('https://invade.lol/sitemap.xml?page=2')
    const last = await client.get('/sitemap.xml?page=2')
    last.assertStatus(200)
    last.assertTextIncludes('<loc>https://invade.lol/Last-EUW</loc>')
    for (const invalid of ['0', '-1', '1.5', 'abc', '3', '9007199254740992']) {
      const response = await client.get(`/sitemap.xml?page=${invalid}`)
      response.assertStatus(404)
    }
  })

  test('an empty database still includes the homepage', async ({ client }) => {
    sitemapPlayers.count = async () => 0
    sitemapPlayers.page = async () => []
    const response = await client.get('/sitemap.xml')
    response.assertStatus(200)
    response.assertTextIncludes('<loc>https://invade.lol/</loc>')
  })

  test('robots advertises the public sitemap', async ({ client }) => {
    const response = await client.get('/robots.txt')
    response.assertStatus(200)
    response.assertTextIncludes('Sitemap: https://invade.lol/sitemap.xml')
  })
})
