import { test } from '@japa/runner'
import type { RoleStat, Summary } from '#services/champion_stats'
import { tierListReport } from '#services/tier_list_stats'

const PATCHES = [
  { patch: '16.21', games: 2_700_000 },
  { patch: '16.20', games: 1_000_000 },
]

const row = (champion: number, position: RoleStat['position'], rank: number | null): RoleStat => ({
  champion,
  position,
  games: rank ? 5000 : 40,
  win: 0.51,
  pick: 0.02,
  ban: 0.01,
  roleShare: 0.8,
  tier: rank ? 2 : null,
  rank,
  level: rank ? 3 : 0,
})

const summary = (patch: string, roles: RoleStat[]): Summary => ({
  patch,
  bracket: 'emerald_plus',
  region: 'euw',
  games: 100_000,
  roles,
  ranked: { TOP: 0, JUNGLE: 0, MIDDLE: 0, BOTTOM: 0, UTILITY: 0 },
})

test.group('Tier list stats', () => {
  test('each row carries its place in the same role on the patch before', ({ assert }) => {
    const report = tierListReport(
      summary('16.21', [row(103, 'MIDDLE', 1), row(103, 'UTILITY', 7), row(266, 'TOP', 3)]),
      summary('16.20', [row(103, 'MIDDLE', 4), row(103, 'TOP', 2), row(266, 'TOP', null)]),
      PATCHES
    )
    assert.equal(report.patch, '16.21')
    assert.equal(report.bracket, 'emerald_plus')
    assert.equal(report.region, 'euw')
    assert.equal(report.games, 100_000)
    assert.equal(report.previousPatch, '16.20')
    assert.deepEqual(report.patches, PATCHES)
    assert.deepEqual(
      report.roles.map((r) => [r.champion, r.position, r.rank, r.previousRank]),
      [
        [103, 'MIDDLE', 1, 4],
        // Not played in that role then, or not ranked in it: no place.
        [103, 'UTILITY', 7, null],
        [266, 'TOP', 3, null],
      ]
    )
    // The row's own figures are kept as the website's tier list counts them.
    assert.include(report.roles[0], { games: 5000, win: 0.51, pick: 0.02, ban: 0.01, tier: 2 })
  })

  test('the oldest patch of the menu has no places before it', ({ assert }) => {
    const report = tierListReport(summary('16.20', [row(103, 'MIDDLE', 1)]), null, PATCHES)
    assert.isNull(report.previousPatch)
    assert.isNull(report.roles[0].previousRank)
  })
})
