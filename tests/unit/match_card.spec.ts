import { test } from '@japa/runner'
import sharp from 'sharp'
import clickhouse from 'adonisjs-clickhouse/services/main'
import matchRepository from '#services/analytics/match_repository'
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  matchCardVersion,
  renderMatchCard,
  type MatchCard,
} from '#services/match_card'
import { shareOf } from '#services/match_share_service'
import { scoreLobby } from '../../inertia/lib/match.js'
import {
  LOSS,
  PEAK,
  SHARE_MATCH_ID,
  SHARE_PLAYER,
  shareArt,
  shareMatch,
} from '#tests/fixtures/match_share'

const CHAMPIONS = { '7': 'LeBlanc' }

test.group('Match share', () => {
  test('finds the player by Riot ID and reads the page score, MVP and meta', ({ assert }) => {
    const match = shareMatch(PEAK)
    const share = shareOf(match, 'Moonfern-EUW', CHAMPIONS)!
    const score = scoreLobby(match)[`share-${SHARE_PLAYER}`].score
    assert.isAtLeast(score, 90)
    assert.deepEqual(share.card, {
      championId: 7,
      win: true,
      queue: 'Ranked Solo',
      duration: 1938,
      kills: 18,
      deaths: 1,
      assists: 11,
      score,
      tag: 'MVP',
    })
    assert.equal(share.social.title, 'Moonfern#EUW · Victory on LeBlanc')
    assert.equal(
      share.social.description,
      `18/1/11, Invade score ${score}, MVP. Mid, Ranked Solo/Duo, 32:18.`
    )
    assert.equal(share.social.url, `https://invade.lol/Moonfern-EUW/match/${SHARE_MATCH_ID}`)
    assert.equal(share.social.canonical, share.social.url)
    assert.equal(
      share.social.image,
      `https://invade.lol/og/match/${SHARE_MATCH_ID}/Moonfern-EUW.jpg?v=${share.version}`
    )
    assert.equal(share.social.imageType, 'image/jpeg')
  })

  test('a loss, a name with a space, and an unknown champion name', ({ assert }) => {
    const match = shareMatch({ ...LOSS, 4: { gameName: 'Sable Fox', tagLine: 'SLY' } })
    const loss = shareOf(match, 'Moonfern-EUW')!
    assert.isFalse(loss.card.win)
    assert.equal(loss.social.title, 'Moonfern#EUW · Defeat')
    assert.match(loss.social.description, /^3\/7\/4, Invade score \d+(, ACE)?\. Mid, /)
    const spaced = shareOf(match, 'Sable%20Fox-SLY')!
    assert.equal(spaced.card.championId, 14)
    assert.include(spaced.social.image, '/Sable%20Fox-SLY.jpg?v=')
  })

  test('no share for a name not in the game, no Riot ID, remakes, Arena or AFK', ({ assert }) => {
    assert.isNull(shareOf(shareMatch(), 'Somebody-Else'))
    // The match page's comparison is exact.
    assert.isNull(shareOf(shareMatch(), 'moonfern-euw'))
    const anonymous = shareMatch({ 5: { gameName: '', tagLine: '' } })
    assert.isNull(shareOf(anonymous, '-'))
    assert.isNull(shareOf(shareMatch({}, { duration: 200 }), 'Moonfern-EUW'))
    assert.isNull(shareOf(shareMatch({}, { queueId: 1700, mapId: 30 }), 'Moonfern-EUW'))
    const afk = shareMatch({ [SHARE_PLAYER]: { champLevel: 6, goldEarned: 3000 } })
    assert.isNull(shareOf(afk, 'Moonfern-EUW'))
  })

  test('the version follows what is drawn', ({ assert }) => {
    const card = shareOf(shareMatch(PEAK), 'Moonfern-EUW')!.card
    const version = matchCardVersion(card)
    assert.match(version, /^[\w-]{10}$/)
    assert.equal(matchCardVersion({ ...card }), version)
    assert.notEqual(matchCardVersion({ ...card, deaths: card.deaths + 1 }), version)
    assert.notEqual(matchCardVersion({ ...card, kills: card.kills - 1 }), version)
    assert.notEqual(matchCardVersion({ ...card, score: card.score - 1 }), version)
    assert.notEqual(matchCardVersion({ ...card, tag: '' }), version)
    // A changed K/D/A in the stored game changes the image URL.
    const fixed = shareOf(
      shareMatch({ [SHARE_PLAYER]: { ...PEAK[SHARE_PLAYER], assists: 12 } }),
      'Moonfern-EUW'
    )!
    assert.notEqual(fixed.version, version)
  })
})

test.group('Match card', () => {
  const card: MatchCard = {
    championId: 7,
    win: true,
    queue: 'Ranked Solo',
    duration: 1722,
    kills: 8,
    deaths: 4,
    assists: 18,
    score: 67,
    tag: '',
  }

  test('renders a 1200 by 630 JPEG under 150 KB: win, loss and 90+', async ({ assert }) => {
    const art = await shareArt()
    for (const drawn of [
      card,
      { ...card, win: false, kills: 10, deaths: 7, assists: 11, score: 40 },
      { ...card, kills: 18, deaths: 1, assists: 11, score: 92, tag: 'MVP' as const },
      { ...card, win: false, score: 84, tag: 'ACE' as const, kills: 112, deaths: 13, assists: 131 },
    ]) {
      const image = await renderMatchCard(drawn, art)
      const meta = await sharp(image).metadata()
      assert.equal(meta.format, 'jpeg')
      assert.equal(meta.width, CARD_WIDTH)
      assert.equal(meta.height, CARD_HEIGHT)
      assert.isAtMost(image.byteLength, 150 * 1024)
    }
  })

  test('renders without art, on the ink', async ({ assert }) => {
    const image = await renderMatchCard(card)
    const meta = await sharp(image).metadata()
    assert.equal(meta.width, CARD_WIDTH)
    assert.equal(meta.height, CARD_HEIGHT)
  })
})

test.group('Match share read', (group) => {
  const query = clickhouse.query
  group.each.teardown(() => {
    clickhouse.query = query
  })

  /** Positional rows for the SELECT asked: `values` by column, 0 for anything else. */
  function fake(matches: Record<string, unknown>, players: Record<string, unknown>[]) {
    const asked: string[] = []
    clickhouse.query = (async ({ query: sql }: { query: string }) => {
      asked.push(sql)
      const [, select, table] = sql.match(/SELECT\s+([\s\S]*?)\s+FROM\s+(\w+)/)!
      const columns = select.split(',').map((c) => c.trim())
      const rows = table === 'matches' ? [matches] : players
      return { json: async () => rows.map((row) => columns.map((c) => row[c] ?? 0)) }
    }) as unknown as typeof query
    return asked
  }

  test('reads the game and its players without timeline, excluded queues as unknown', async ({
    assert,
  }) => {
    const asked = fake({ match_id: SHARE_MATCH_ID, queue_id: 420, duration_sec: 1938 }, [
      { match_id: SHARE_MATCH_ID, riot_id_game_name: 'Moonfern', kills: 18 },
    ])
    const match = await matchRepository.getSummaryById(SHARE_MATCH_ID)
    assert.equal(match?.participants[0].gameName, 'Moonfern')
    assert.equal(match?.participants[0].kills, 18)
    assert.lengthOf(asked, 2)
    assert.notMatch(asked.join('\n'), /match_timeline|match_events/)

    fake({ match_id: SHARE_MATCH_ID, queue_id: 4300 }, [])
    assert.isNull(await matchRepository.getSummaryById(SHARE_MATCH_ID))
    fake({}, [])
    assert.isNull(await matchRepository.getSummaryById(SHARE_MATCH_ID))
  })
})
