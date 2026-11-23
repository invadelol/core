import { test } from '@japa/runner'
import { handleBase, isHandle } from '#services/accounts/handles'

test.group('Handles', () => {
  test('a Discord name becomes a handle', ({ assert }) => {
    assert.equal(handleBase('Ember'), 'ember')
    assert.equal(handleBase('Briar Signal'), 'briar_signal')
    assert.equal(handleBase('  Zoé  ~~ x '), 'zoe_x')
    assert.equal(handleBase('Ünïcödé.Nàme!'), 'unicode_name')
    assert.equal(handleBase('a'.repeat(40)), 'a'.repeat(24))
    assert.equal(handleBase(`${'a'.repeat(23)}_b`), 'a'.repeat(23))
  })

  test('nothing usable, or a word of the site, gives "player"', ({ assert }) => {
    for (const name of ['🔥🔥', '李小龙', 'x', '__', 'Admin', 'Invade', 'riot games']) {
      assert.equal(handleBase(name), 'player', name)
    }
  })

  test('a handle is 2 to 24 lower case letters, digits and underscores', ({ assert }) => {
    for (const ok of ['ember', 'a1', 'low_tide', 'x'.repeat(24)]) assert.isTrue(isHandle(ok), ok)
    for (const bad of ['E', 'Ember', 'a-b', 'x'.repeat(25), 'admin', '', null]) {
      assert.isFalse(isHandle(bad), String(bad))
    }
  })
})
