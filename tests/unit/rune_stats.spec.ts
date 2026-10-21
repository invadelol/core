import { test } from '@japa/runner'
import { evidenceLevel, isTie } from '#services/ranked_stats'
import { summarize } from '#services/rune_stats'

const COMET = [8200, 8229, 8226, 8210, 8237, 8300, 8345, 8347, 5007, 5008, 5011]
const AERY = [8200, 8214, 8226, 8210, 8237, 8300, 8345, 8347, 5007, 5008, 5011]

test.group('Rune stats', () => {
  test('levels follow the pipeline precision targets', ({ assert }) => {
    assert.equal(evidenceLevel(50, 25), 0)
    assert.equal(evidenceLevel(100, 50), 1)
    assert.equal(evidenceLevel(400, 200), 2)
    assert.equal(evidenceLevel(1600, 800), 3)
  })

  test('ranks pages by games and sums keystones across pages', ({ assert }) => {
    const other = [...COMET.slice(0, 5), 8000, 8009, 9105, 5007, 5008, 5011]
    const stats = summarize([
      [...AERY, 100, 48],
      [...COMET, 300, 160],
      [...other, 100, 52],
    ])
    assert.equal(stats.games, 500)
    assert.equal(stats.win, 0.52)
    assert.deepEqual(stats.pages[0].page, {
      primaryStyle: 8200,
      keystone: 8229,
      primary: [8226, 8210, 8237],
      secondaryStyle: 8300,
      secondary: [8345, 8347],
      shards: [5007, 5008, 5011],
    })
    assert.equal(stats.pages[0].share, 0.6)
    assert.deepEqual(
      stats.keystones.map((k) => [k.keystone, k.games, k.share]),
      [
        [8229, 400, 0.8],
        [8214, 100, 0.2],
      ]
    )
  })

  test('a page close to the next one is a tie, capped at level 2', ({ assert }) => {
    assert.isTrue(isTie(1700, 1650))
    assert.isFalse(isTie(300, 100))
    const stats = summarize([
      [...COMET, 1700, 850],
      [...AERY, 1650, 825],
    ])
    assert.deepEqual(
      stats.pages.map((p) => [p.level, p.tie]),
      [
        [2, true],
        [3, false],
      ]
    )
  })

  test('no games, no pages', ({ assert }) => {
    assert.deepEqual(summarize([]), { games: 0, win: 0, pages: [], keystones: [] })
  })
})
