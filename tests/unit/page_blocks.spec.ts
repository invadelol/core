import { test } from '@japa/runner'
import { onceEach, settle } from '#services/page_blocks'

const after = <T>(ms: number, value: T) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms))

test.group('Page blocks', () => {
  test('a block loads once whoever asks, and a failed or empty one is null', async ({ assert }) => {
    let loads = 0
    const blocks = onceEach({
      build: async () => ++loads,
      broken: async () => {
        throw new Error('down')
      },
      empty: async () => undefined,
    })
    const [a, b] = await Promise.all([blocks.build(), blocks.build()])
    assert.equal(a, 1)
    assert.equal(b, 1)
    assert.equal(await blocks.build(), 1)
    assert.equal(loads, 1)
    assert.isNull(await blocks.broken())
    assert.isNull(await blocks.empty())
  })

  test('what is ready in time goes with the page, the rest is named to follow', async ({
    assert,
  }) => {
    const blocks = onceEach({
      cached: async () => 'runes',
      quick: () => after(5, 'spells'),
      slow: () => after(300, 'matchups'),
    })
    const started = Date.now()
    const { ready, waiting } = await settle(blocks, 60)
    assert.isBelow(Date.now() - started, 250)
    assert.deepEqual(ready, { cached: 'runes', quick: 'spells' })
    assert.deepEqual(waiting, ['slow'])
    // The late block is still loading, once: its deferred prop gets the same answer.
    assert.equal(await blocks.slow(), 'matchups')
    assert.notProperty(ready, 'slow')
  })

  test('a page whose blocks are all ready waits for nothing more', async ({ assert }) => {
    const started = Date.now()
    const { ready, waiting } = await settle(
      onceEach({ a: async () => 1, b: async () => null }),
      5000
    )
    assert.isBelow(Date.now() - started, 1000)
    assert.deepEqual(ready, { a: 1, b: null })
    assert.deepEqual(waiting, [])
  })
})
