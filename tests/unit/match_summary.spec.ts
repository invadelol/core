import { test } from '@japa/runner'
import clickhouse from 'adonisjs-clickhouse/services/main'
import matchRepository from '#services/analytics/match_repository'

// Model the rows returned by SELECT, so the summary must obtain every field
// needed by a scoreboard from its own projection, without a detail request.
test('summary matches retain scoreboard data while omitting analysis-only columns', async ({
  assert,
}) => {
  const original = clickhouse.query
  const queries: string[] = []
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
  clickhouse.query = (async ({ query }: { query: string }) => {
    queries.push(query)
    let rows: unknown[]
    if (query.includes('SELECT match_id, game_start_ms')) {
      rows = [{ match_id: 'EUW1_1', game_start_ms: 1000 }]
    } else if (query.includes('FROM matches')) {
      rows = [{ matchId: 'EUW1_1', gameStartMs: 1000, duration: 1800, queueId: 420, t1Win: 1 }]
    } else {
      const fields = query
        .split('SELECT')[1]
        .split('FROM')[0]
        .split(',')
        .map((field) => field.trim())
      rows = [
        Object.fromEntries(
          fields.map((field) => [field, participant[field as keyof typeof participant]])
        ),
      ]
    }
    return { json: async () => rows }
  }) as typeof clickhouse.query
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
    assert.isFalse(queries[5].includes('all_in_pings'))
    assert.isBelow(JSON.stringify(summary).length, JSON.stringify(full).length * 0.7)
  } finally {
    clickhouse.query = original
  }
})
