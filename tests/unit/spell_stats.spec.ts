import { test } from '@japa/runner'
import { spellRowsSql, summarizeSpells } from '#services/spell_stats'

const FLASH = 4
const IGNITE = 14
const TELEPORT = 12
const SMITE = 11

test.group('Spell stats', () => {
  test('a pair in either order is one choice, shown in the order most played', ({ assert }) => {
    const stats = summarizeSpells([
      // Flash + Ignite: 600 with Flash on D, 300 with Ignite on D.
      [FLASH, IGNITE, 900, 460, 600, 600, 300],
      // Flash + Teleport: mostly Teleport on D.
      [FLASH, TELEPORT, 100, 48, 30, 30, 70],
    ])
    assert.equal(stats.games, 1000)
    assert.equal(stats.win, 0.508)
    assert.deepEqual(
      stats.pairs.map((p) => [p.spells, p.share]),
      [
        [[FLASH, IGNITE], 0.9],
        [[TELEPORT, FLASH], 0.1],
      ]
    )
    assert.equal(stats.flashOnD, 0.63)
    assert.equal(stats.pairs[0].level, 2)
  })

  test('two pairs played as often are a tie, capped at level 2', ({ assert }) => {
    const stats = summarizeSpells([
      [FLASH, SMITE, 1700, 850, 900, 900, 800],
      [IGNITE, SMITE, 1650, 825, 900, 0, 0],
    ])
    assert.deepEqual(
      stats.pairs.map((p) => [p.level, p.tie]),
      [
        [2, true],
        [3, false],
      ]
    )
  })

  test('no Flash, no Flash slot; no games, no pairs', ({ assert }) => {
    assert.isNull(summarizeSpells([[IGNITE, TELEPORT, 50, 25, 50, 0, 0]]).flashOnD)
    assert.deepEqual(summarizeSpells([]), { games: 0, win: 0, flashOnD: null, pairs: [] })
  })

  test('the query reads one champion, or every one with its role', ({ assert }) => {
    assert.include(
      spellRowsSql('all', { champion: 1, position: 'UTILITY' }),
      'champion_id = {champion:UInt16}'
    )
    assert.include(spellRowsSql('gold', null), "seed_tier IN ('GOLD')")
    assert.include(spellRowsSql('gold', null), 'SELECT champion_id, team_position, least')
  })

  test("a bracket's games are looked up among the champion's own", ({ assert }) => {
    const one = spellRowsSql('emerald_plus', { champion: 1, position: 'UTILITY' })
    assert.include(one, 'FROM match_seed WHERE patch = {patch:String} AND seed_tier IN (')
    assert.include(
      one,
      'AND match_id IN (SELECT match_id FROM participants WHERE queue_id = 420 AND champion_id = {champion:UInt16} AND team_position = {position:String} AND game_start_ms >= {patchStart:UInt64})'
    )
    // All ranks: every ranked game of the patch, still only among the champion's.
    const all = spellRowsSql('all', { champion: 1, position: 'UTILITY' })
    assert.include(
      all,
      'FROM matches WHERE queue_id = 420 AND patch = {patch:String} AND match_id IN (SELECT match_id FROM participants'
    )
    assert.notInclude(all, 'match_seed')
    // Every champion at once: the bracket's games themselves.
    assert.notInclude(spellRowsSql('gold', null), 'FROM participants WHERE')
  })
})
