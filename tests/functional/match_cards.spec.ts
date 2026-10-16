import { test } from '@japa/runner'
import sharp from 'sharp'
import matchRepository from '#services/analytics/match_repository'
import riotAssets from '#services/riot/assets'
import matchShareService from '#services/match_share_service'
import type { Match } from '../../inertia/lib/types.js'
import {
  LOSS,
  PEAK,
  SHARE_MATCH_ID,
  SHARE_PLAYER,
  shareArt,
  shareMatch,
} from '#tests/fixtures/match_share'

const IMAGE = `/og/match/${SHARE_MATCH_ID}/Moonfern-EUW.jpg`
const PAGE = `/Moonfern-EUW/match/${SHARE_MATCH_ID}`

test.group('Match share cards', (group) => {
  const read = matchRepository.getSummaryById
  const get = riotAssets.get
  const names = riotAssets.names
  let stored: Match | null = null
  let reads = 0
  let renders = 0

  group.each.setup(async () => {
    const art = await shareArt()
    stored = shareMatch(PEAK)
    reads = 0
    renders = 0
    matchShareService.clear()
    matchRepository.getSummaryById = (async () => {
      reads++
      return structuredClone(stored)
    }) as typeof read
    riotAssets.get = (async () => {
      renders++
      return { body: art, contentType: 'image/jpeg', placeholder: false, pinned: false }
    }) as typeof get
    riotAssets.names = (async () => ({ '7': 'LeBlanc' })) as typeof names
  })
  group.each.teardown(() => {
    matchRepository.getSummaryById = read
    riotAssets.get = get
    riotAssets.names = names
    matchShareService.clear()
  })

  /** The `v` the page links, from its og:image. */
  async function linked(client: any) {
    const page = await client.get(PAGE)
    const image = /property="og:image" content="([^"]+)"/.exec(page.text())?.[1] ?? ''
    return new URL(image.replaceAll('&amp;', '&')).searchParams.get('v') ?? ''
  }

  test('the linked card is a 1200 by 630 JPEG, kept for good', async ({ client, assert }) => {
    const v = await linked(client)
    assert.match(v, /^[\w-]{10}$/)
    const response = await client.get(`${IMAGE}?v=${v}`)
    response.assertStatus(200)
    response.assertHeader('content-type', 'image/jpeg')
    response.assertHeader('cache-control', 'public, max-age=31536000, immutable')
    const meta = await sharp(response.response.body as Buffer).metadata()
    assert.equal(meta.format, 'jpeg')
    assert.equal(meta.width, 1200)
    assert.equal(meta.height, 630)
    // The page and the image read the game once between them.
    assert.equal(reads, 1)
  })

  test('a stale or missing v gets the current card for five minutes', async ({ client }) => {
    for (const path of [`${IMAGE}?v=0000000000`, IMAGE]) {
      const response = await client.get(path)
      response.assertStatus(200)
      response.assertHeader('content-type', 'image/jpeg')
      response.assertHeader('cache-control', 'public, max-age=300')
    }
  })

  test('concurrent requests render once and the card is kept', async ({ client, assert }) => {
    // A game no other test draws, so no card of it is kept yet.
    stored = shareMatch({ [SHARE_PLAYER]: { kills: 5, deaths: 5, assists: 5 } })
    const v = await linked(client)
    const images = await Promise.all([
      client.get(`${IMAGE}?v=${v}`),
      client.get(`${IMAGE}?v=${v}`),
      client.get(`${IMAGE}?v=${v}`),
    ])
    for (const image of images) image.assertStatus(200)
    await client.get(`${IMAGE}?v=${v}`)
    assert.equal(renders, 1)
  })

  test('the art unavailable: a readable card, never kept', async ({ client }) => {
    // A game no other test draws, so no card of it is kept yet.
    stored = shareMatch({ [SHARE_PLAYER]: { kills: 9, deaths: 9, assists: 9 } })
    riotAssets.get = (async () => ({
      body: new Uint8Array(),
      contentType: 'image/svg+xml',
      placeholder: true,
      pinned: false,
    })) as typeof get
    const response = await client.get(IMAGE)
    response.assertStatus(200)
    response.assertHeader('content-type', 'image/jpeg')
    response.assertHeader('cache-control', 'no-store')
  })

  test('no card for an unknown game, a remake, Arena, or a player not in it', async ({
    client,
  }) => {
    const cases: Array<[Match | null, string]> = [
      [null, IMAGE],
      [shareMatch({}, { duration: 200 }), IMAGE],
      [shareMatch({}, { queueId: 1700, mapId: 30 }), IMAGE],
      [shareMatch({ 5: { gameName: '', tagLine: '' } }), `/og/match/${SHARE_MATCH_ID}/-.jpg`],
      [shareMatch(), `/og/match/${SHARE_MATCH_ID}/Somebody-Else.jpg`],
      [shareMatch(), `/og/match/${SHARE_MATCH_ID}/Moonfern-EUW.png`],
      [shareMatch(), `/og/match/not-a-match/Moonfern-EUW.jpg`],
    ]
    for (const [match, path] of cases) {
      matchShareService.clear()
      stored = match
      const response = await client.get(path)
      response.assertStatus(404)
    }
  })

  test('the page carries the meta tags for crawlers, without JavaScript', async ({
    client,
    assert,
  }) => {
    const page = await client.get(PAGE).header('user-agent', 'Discordbot/2.0')
    page.assertStatus(200)
    const html = page.text()
    page.assertTextIncludes('property="og:title" content="Moonfern#EUW · Victory on LeBlanc"')
    assert.match(
      html,
      /property="og:description" content="18\/1\/11, Invade score 9\d, MVP\. Mid, Ranked Solo\/Duo, 32:18\."/
    )
    page.assertTextIncludes(
      `property="og:url" content="https://invade.lol/Moonfern-EUW/match/${SHARE_MATCH_ID}"`
    )
    page.assertTextIncludes(
      `rel="canonical" href="https://invade.lol/Moonfern-EUW/match/${SHARE_MATCH_ID}"`
    )
    page.assertTextIncludes(
      `property="og:image" content="https://invade.lol/og/match/${SHARE_MATCH_ID}/Moonfern-EUW.jpg?v=`
    )
    page.assertTextIncludes('property="og:image:type" content="image/jpeg"')
    page.assertTextIncludes('property="og:image:width" content="1200"')
    page.assertTextIncludes('property="og:image:height" content="630"')
    page.assertTextIncludes('property="og:image:alt" content="Victory on LeBlanc: 18/1/11')
    page.assertTextIncludes('name="twitter:card" content="summary_large_image"')
  })

  test('the image URL changes with the K/D/A', async ({ client, assert }) => {
    const before = await linked(client)
    stored = shareMatch({ [SHARE_PLAYER]: { ...PEAK[SHARE_PLAYER], deaths: 2 } })
    matchShareService.clear()
    const after = await linked(client)
    assert.notEqual(after, before)
    // The old link still answers, with the current card for a while.
    const old = await client.get(`${IMAGE}?v=${before}`)
    old.assertStatus(200)
    old.assertHeader('cache-control', 'public, max-age=300')
  })

  test('a loss reads as a defeat', async ({ client }) => {
    stored = shareMatch(LOSS, { t1Win: 0, t2Win: 1 })
    const page = await client.get(PAGE)
    page.assertTextIncludes('property="og:title" content="Moonfern#EUW · Defeat on LeBlanc"')
  })

  test('an unknown game or player keeps the generic page', async ({ client, assert }) => {
    stored = null
    const unknown = await client.get(PAGE).header('user-agent', 'Twitterbot/1.0')
    unknown.assertStatus(200)
    assert.notInclude(unknown.text(), 'og:image')
    assert.notInclude(unknown.text(), 'rel="canonical"')
    stored = shareMatch()
    matchShareService.clear()
    const stranger = await client.get(`/Somebody-Else/match/${SHARE_MATCH_ID}`)
    stranger.assertStatus(200)
    assert.notInclude(stranger.text(), 'og:image')
  })
})
