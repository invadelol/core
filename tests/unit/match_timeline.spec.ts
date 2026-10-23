import { test } from '@japa/runner'
import { buildParticipantRows, buildTimelineRows, skillOrders } from '#utils/clickhouse'
import {
  matchParticipantPlan,
  timelineFrames,
  timelinePlan,
  timelinePlayers,
} from '#services/analytics/match_repository'

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

/* ── Player columns on participants ──────────────────────────────
   Spells, runes, shards and the skill order were stored on every timeline frame; they now live
   once on the player's participant row, and a frame keeps its number of skill points. */

/** Two players with a timeline, one of them with styles Riot left undescribed; one without a puuid. */
const game = {
  queueId: 420,
  participants: [
    {
      participantId: 1,
      puuid: 'p1',
      teamId: 100,
      summoner1Id: 4,
      summoner2Id: 14,
      perks: {
        statPerks: { offense: 5005, flex: 5008, defense: 5011 },
        styles: [
          {
            description: 'primaryStyle',
            style: 8100,
            selections: [{ perk: 8112 }, { perk: 8139 }, { perk: 8138 }, { perk: 8135 }],
          },
          { description: 'subStyle', style: 8200, selections: [{ perk: 8226 }, { perk: 8210 }] },
        ],
      },
    },
    {
      participantId: 6,
      puuid: 'p6',
      teamId: 200,
      summoner1Id: 4,
      summoner2Id: 7,
      perks: {
        statPerks: { offense: 5008, flex: 5008, defense: 5001 },
        styles: [
          {
            style: 8000,
            selections: [{ perk: 8010 }, { perk: 9111 }, { perk: 9104 }, { perk: 8299 }],
          },
          { style: 8400, selections: [{ perk: 8444 }, { perk: 8451 }] },
        ],
      },
    },
    { participantId: 3, puuid: '', teamId: 100 },
  ],
}

const up = (participantId: number, skillSlot: number, timestamp: number) => ({
  type: 'SKILL_LEVEL_UP',
  participantId,
  skillSlot,
  timestamp,
})
const frame = (timestamp: number, events: unknown[]) => ({
  timestamp,
  events,
  participantFrames: Object.fromEntries(
    [1, 3, 6].map((id) => [id, { participantId: id, level: 1 + timestamp / 60000 }])
  ),
})
const gameTimeline = {
  info: {
    frames: [
      frame(0, []),
      frame(60000, [up(1, 1, 1000), up(6, 3, 1200), up(1, 0, 1300), up(3, 2, 1400)]),
      frame(120000, [up(1, 2, 61000), up(1, 3, 90000), up(6, 1, 100000)]),
      frame(180000, [up(1, 1, 150000), up(6, 2, 170000), up(6, 4, 175000)]),
    ],
  },
}

/**
 * What a player's timeline rows carried before: spells and runes, and the game's whole skill order
 * from the first point on (all of a player's rows shared one array, filled before they were
 * written). `points`: the skill points spent by each frame.
 */
const before = {
  1: {
    spells: [4, 14],
    perks: {
      primaryStyle: 8100,
      secondaryStyle: 8200,
      keystone: 8112,
      runes: [8112, 8139, 8138, 8135, 8226, 8210],
      statPerks: { offense: 5005, flex: 5008, defense: 5011 },
    },
    skillOrder: [1, 2, 3, 1],
    points: [0, 1, 3, 4],
  },
  6: {
    spells: [4, 7],
    perks: {
      primaryStyle: 8000,
      secondaryStyle: 8400,
      keystone: 8010,
      runes: [8010, 9111, 9104, 8299, 8444, 8451],
      statPerks: { offense: 5008, flex: 5008, defense: 5001 },
    },
    skillOrder: [3, 1, 2, 4],
    points: [0, 1, 2, 4],
  },
} as const

/** A row as ClickHouse returns it to `plan`: values in the plan's column order. */
const positional = (columns: { select: string }, row: Record<string, unknown>) =>
  columns.select.split(', ').map((column) => row[column])

test.group('player columns on participants', () => {
  test('participant rows carry the runes, shards and whole skill order timeline rows did', ({
    assert,
  }) => {
    const rows = buildParticipantRows('EUW1_1', 'EUW1', 1000, game, skillOrders(gameTimeline))
    assert.lengthOf(rows, 2)
    for (const row of rows) {
      const old = before[row.participant_id as 1 | 6]
      assert.include(row, {
        spell1: old.spells[0],
        spell2: old.spells[1],
        primary_style: old.perks.primaryStyle,
        secondary_style: old.perks.secondaryStyle,
        keystone: old.perks.keystone,
        rune1: old.perks.runes[0],
        rune2: old.perks.runes[1],
        rune3: old.perks.runes[2],
        rune4: old.perks.runes[3],
        rune5: old.perks.runes[4],
        rune6: old.perks.runes[5],
        stat_offense: old.perks.statPerks.offense,
        stat_flex: old.perks.statPerks.flex,
        stat_defense: old.perks.statPerks.defense,
      })
      assert.deepEqual(row.skill_order, old.skillOrder)
    }
  })

  test('a game stored before its timeline keeps empty skill orders', ({ assert }) => {
    for (const row of buildParticipantRows('EUW1_1', 'EUW1', 1000, game)) {
      assert.deepEqual(row.skill_order, [])
      assert.isAbove(row.participant_id, 0)
    }
  })

  test('timeline rows count skill points and leave the player columns out', ({ assert }) => {
    const rows = buildTimelineRows('EUW1_1', 'EUW1', 1000, game, gameTimeline)
    // The player without a puuid is left out, as before.
    assert.lengthOf(rows, 4 * 2)
    for (const row of rows) {
      const old = before[row.participant_id as 1 | 6]
      assert.equal(row.skill_points, old.points[row.frame_ms / 60000])
      for (const column of [
        'puuid',
        'spell1',
        'keystone',
        'rune1',
        'stat_offense',
        'skill_order',
      ]) {
        assert.notProperty(row, column)
      }
    }
  })

  test('the match page rebuilds every frame exactly as the timeline rows read before', ({
    assert,
  }) => {
    const players = buildParticipantRows('EUW1_1', 'EUW1', 1000, game, skillOrders(gameTimeline))
    const frames = buildTimelineRows('EUW1_1', 'EUW1', 1000, game, gameTimeline)
    const read = timelineFrames(
      frames.map((row) => positional(timelinePlan, row)),
      timelinePlayers(players.map((row) => positional(matchParticipantPlan, row)))
    )

    assert.lengthOf(read, frames.length)
    for (const [i, out] of read.entries()) {
      const old = before[frames[i].participant_id as 1 | 6]
      assert.deepEqual(Object.keys(out), [
        'participantId',
        'puuid',
        'teamId',
        'frameMs',
        'level',
        'xp',
        'goldCurrent',
        'goldTotal',
        'goldPerSec',
        'cs',
        'jungleCs',
        'kills',
        'deaths',
        'assists',
        'posX',
        'posY',
        'timeCc',
        'spells',
        'perks',
        'skillOrder',
      ])
      assert.equal(out.participantId, frames[i].participant_id)
      assert.equal(out.puuid, `p${frames[i].participant_id}`)
      assert.equal(out.frameMs, frames[i].frame_ms)
      assert.deepEqual(out.spells, old.spells)
      assert.deepEqual(out.perks, old.perks)
      // The old rows' skill order, frame by frame: none before the first point, then all of it.
      assert.deepEqual(out.skillOrder, old.points[frames[i].frame_ms / 60000] ? old.skillOrder : [])
    }
  })

  test('frames of a player stored without a skill order or participant id show none', ({
    assert,
  }) => {
    const players = buildParticipantRows('EUW1_1', 'EUW1', 1000, game).map((row, i) =>
      positional(matchParticipantPlan, i ? { ...row, participant_id: 0 } : row)
    )
    const frames = buildTimelineRows('EUW1_1', 'EUW1', 1000, game, gameTimeline)
    const read = timelineFrames(
      frames.map((row) => positional(timelinePlan, row)),
      timelinePlayers(players)
    )
    for (const out of read) {
      assert.deepEqual(out.skillOrder, [])
      // The second player's row predates participant ids: their frames name no one.
      assert.equal(out.puuid, out.participantId === 1 ? 'p1' : '')
    }
  })
})
