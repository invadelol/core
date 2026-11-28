import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import {
  RANK_SCORE_SQL,
  ladderAccount,
  placesBefore,
  rankScore,
  rankSortScore,
  sortLadder,
} from '#services/pro_ladder_service'
import { SERVERS, serverLabel, serverList } from '#constants/riot'
import { buildsOf, maxOrder, type ProGame } from '#services/pro_service'

test.group('Pro ladder', () => {
  test('a rank reads as one number, Master and above on one scale', ({ assert }) => {
    assert.equal(rankScore('IRON', 4, 0), 0)
    assert.equal(rankScore('DIAMOND', 1, 80), 2780)
    assert.equal(rankScore('DIAMOND', 'I', 80), 2780)
    assert.equal(rankScore('MASTER', null, 20), 2820)
    assert.equal(rankScore('CHALLENGER', 1, 1400), 4200)
    assert.isNull(rankScore(null, null, null))
  })

  test('the SQL rank score reads like rankScore, so the best account is the same', async ({
    assert,
  }) => {
    // Master and above compare by LP whatever the tier, and their division may be I or empty.
    const ranks: [string, number | null, number | null][] = [
      ['CHALLENGER', 1, 900],
      ['MASTER', null, 1100],
      ['GRANDMASTER', 1, 1000],
      ['DIAMOND', 1, 80],
      ['DIAMOND', 4, 99],
      ['EMERALD', 2, 50],
      ['IRON', 4, 0],
      ['DIAMOND', 2, null],
      ['MASTER', null, null],
    ]
    const values = ranks.map(() => '(?::text, ?::smallint, ?::int)').join(', ')
    const { rows } = await db.rawQuery(
      `SELECT a.tier, ${RANK_SCORE_SQL} AS score FROM (VALUES ${values}) AS a (tier, division, lp)`,
      ranks.flat()
    )
    assert.deepEqual(
      rows.map((r: { score: number }) => Number(r.score)),
      ranks.map(([t, d, lp]) => rankSortScore(t, d, lp))
    )
  })

  test('an account without an LP shows none, not 0 or any default', ({ assert }) => {
    const row = {
      account_id: 'a1',
      game_name: 'Example',
      tag_line: 'EUW',
      platform: 'EUW1',
      tier: 'DIAMOND',
      division: 2,
      wins: null,
      losses: null,
    }
    assert.isNull(ladderAccount({ ...row, lp: null }).lp)
    assert.isNull(ladderAccount({ ...row, lp: undefined }).lp)
    assert.equal(ladderAccount({ ...row, lp: 0 }).lp, 0)
    assert.equal(ladderAccount({ ...row, lp: 75 }).lp, 75)
  })

  test('the ladder orders by tier, then division, then LP, an unknown LP last in its division', ({
    assert,
  }) => {
    const row = (name: string, tier: string, division: number | null, lp: number | null) => ({
      name,
      tier,
      division,
      lp,
    })
    const rows = [
      row('unknown-d1', 'DIAMOND', 1, null),
      row('d4-98', 'DIAMOND', 4, 98),
      row('d1-0', 'DIAMOND', 1, 0),
      row('d2-75', 'DIAMOND', 2, 75),
      row('master-10', 'MASTER', null, 10),
      row('e1-99', 'EMERALD', 1, 99),
      row('d1-75', 'DIAMOND', 1, 75),
      row('d2-75b', 'DIAMOND', 2, 75),
      row('challenger-900', 'CHALLENGER', 1, 900),
      row('unknown-d4', 'DIAMOND', 4, null),
    ]
    assert.deepEqual(
      sortLadder(rows).map((r) => r.name),
      [
        'challenger-900',
        'master-10',
        'd1-75',
        'd1-0',
        'unknown-d1',
        'd2-75',
        'd2-75b',
        'd4-98',
        'unknown-d4',
        'e1-99',
      ]
    )
  })

  test('an unknown LP never reads as 0 LP, and is no move', ({ assert }) => {
    assert.isBelow(rankSortScore('DIAMOND', 1, null)!, rankSortScore('DIAMOND', 1, 0)!)
    assert.isAbove(rankSortScore('DIAMOND', 1, null)!, rankSortScore('DIAMOND', 2, 99)!)
    assert.isAbove(rankSortScore('MASTER', null, null)!, rankSortScore('DIAMOND', 1, 99)!)
    assert.isBelow(rankSortScore('MASTER', null, null)!, rankSortScore('MASTER', null, 0)!)
    assert.isNull(rankSortScore(null, null, null))
  })

  test('servers read as players say them, in one order', ({ assert }) => {
    assert.equal(serverLabel('EUN1'), 'EUNE')
    assert.equal(serverLabel('SG2'), 'SEA')
    assert.equal(SERVERS.find((s) => s.slug === 'kr')?.platform, 'KR')
    assert.equal(serverList(['NA1', 'EUW1', 'BR1']), 'EUW, NA and BR')
    assert.equal(serverList(['KR']), 'KR')
    assert.equal(serverList(['EUW1', 'NA1', 'BR1', 'KR', 'EUN1']), '5 servers')
  })

  test('places a day ago come from the scores then, unknown ones staying put', ({ assert }) => {
    // Now: A 1500, B 1400, C 1300. A day ago: A 1350 (+150), B 1400 (unknown), C 1450 (-150).
    const before = placesBefore([
      { score: 1500, lp: 150 },
      { score: 1400, lp: null },
      { score: 1300, lp: -150 },
    ])
    assert.deepEqual(before, [3, 2, 1])
  })
})

const game = (over: Partial<ProGame>): ProGame => ({
  matchId: 'EUW1_1',
  account: 'a#b',
  platform: 'EUW1',
  startMs: 0,
  champion: 103,
  position: 'MIDDLE',
  win: true,
  kills: 1,
  deaths: 1,
  assists: 1,
  cs: 100,
  items: [],
  spells: [4, 14],
  keystone: 8112,
  secondaryStyle: 8200,
  durationSec: 1800,
  opponent: null,
  ...over,
})

test.group('Pro builds', () => {
  test('the max order is the order Q, W and E reach five points', ({ assert }) => {
    assert.deepEqual(maxOrder([1, 2, 3, 1, 1, 4, 1, 1, 2, 2, 4, 2, 2, 3, 3]), ['Q', 'W', 'E'])
    assert.deepEqual(maxOrder([1, 2]), [])
  })

  test('a build is the most bought finished items, boots apart', ({ assert }) => {
    const kinds = { legendary: new Set([3118, 4645, 3157, 3089]), boots: new Set([3020]) }
    const games = [
      game({ items: [3020, 3118, 4645, 3157, 1052, 0], win: true }),
      game({ items: [3020, 3118, 4645, 3089, 0, 0], win: false }),
      game({ items: [3020, 3118, 4645, 3157, 0, 0], spells: [14, 4], win: true }),
    ]
    const [b] = buildsOf(games, kinds, [{ champion: 103, games: 3, wins: 2, kda: 3 }])
    assert.equal(b.boots, 3020)
    assert.deepEqual(b.core, [3118, 4645, 3157])
    assert.equal(b.coreGames, 2)
    assert.deepEqual(b.spells, [4, 14])
    assert.deepEqual(b.form, [true, false, true])
  })
})
