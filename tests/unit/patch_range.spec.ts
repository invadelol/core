import { test } from '@japa/runner'
import {
  laneOpponentsSql,
  lanePairsSql,
  seedGamesSql,
  summaryByRankCellsSql,
  summaryByRankSql,
  summaryCellsSql,
  totalsCellsSql,
  totalsSql,
  type Filter,
} from '#services/champion_stats'
import { gamesSql } from '#services/ranked_stats'
import { buildRowsSql } from '#services/build_stats'
import {
  MAX_RANGE,
  PATCH_PATTERN,
  patchOptions,
  patchRange,
  patchText,
  patchValue,
  previousRange,
} from '../../inertia/lib/patches.js'

const OFFERED = ['16.22', '16.21', '16.20', '16.19', '16.18', '16.17', '16.16']
const RANGE: Filter = {
  patch: '16.20-16.22',
  patches: ['16.22', '16.21', '16.20'],
  bracket: 'emerald_plus',
  region: 'euw',
}

test.group('Patch ranges', () => {
  test('reads one patch or a range of offered patches, newest first', ({ assert }) => {
    assert.deepEqual(patchRange('16.22', OFFERED), ['16.22'])
    assert.deepEqual(patchRange('16.20-16.22', OFFERED), ['16.22', '16.21', '16.20'])
    assert.deepEqual(patchRange('16.22-16.20', OFFERED), ['16.22', '16.21', '16.20'])
    assert.deepEqual(patchRange(' 16.21-16.21 ', OFFERED), ['16.21'])
    // Not offered, not a patch, or too wide: nothing (the caller reads the default).
    assert.isNull(patchRange('16.23', OFFERED))
    assert.isNull(patchRange('16.15-16.22', OFFERED))
    assert.isNull(patchRange('16.20,16.21', OFFERED))
    assert.isNull(patchRange("16.20' OR 1", OFFERED))
    assert.isNull(patchRange(undefined, OFFERED))
    assert.isNull(patchRange('16.16-16.22', OFFERED), `over ${MAX_RANGE} patches`)
    assert.lengthOf(patchRange('16.18-16.22', OFFERED)!, MAX_RANGE)
  })

  test('writes a range oldest first and says it in a sentence', ({ assert }) => {
    assert.equal(patchValue(['16.22']), '16.22')
    assert.equal(patchValue(['16.22', '16.21', '16.20']), '16.20-16.22')
    assert.equal(patchText('16.22'), 'patch 16.22')
    assert.equal(patchText('16.20-16.22'), 'patches 16.20–16.22')
    assert.isTrue(PATCH_PATTERN.test('16.20-16.22'))
    assert.isTrue(PATCH_PATTERN.test('16.9'))
    assert.isFalse(PATCH_PATTERN.test('16.20-'))
  })

  test('compares a range with as many patches just before it', ({ assert }) => {
    assert.deepEqual(previousRange(['16.22'], OFFERED), ['16.21'])
    assert.deepEqual(previousRange(['16.22', '16.21', '16.20'], OFFERED), [
      '16.19',
      '16.18',
      '16.17',
    ])
    assert.isNull(previousRange(['16.18', '16.17', '16.16'], OFFERED))
    assert.isNull(previousRange(['16.16'], OFFERED))
  })

  test('the menu offers each patch, then the newest two and three', ({ assert }) => {
    const options = patchOptions(['16.22', '16.21', '16.20'])
    assert.deepEqual(
      options.map((o) => o.value),
      ['16.22', '16.21', '16.20', '16.21-16.22', '16.20-16.22']
    )
    assert.equal(options[3].label, 'Last 2 patches')
    assert.equal(options[4].label, 'Last 3 patches')
    // Too few patches for a range: none offered.
    assert.lengthOf(patchOptions(['16.22']), 1)
    // A linked range the menu does not list is kept as an option.
    const linked = patchOptions(['16.22', '16.21', '16.20'], '16.20-16.21')
    assert.equal(linked[linked.length - 1].label, 'Patches 16.20–16.21')
  })

  test('every statistic of a filter reads its patches as one set', ({ assert }) => {
    const queries = [
      seedGamesSql(RANGE),
      summaryCellsSql(RANGE),
      totalsCellsSql(RANGE),
      totalsSql(RANGE),
      laneOpponentsSql(RANGE),
      lanePairsSql(RANGE),
      summaryByRankSql(RANGE),
      summaryByRankCellsSql(RANGE),
      gamesSql('emerald_plus', { champion: 1, position: 'TOP' }, 'euw'),
      gamesSql('all', null),
      buildRowsSql(
        'emerald',
        { champion: 1, position: 'TOP' },
        {
          legendary: [],
          boots: [],
          trinkets: [],
          gold: {},
        }
      ),
    ]
    for (const sql of queries) {
      assert.include(sql, 'patch IN {patches:Array(String)}')
      assert.notInclude(sql, '{patch:String}')
    }
  })

  test('the by-rank view reads the counted cells by rank group', ({ assert }) => {
    const sql = summaryByRankCellsSql(RANGE)
    assert.include(sql, 'FROM stats_champion_roles')
    assert.include(sql, 'FROM stats_cell_counts')
    assert.include(
      sql,
      "WHEN seed_tier IN ('MASTER','GRANDMASTER','CHALLENGER') THEN 'master_plus'"
    )
    assert.include(sql, "platform IN ('EUW1')")
    assert.notInclude(sql, 'participant_items')
  })
})
