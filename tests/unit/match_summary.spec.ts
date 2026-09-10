import { test } from '@japa/runner'
import clickhouse from 'adonisjs-clickhouse/services/main'
import matchRepository from '#services/analytics/match_repository'

/**
 * Stands in for ClickHouse.
 *
 * Rows are returned positionally, in the order the query's own SELECT clause
 * names them — the same contract `JSONCompactEachRow` provides. A query that
 * asked for a column it cannot read, or read a column it did not ask for,
 * fails here rather than in production.
 */
/** Drops every parenthesised subquery, leaving only the outermost statement. */
function outermost(sql: string) {
  let out = ''
  let depth = 0
  for (const character of sql) {
    if (character === '(') depth++
    else if (character === ')') depth--
    else if (depth === 0) out += character
  }
  return out
}

function fakeClickhouse(source: Record<string, unknown>) {
  const queries: string[] = []

  const query = (async ({ query: sql, format }: { query: string; format?: string }) => {
    queries.push(sql)
    if (format !== 'JSONCompactEachRow') {
      throw new Error(`expected positional rows, got ${format}`)
    }

    const outer = outermost(sql).match(/SELECT\s+([\s\S]*?)\s+FROM\s+(\w+)/)
    if (!outer) throw new Error(`could not read the outer SELECT of:\n${sql}`)

    const columns = outer[1]
      .split(',')
      .map((column) => column.trim())
      .filter(Boolean)

    const table = outer[2]
    const row = columns.map((column) => {
      if (table === 'matches') {
        const matches: Record<string, unknown> = {
          match_id: 'EUW1_1',
          game_start_ms: 1000,
          duration_sec: 1800,
          queue_id: 420,
          t1_win: 1,
        }
        return matches[column] ?? 0
      }
      if (!(column in source)) throw new Error(`unknown column selected: ${column}`)
      return source[column]
    })

    return { json: async () => [row] }
  }) as typeof clickhouse.query

  return { query, queries }
}

const participant = {
  match_id: 'EUW1_1',
  puuid: 'player',
  riot_id_game_name: 'Alice',
  riot_id_tag_line: 'EUW',
  champion_id: 1,
  team_id: 100,
  win: 1,
  kills: 5,
  deaths: 2,
  assists: 10,
  total_cs: 200,
  summoner_level: 100,
  champ_level: 18,
  item0: 1001,
  item1: 2003,
  item2: 0,
  item3: 0,
  item4: 0,
  item5: 0,
  item6: 0,
  spell1: 4,
  spell2: 14,
  primary_style: 8000,
  secondary_style: 8100,
  vision_score: 40,
  dmg_taken: 12000,
  dmg_to_champ: 20000,
  team_position: 'TOP',
  gold_earned: 14000,
  physical_dmg_to_champ: 16000,
  magic_dmg_to_champ: 3000,
  true_dmg_to_champ: 1000,
  wards_placed: 12,
  wards_killed: 3,
  dmg_to_turrets: 1000,
  dmg_to_objectives: 6000,
  physical_dmg_dealt: 100000,
  magic_dmg_dealt: 10000,
  true_dmg_dealt: 2000,
  neutral_minions_killed: 10,
  vision_wards_bought: 3,
  all_in_pings: 1,
  assist_pings: 2,
  command_pings: 3,
  danger_pings: 4,
  enemy_missing_pings: 5,
  enemy_vision_pings: 6,
  get_back_pings: 7,
  need_vision_pings: 8,
  on_my_way_pings: 9,
  push_pings: 10,
  vision_cleared_pings: 11,
  bait_pings: 12,
  hold_pings: 13,
}

test('summary matches retain scoreboard data while omitting analysis-only columns', async ({
  assert,
}) => {
  const original = clickhouse.query
  const fake = fakeClickhouse(participant)
  clickhouse.query = fake.query

  try {
    const [full] = await matchRepository.getByPuuid('player', { count: 15 })
    const [summary] = await matchRepository.getByPuuid('player', { count: 15, view: 'summary' })
    const serialized = JSON.parse(JSON.stringify(summary))
    const player = serialized.participants[0]

    for (const key of [
      'puuid',
      'gameName',
      'tagLine',
      'championId',
      'teamId',
      'win',
      'kills',
      'deaths',
      'assists',
      'cs',
      'champLevel',
      'items',
      'spells',
      'perks',
      'visionScore',
      'damageDealt',
      'totalDamageDealtToChampions',
      'position',
      'goldEarned',
    ]) {
      assert.deepEqual(player[key], full.participants[0][key], key)
    }

    assert.equal(player.totalDamageDealtToChampions, 20000)
    assert.notProperty(player, 'allInPings')
    assert.notProperty(player, 'physicalDamageDealt')
    assert.equal(full.participants[0].allInPings, 1)

    // The analysis-only columns must not even be read for a summary.
    const summaryParticipantRead = fake.queries.at(-1)!
    assert.include(summaryParticipantRead, 'riot_id_game_name')
    assert.notInclude(summaryParticipantRead, 'all_in_pings')
    assert.isBelow(JSON.stringify(summary).length, JSON.stringify(full).length * 0.7)
  } finally {
    clickhouse.query = original
  }
})

test('a match list is read in one concurrent step, not a chain of round trips', async ({
  assert,
}) => {
  const original = clickhouse.query
  const fake = fakeClickhouse(participant)
  clickhouse.query = fake.query

  try {
    await matchRepository.getByPuuid('player', { count: 15, view: 'summary' })

    // Metadata and participants only: the window of match ids is inlined into
    // both, so no read waits on another read's result before it can start.
    assert.lengthOf(fake.queries, 2)
    for (const sql of fake.queries) {
      assert.include(sql, 'WITH match_window AS')
      assert.include(sql, 'match_id IN (SELECT match_id FROM match_window)')
      // A join here would stream the whole participants table.
      assert.notInclude(sql.toUpperCase(), ' JOIN ')
    }
  } finally {
    clickhouse.query = original
  }
})
