import { test } from '@japa/runner'
import { starterLp, teamLp } from '#services/team_lp'

test.group('Team average LP', () => {
  test('counts Master and above at their LP, Diamond below Master 0 LP', ({ assert }) => {
    assert.equal(starterLp('CHALLENGER', null, 1534), 1534)
    assert.equal(starterLp('GRANDMASTER', 1, 812), 812)
    assert.equal(starterLp('MASTER', null, 0), 0)
    // 100 LP per division under Master, plus the division's LP.
    assert.equal(starterLp('DIAMOND', 1, 50), -50)
    assert.equal(starterLp('DIAMOND', 1, 0), -100)
    assert.equal(starterLp('DIAMOND', 'II', 0), -200)
    assert.equal(starterLp('DIAMOND', 4, 0), -400)
    assert.equal(starterLp('DIAMOND', 4, 99), -301)
  })

  test('leaves out a starter below Diamond IV or unranked', ({ assert }) => {
    assert.isNull(starterLp('EMERALD', 1, 99))
    assert.isNull(starterLp('GOLD', 2, 10))
    assert.isNull(starterLp(null, null, null))
    assert.isNull(starterLp('DIAMOND', null, 20))
  })

  test('averages the starters it counts and says how many', ({ assert }) => {
    // Three in Master and above, Diamond I and Diamond II at 0 LP.
    assert.deepEqual(teamLp([2628, 3515, 3006, -100, -200]), { lp: 1770, counted: 5 })
    assert.deepEqual(teamLp([1000, null, 500, null]), { lp: 750, counted: 2 })
    assert.deepEqual(teamLp([null, null]), { lp: null, counted: 0 })
    assert.deepEqual(teamLp([-50, -150]), { lp: -100, counted: 2 })
  })
})
