import { test } from '@japa/runner'
import { layoutPlot, type PlotInput } from '../../inertia/lib/plot_layout.js'

const options = {
  width: 600,
  height: 300,
  radius: 15,
  gap: 4,
  labelHeight: 16,
  labelWidth: (t: string) => t.length * 7,
}

/** Twelve points on top of one another, and a few apart. */
const crowd: PlotInput[] = [
  ...Array.from({ length: 12 }, (_, i) => ({
    key: `c${i}`,
    x: 120 + (i % 3),
    y: 150 + (i % 4),
    label: `Champion ${i}`,
  })),
  { key: 'far', x: 520, y: 60, label: 'Far' },
  { key: 'edge', x: 0, y: 300, label: 'Edge' },
]

test.group('Plot layout', () => {
  test('no two markers cover each other, all inside the plot', ({ assert }) => {
    const markers = layoutPlot(crowd, options)
    for (const [i, a] of markers.entries()) {
      assert.isAtLeast(a.mx, options.radius)
      assert.isAtMost(a.mx, options.width - options.radius)
      assert.isAtLeast(a.my, options.radius)
      assert.isAtMost(a.my, options.height - options.radius)
      for (const b of markers.slice(i + 1))
        assert.isAtLeast(Math.hypot(a.mx - b.mx, a.my - b.my), 2 * options.radius + 3.9)
    }
  })

  test('a marker alone stays on its point and is named; a crowd keeps a line home', ({
    assert,
  }) => {
    const markers = layoutPlot(crowd, options)
    const far = markers.find((m) => m.key === 'far')!
    assert.deepEqual([far.mx, far.my, far.moved], [520, 60, false])
    assert.equal(far.label?.side, 'right')
    assert.isTrue(markers.some((m) => m.moved))
  })

  test('labels cover no marker and no other label, and come out the same each time', ({
    assert,
  }) => {
    const markers = layoutPlot(crowd, options)
    const labels = markers.flatMap((m) => (m.label ? [m.label] : []))
    for (const [i, l] of labels.entries()) {
      for (const m of markers) {
        const nx = Math.max(l.x, Math.min(m.mx, l.x + l.width))
        const ny = Math.max(l.y, Math.min(m.my, l.y + 16))
        assert.isAtLeast(Math.hypot(nx - m.mx, ny - m.my), options.radius)
      }
      for (const o of labels.slice(i + 1)) {
        const apart =
          l.x + l.width <= o.x || o.x + o.width <= l.x || l.y + 16 <= o.y || o.y + 16 <= l.y
        assert.isTrue(apart)
      }
    }
    assert.deepEqual(layoutPlot(crowd, options), markers)
  })
})
