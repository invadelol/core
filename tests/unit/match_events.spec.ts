import { test } from '@japa/runner'
import { buildEventRows } from '#utils/clickhouse'

/** Participants 1‥5 on blue (100), 6‥10 on red (200). */
const teamOf = new Map(Array.from({ length: 10 }, (_, i) => [i + 1, i < 5 ? 100 : 200]))

function timeline(events: unknown[]) {
  return {
    info: {
      frames: [
        { timestamp: 0, events: [] },
        { timestamp: 60000, events },
      ],
    },
  }
}

test.group('match events', () => {
  test('keeps kills with their killer, victim, assists and the team they count for', ({
    assert,
  }) => {
    const rows = buildEventRows(
      'EUW1_1',
      'EUW1',
      1000,
      timeline([
        {
          type: 'CHAMPION_KILL',
          timestamp: 185000,
          killerId: 2,
          victimId: 7,
          assistingParticipantIds: [1, 3],
          position: { x: 2000, y: 12000 },
        },
        // Executed by a turret: it still counts for the victim's enemies.
        { type: 'CHAMPION_KILL', timestamp: 190000, killerId: 0, victimId: 4, position: {} },
        { type: 'ITEM_PURCHASED', timestamp: 191000, participantId: 1, itemId: 1055 },
        { type: 'WARD_PLACED', timestamp: 192000, creatorId: 1 },
      ]),
      teamOf
    )
    assert.lengthOf(rows, 2)
    assert.deepInclude(rows[0], {
      match_id: 'EUW1_1',
      t_ms: 185000,
      kind: 'kill',
      team_id: 100,
      killer: 2,
      victim: 7,
      assists: [1, 3],
      pos_x: 2000,
      pos_y: 12000,
    })
    assert.deepInclude(rows[1], { kind: 'kill', team_id: 200, killer: 0, victim: 4 })
  })

  test('reads objectives as taken by a team', ({ assert }) => {
    const rows = buildEventRows(
      'EUW1_1',
      'EUW1',
      1000,
      timeline([
        {
          type: 'ELITE_MONSTER_KILL',
          timestamp: 390000,
          killerId: 6,
          killerTeamId: 200,
          monsterType: 'DRAGON',
          monsterSubType: 'FIRE_DRAGON',
        },
        { type: 'ELITE_MONSTER_KILL', timestamp: 400000, killerId: 0, monsterType: 'HORDE' },
        {
          type: 'BUILDING_KILL',
          timestamp: 610000,
          killerId: 3,
          teamId: 200,
          buildingType: 'TOWER_BUILDING',
          towerType: 'OUTER_TURRET',
          laneType: 'MID_LANE',
        },
        {
          type: 'BUILDING_KILL',
          timestamp: 1430000,
          killerId: 0,
          teamId: 100,
          buildingType: 'INHIBITOR_BUILDING',
          laneType: 'BOT_LANE',
        },
      ]),
      teamOf
    )
    // The voidgrub without a taker (despawned) is dropped.
    assert.deepEqual(
      rows.map((r) => [r.kind, r.sub, r.lane, r.team_id, r.killer]),
      [
        ['dragon', 'FIRE_DRAGON', '', 200, 6],
        ['tower', 'OUTER_TURRET', 'MID_LANE', 100, 3],
        ['inhibitor', '', 'BOT_LANE', 200, 0],
      ]
    )
  })
})
