import { test } from '@japa/runner'
import { leagueData, proPage, teamPage } from '../../inertia/lib/pro_pages.js'

/**
 * The pro pages read their props through these: an answer cached by an older release (no builds,
 * no pools, no league), or a field left out, must draw as empty instead of throwing.
 */
test.group('Pro page props', () => {
  test('a pro cached by an older release reads as a complete page', ({ assert }) => {
    const old = {
      slug: 'someone',
      name: 'Someone',
      role: 'MID',
      accounts: [],
      teams: [],
      games: [],
      record: { games: 3, wins: 2, kills: 1, deaths: 1, assists: 1 },
      champions: [],
      roles: [],
      items: [],
    }
    const p = proPage(old as any)
    assert.deepEqual(p.builds, [])
    assert.isNull(p.league)
    assert.isNull(p.team)
    assert.deepEqual(p.socials, {})
    assert.equal(p.record.games, 3)
    assert.equal(proPage(undefined).record.games, 0)
    assert.deepEqual(proPage({ builds: [{ champion: 1 }] } as any).builds[0].form, [])
  })

  test('a team without pools, league or place reads as a complete page', ({ assert }) => {
    const t = teamPage({ id: 'x', slug: 'x', name: 'X', roster: [{ name: 'A' }] } as any)
    assert.deepEqual(t.pools, {})
    assert.deepEqual(t.games, [])
    assert.isNull(t.league)
    assert.isNull(t.lp)
    assert.isNull(t.place)
    assert.isNull(t.roster[0].now)
    assert.equal(t.record.wins, 0)
  })

  test('a league view without its league is no league view', ({ assert }) => {
    assert.isNull(leagueData(undefined))
    assert.isNull(leagueData({ teams: [] } as any))
    const d = leagueData({ league: { slug: 'lec' }, players: [{ slug: 'a' }] } as any)!
    assert.deepEqual(d.teams, [])
    assert.deepEqual(d.players[0].champions, [])
    assert.equal(d.counts.accounts, 0)
  })
})
