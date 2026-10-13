import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import homeService, { viewBucketKeys } from '#services/home_service'

/** Fictional players only: the repository is public. A PUUID is 78 characters. */
const CLIMBER = 'test-home-climber-'.padEnd(78, 'x')
const VIEWED = 'test-home-viewed-'.padEnd(78, 'x')
const HOUR = 3_600_000

test.group('Home page', (group) => {
  group.each.teardown(async () => {
    await db.from('riot_rank').whereIn('puuid', [CLIMBER, VIEWED]).delete()
    await db.from('riot_player').whereIn('puuid', [CLIMBER, VIEWED]).delete()
    await redis.zrem(viewBucketKeys(Date.now(), 1)[0], VIEWED)
  })

  async function player(puuid: string, gameName: string) {
    await db.table('riot_player').insert({
      puuid,
      platform: 'EUW1',
      game_name: gameName,
      tag_line: 'TEST',
      profile_icon_id: 29,
      summoner_level: 120,
      last_refresh_at: new Date(),
    })
  }

  test('renders the search and the desktop app, and reads nothing for it', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/')
    response.assertStatus(200)
    response.assertTextIncludes('Find a player')
    response.assertTextIncludes('href="/app"')
    const page = response.text()
    for (const prop of ['trending', 'best', 'climbs', 'champions']) {
      assert.notInclude(page, `&quot;${prop}&quot;:`)
    }
  })

  test('lists a climb from the rank snapshots, with the rank it reached', async ({ assert }) => {
    await player(CLIMBER, 'Test Climber')
    const now = Date.now()
    await db.table('riot_rank').multiInsert([
      {
        puuid: CLIMBER,
        queue_type: 'RANKED_SOLO_5x5',
        tier: 'IRON',
        division: 'IV',
        league_points: 0,
        wins: 10,
        losses: 10,
        fetched_at: new Date(now - 30 * HOUR),
        source: 'riot',
      },
      {
        puuid: CLIMBER,
        queue_type: 'RANKED_SOLO_5x5',
        tier: 'CHALLENGER',
        division: 'I',
        league_points: 2500,
        wins: 22,
        losses: 11,
        fetched_at: new Date(now - HOUR),
        source: 'riot',
      },
    ])

    const climbs = await homeService.climbs(now)
    const climb = climbs.find((c) => c.player.gameName === 'Test Climber')!
    assert.exists(climb)
    assert.equal(climbs[0], climb)
    assert.equal(climb.gain, 2800 + 2500)
    assert.equal(climb.wins, 12)
    assert.equal(climb.losses, 1)
    assert.deepEqual(climb.player.rank, { tier: 'CHALLENGER', division: '', lp: 2500 })
    assert.deepEqual(Object.keys(climb).sort(), ['gain', 'losses', 'player', 'points', 'wins'])
    assert.notProperty(climb.player, 'puuid')
  })

  test('counts a profile view by day and ranks the week by it', async ({ client, assert }) => {
    await player(VIEWED, 'Test Viewed')
    const key = viewBucketKeys(Date.now(), 1)[0]

    const response = await client.put(`/api/summoners/puuid/${VIEWED}/increment`)
    response.assertStatus(200)
    // The day's count is written alongside the answer, not before it.
    let views = null
    for (let i = 0; i < 20 && views === null; i++) {
      views = await redis.zscore(key, VIEWED)
      if (views === null) await new Promise((resolve) => setTimeout(resolve, 25))
    }
    assert.equal(Number(views), 1)
    assert.isAbove(await redis.ttl(key), 7 * 86_400)

    await redis.zincrby(key, 1_000_000, VIEWED)
    const trending = await homeService.trending()
    assert.equal(trending.window, 'week')
    assert.equal(trending.players[0].gameName, 'Test Viewed')
    assert.equal(trending.players[0].views, 1_000_001)
    assert.notProperty(trending.players[0], 'puuid')
  })
})
