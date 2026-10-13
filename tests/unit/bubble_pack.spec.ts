import { test } from '@japa/runner'
import { bubbleAt, packBubbles, type Bubble } from '../../inertia/lib/bubble_pack.js'

/** A fictional pool: a few mains and a long tail, as a mastery list looks. */
const POOL = Array.from({ length: 160 }, (_, index) => ({
  id: index + 1,
  value: Math.round(1_200_000 * (index + 1) ** -1.3),
}))

function overlaps(bubbles: Bubble[], gap: number) {
  let count = 0
  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      const a = bubbles[i]
      const b = bubbles[j]
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + gap * 0.5) count++
    }
  }
  return count
}

test.group('Bubble packing', () => {
  test('packs a large pool without overlaps, inside the width', ({ assert }) => {
    for (const [width, aspect] of [
      [920, 2.1],
      [600, 1.5],
      [343, 1.05],
    ]) {
      const layout = packBubbles(POOL, { width, aspect, gap: 2, minRadius: 6 })
      assert.lengthOf(layout.bubbles, POOL.length)
      assert.equal(overlaps(layout.bubbles, 2), 0, `overlaps at ${width}px`)
      for (const bubble of layout.bubbles) {
        assert.isAtLeast(bubble.x - bubble.r, -0.5)
        assert.isAtMost(bubble.x + bubble.r, width + 0.5)
        assert.isAtLeast(bubble.y - bubble.r, -0.5)
        assert.isAtMost(bubble.y + bubble.r, layout.height + 0.5)
      }
      // Never much taller than the box it was asked to fill.
      assert.isAtMost(layout.height, (width / aspect) * 1.1)
    }
  })

  test('areas follow the values above the smallest radius', ({ assert }) => {
    const layout = packBubbles(POOL, { width: 920, aspect: 2.1, minRadius: 6 })
    const [first, second] = layout.bubbles
    assert.equal(first.id, 1)
    assert.closeTo((first.r / second.r) ** 2, POOL[0].value / POOL[1].value, 0.01)
    const smallest = Math.min(...layout.bubbles.map((bubble) => bubble.r))
    assert.isAbove(smallest, 3)
  })

  test('is deterministic', ({ assert }) => {
    const options = { width: 640, aspect: 1.5 }
    assert.deepEqual(packBubbles(POOL, options), packBubbles(POOL, options))
  })

  test('handles tiny pools and nothing at all', ({ assert }) => {
    assert.deepEqual(packBubbles([], { width: 600, aspect: 2 }).bubbles, [])
    assert.lengthOf(packBubbles([{ id: 1, value: 0 }], { width: 600, aspect: 2 }).bubbles, 0)
    for (const count of [1, 2, 3]) {
      const layout = packBubbles(POOL.slice(0, count), { width: 600, aspect: 2, gap: 3 })
      assert.lengthOf(layout.bubbles, count)
      assert.equal(overlaps(layout.bubbles, 3), 0)
      assert.isAbove(layout.height, 0)
      assert.isAtMost(layout.height, (600 / 2) * 1.1)
    }
  })

  test('finds the bubble under a point, or a small one nearby', ({ assert }) => {
    const layout = packBubbles(POOL.slice(0, 20), { width: 600, aspect: 1.5 })
    const target = layout.bubbles[5]
    assert.equal(bubbleAt(layout.bubbles, target.x, target.y)?.id, target.id)
    const near = { x: target.x + target.r + 4, y: target.y }
    const found = bubbleAt(layout.bubbles, near.x, near.y, 12)
    assert.isNotNull(found)
    assert.isNull(bubbleAt(layout.bubbles, -100, -100, 12))
  })
})
