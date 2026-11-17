import { readFileSync } from 'node:fs'
import { test } from '@japa/runner'
import { detailOf } from '../../inertia/lib/match.js'
import {
  barOf,
  frameAt,
  laneOrder,
  leadBars,
  leadOf,
  objectivesOf,
  opponentOf,
  short,
  signed,
  smoothPath,
  spread,
  stack,
  tick,
  timeTicks,
  twoTeams,
  valueAxis,
} from '../../inertia/lib/match_chart.js'
import type { Match } from '../../inertia/lib/types.js'

/* A fictional 41:33 ranked game stored as invade.lol keeps it (made-up Riot IDs and puuids): one
   frame a minute and one at the end, kills, objectives, three voidgrubs taken together. */
const match = JSON.parse(
  readFileSync(new URL('../fixtures/chart_match.json', import.meta.url), 'utf8')
) as Match
const detail = detailOf(match)
const timeline = detail.timeline!

test.group('Match chart', () => {
  test('reads the stored timeline a frame a minute', ({ assert }) => {
    assert.isTrue(twoTeams(detail))
    assert.lengthOf(timeline.t, 43)
    assert.equal(timeline.t.at(-1), 2493)
    assert.equal(frameAt(timeline.t, 2040), 34)
    assert.equal(frameAt(timeline.t, 2480), 42)
  })

  test('draws one lead bar a minute, the end taking a minute it closes', ({ assert }) => {
    const bars = leadBars(timeline.t, leadOf(detail, timeline, 100, 'gold'))
    assert.lengthOf(bars, 41)
    assert.equal(bars[0].t, 60)
    assert.equal(bars.at(-1)!.t, 2493)
    assert.notInclude(
      bars.map((b) => b.t),
      2460
    )
    assert.equal(barOf(bars, 0), -1)
    assert.equal(barOf(bars, 34), 33)
    // 41:00 is drawn by the end's bar.
    assert.equal(barOf(bars, 41), 40)
    assert.equal(barOf(bars, 42), 40)
  })

  test('gives each side its own lead', ({ assert }) => {
    const end = timeline.t.length - 1
    const sum = (team: number, key: 'gold' | 'cs') =>
      detail.players.reduce((s, p, i) => s + (p.teamId === team ? timeline[key][i][end] : 0), 0)
    const blue = leadOf(detail, timeline, 100, 'gold')
    const red = leadOf(detail, timeline, 200, 'gold')
    assert.equal(blue[end], sum(100, 'gold') - sum(200, 'gold'))
    assert.equal(red[end], -blue[end])
    assert.isAbove(blue[end], 3000)
    assert.equal(leadOf(detail, timeline, 100, 'cs')[end], sum(100, 'cs') - sum(200, 'cs'))
    assert.equal(leadOf(detail, timeline, 200, 'xp')[end], -timeline.xpDiff[end])
  })

  test('puts teams in lane order and finds the lane opponent', ({ assert }) => {
    const blue = laneOrder(detail.players, 100)
    assert.deepEqual(
      blue.map((i) => detail.players[i].position),
      ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT']
    )
    const mid = blue[2]
    const opp = opponentOf(detail.players, mid)
    assert.equal(detail.players[opp].teamId, 200)
    assert.equal(detail.players[opp].position, 'MID')
  })

  test('lists the objectives once, voidgrubs together and towers small', ({ assert }) => {
    const marks = objectivesOf(detail, timeline)
    assert.lengthOf(
      marks.filter((m) => m.icon === 'grubs'),
      1
    )
    assert.lengthOf(
      marks.filter((m) => m.small),
      12
    )
    assert.isTrue(marks.every((m) => m.small === (m.icon === 'tower')))
    assert.deepEqual(
      marks.map((m) => m.t),
      [...marks.map((m) => m.t)].sort((a, b) => a - b)
    )
  })

  test('labels the value axis on round steps with room above the top line', ({ assert }) => {
    const axis = valueAxis(19_400)
    assert.deepEqual(axis.ticks, [5000, 10_000, 15_000, 20_000])
    assert.equal(axis.hi, 21_000)
    assert.deepEqual(valueAxis(331).ticks, [100, 200, 300])
    assert.deepEqual(
      timeTicks(2493, false).map((s) => s / 60),
      [5, 10, 15, 20, 25, 30, 35, 40]
    )
    assert.deepEqual(
      timeTicks(2493, true).map((s) => s / 60),
      [10, 20, 30, 40]
    )
  })

  test('formats values the way the header and the rows read them', ({ assert }) => {
    assert.equal(short(18_240), '18.2k')
    assert.equal(short(771), '771')
    assert.equal(short(306, 'cs'), '306')
    assert.equal(signed(3480), '+3.5k')
    assert.equal(signed(-771), '−771')
    assert.equal(signed(0), '0')
    assert.equal(tick(15_000), '15k')
    assert.equal(tick(12_500), '12.5k')
  })

  test('stacks the end portraits apart and inside the chart', ({ assert }) => {
    const ys = stack([40, 41, 42, 190, 195], 18, 190)
    const sorted = [...ys].sort((a, b) => a - b)
    for (let i = 1; i < sorted.length; i++) assert.isAtLeast(sorted[i] - sorted[i - 1], 18)
    assert.isAtMost(Math.max(...ys), 190)
    assert.equal(ys[0], 40)
  })

  test('spreads crowded marks without passing the end', ({ assert }) => {
    const xs = spread([10, 12, 14, 100, 101], [15, 15, 11, 15, 15], 105)
    for (let i = 1; i < xs.length; i++) assert.isAbove(xs[i], xs[i - 1])
    assert.isAtMost(xs.at(-1)!, 105)
    assert.equal(xs[0], 10)
  })

  test('draws smooth lines that never pass a value the game did not reach', ({ assert }) => {
    const pts: Array<[number, number]> = [
      [0, 100],
      [10, 80],
      [20, 80],
      [30, 20],
      [40, 10],
    ]
    const d = smoothPath(pts)
    assert.isTrue(d.startsWith('M0.0 100.0'))
    const ys = [...d.matchAll(/C([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)/g)].flatMap((m) => [
      Number(m[2]),
      Number(m[4]),
    ])
    assert.lengthOf(ys, 8)
    assert.isTrue(ys.every((y) => y >= 10 && y <= 100))
  })
})
