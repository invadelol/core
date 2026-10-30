import { test } from '@japa/runner'
import {
  cellCountsSql,
  laneOpponentsSql,
  lanePairCellsSql,
  lanePairs,
  lanePairsSql,
  opponentsOf,
  roleCellsSql,
  summaryCellsSql,
  totalsCellsSql,
  type Filter,
  type RoleStat,
} from '#services/champion_stats'
import { matchupReport } from '#services/matchup_stats'

const FILTER: Filter = { patch: '16.21', bracket: 'all', region: null }
const PATCHES = [
  { patch: '16.21', games: 2_700_000 },
  { patch: '16.20', games: 1_000_000 },
]

const stat = (games: number, win: number): RoleStat => ({
  champion: 103,
  position: 'MIDDLE',
  games,
  win,
  pick: 0.1,
  ban: 0.05,
  roleShare: 0.9,
  tier: 1,
  rank: 4,
  level: 3,
})

test.group('Matchup stats', () => {
  test('reads every lane pair of the crawled games in one pass', ({ assert }) => {
    const sql = lanePairsSql({ patch: '16.20', bracket: 'emerald_plus', region: 'euw' })
    assert.include(sql, 'FROM match_lineups FINAL')
    assert.include(sql, "seed_tier IN ('EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER')")
    assert.include(sql, "platform IN ('EUW1')")
    // The other team's player in the same position.
    assert.include(sql, 'x.3 = a.3 AND x.2 != a.2')
    assert.include(sql, "join_algorithm = 'full_sorting_merge'")
  })

  test('counts each patch per seed tier and platform, one platform of pairs at a time', ({
    assert,
  }) => {
    const pairs = lanePairCellsSql()
    assert.include(pairs, 'FROM match_lineups FINAL')
    assert.include(pairs, 'FROM match_seed FINAL')
    // Every table read by the platform's game ids.
    assert.equal(pairs.match(/startsWith\(match_id, \{prefix:String\}\)/g)?.length, 2)
    assert.include(pairs, 'platform = {platform:String}')
    assert.include(pairs, 'GROUP BY s.seed_tier, s.platform, a.3, a.4, b.4')
    assert.include(roleCellsSql(), 'FROM participant_items FINAL')
    assert.include(
      roleCellsSql(),
      'GROUP BY s.seed_tier, s.platform, p.team_position, p.champion_id'
    )
    // The cell's games under champion 0, then the bans.
    assert.include(cellCountsSql(), 'toUInt16(0), toUInt32(count())')
    assert.include(cellCountsSql(), 'arrayDistinct(arrayConcat(t1_bans, t2_bans))')
  })

  test('reads a filter as a sum of its cells', ({ assert }) => {
    const all = summaryCellsSql({ patch: '16.21', bracket: 'all', region: null })
    assert.notInclude(all, 'seed_tier IN')
    assert.notInclude(all, 'platform IN')
    const narrow: Filter = { patch: '16.21', bracket: 'master_plus', region: 'kr' }
    for (const sql of [summaryCellsSql(narrow), totalsCellsSql(narrow), laneOpponentsSql(narrow)]) {
      assert.include(sql, "seed_tier IN ('MASTER','GRANDMASTER','CHALLENGER')")
      assert.include(sql, "platform IN ('KR')")
      assert.include(sql, 'patch = {patch:String}')
    }
    assert.include(
      laneOpponentsSql(narrow),
      'position = {position:String} AND champion = {champion:UInt16}'
    )
    assert.include(totalsCellsSql(narrow), "if(champion = 0, 'games', 'ban')")
  })

  test('keeps each champion-role opponents as one flat list', ({ assert }) => {
    const pairs = lanePairs([
      ['MIDDLE', 103, 157, 400, 210],
      ['MIDDLE', 103, 777, 300, 140],
      ['MIDDLE', 157, 103, 400, 190],
      ['TOP', 103, 86, 20, 9],
    ])
    assert.deepEqual(pairs['MIDDLE:103'], [157, 400, 210, 777, 300, 140])
    assert.deepEqual(opponentsOf(pairs, 103, 'MIDDLE'), [
      [157, 400, 210],
      [777, 300, 140],
    ])
    assert.deepEqual(opponentsOf(pairs, 103, 'UTILITY'), [])
  })

  test('measures every opponent against the tier list record', ({ assert }) => {
    const report = matchupReport(
      FILTER,
      103,
      'MIDDLE',
      [
        [777, 300, 140],
        [157, 400, 210],
        [8, 0, 0],
      ],
      stat(800, 0.5),
      PATCHES
    )
    assert.equal(report.games, 800)
    assert.equal(report.win, 0.5)
    assert.equal(report.tier, 1)
    assert.deepEqual(report.patches, PATCHES)
    // Most played first; an opponent without a game is left out.
    assert.deepEqual(
      report.matchups.map((m) => m.champion),
      [157, 777]
    )
    const [ahead, behind] = report.matchups
    assert.equal(ahead.win, 0.525)
    assert.equal(ahead.delta, 0.025)
    assert.equal(ahead.share, round4(400 / 700))
    assert.equal(behind.delta, round4(140 / 300 - 0.5))
    assert.isAtLeast(ahead.level, 0)
  })

  test('falls back on the lane games off the listed roles', ({ assert }) => {
    const report = matchupReport(FILTER, 103, 'TOP', [[86, 60, 33]], null, PATCHES)
    assert.equal(report.games, 60)
    assert.equal(report.win, 0.55)
    assert.isNull(report.pick)
    assert.isNull(report.tier)
    assert.equal(report.matchups[0].delta, 0)
    assert.equal(report.matchups[0].share, 1)
  })

  test('answers an unknown pick with no opponent', ({ assert }) => {
    const report = matchupReport(FILTER, 103, 'UTILITY', [], null, PATCHES)
    assert.equal(report.games, 0)
    assert.deepEqual(report.matchups, [])
  })
})

const round4 = (n: number) => Math.round(n * 1e4) / 1e4
