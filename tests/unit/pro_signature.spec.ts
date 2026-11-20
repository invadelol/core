import { test } from '@japa/runner'
import { SIGNATURE_GAMES, signatureOf } from '#services/pro_service'

test.group("A pro's signature champion", () => {
  test('is the champion they played most', ({ assert }) => {
    const rows = [
      [7, 6, 3],
      [103, 14, 8],
      [55, 9, 6],
    ]
    assert.deepEqual(signatureOf(rows), { champion: 103, games: 14, wins: 8 })
  })

  test('needs a few games: one or two say nothing', ({ assert }) => {
    assert.isNull(signatureOf([[103, 1, 1]]))
    assert.isNull(signatureOf([[103, SIGNATURE_GAMES - 1, 2]]))
    assert.deepEqual(signatureOf([[103, SIGNATURE_GAMES, 2]]), {
      champion: 103,
      games: SIGNATURE_GAMES,
      wins: 2,
    })
    assert.isNull(signatureOf([]))
  })

  test('breaks a tie on games by wins, then the lower id, the same every time', ({ assert }) => {
    assert.equal(
      signatureOf([
        [55, 8, 3],
        [7, 8, 5],
      ])?.champion,
      7
    )
    assert.equal(
      signatureOf([
        [55, 8, 5],
        [7, 8, 5],
      ])?.champion,
      7
    )
  })

  test('reads ClickHouse numbers given as strings, and skips an unknown champion', ({ assert }) => {
    assert.deepEqual(
      signatureOf([
        ['0', '40', '20'],
        ['238', '12', '7'],
      ]),
      { champion: 238, games: 12, wins: 7 }
    )
  })
})
