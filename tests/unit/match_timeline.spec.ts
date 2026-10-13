import { test } from '@japa/runner'
import { buildTimelineRows } from '#utils/clickhouse'

const info = {
  participants: [{ participantId: 1, puuid: 'p1', teamId: 100, summoner1Id: 4, summoner2Id: 14 }],
}

function timeline(frame: Record<string, unknown>) {
  return {
    info: {
      frames: [{ timestamp: 720000, events: [], participantFrames: { 1: frame } }],
    },
  }
}

test.group('match timeline rows', () => {
  test('holds values Riot reports below zero inside the unsigned columns', ({ assert }) => {
    // A real frame from a game whose insert ClickHouse rejected: current gold just below zero.
    const [row] = buildTimelineRows(
      'EUW1_1',
      'EUW1',
      1000,
      info,
      timeline({
        participantId: 1,
        level: 9,
        xp: 5200,
        currentGold: -3,
        totalGold: 5100,
        minionsKilled: 88,
        jungleMinionsKilled: -1,
        position: { x: -20, y: 70000 },
        timeEnemySpentControlled: 12,
      })
    )
    assert.equal(row.gold_current, 0)
    assert.equal(row.jungle_cs, 0)
    assert.equal(row.pos_x, 0)
    assert.equal(row.pos_y, 65535)
    assert.equal(row.gold_total, 5100)
    assert.equal(row.cs, 88)
    assert.equal(row.level, 9)
  })
})
