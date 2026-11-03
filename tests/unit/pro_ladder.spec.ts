import { test } from '@japa/runner'
import { placesBefore, rankScore } from '#services/pro_ladder_service'
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
