import { test } from '@japa/runner'
import { Visibility } from '#services/moderation/moderation'

const none = { bans: false, tags: false, removals: false }

test.group('Moderation visibility', () => {
  test('nothing to read, nothing hidden: every condition is true', ({ assert }) => {
    const visible = new Visibility(none)
    assert.isFalse(visible.active)
    assert.equal(visible.person('u.id'), 'true')
    assert.equal(visible.clip('c.id'), 'true')
    assert.equal(visible.comment('cc.id::text'), 'true')
    assert.equal(visible.thread('cc'), 'true')
  })

  test('bans hide people, removals hide clips and comments, each from its own view', ({
    assert,
  }) => {
    const bans = new Visibility({ ...none, bans: true })
    assert.include(bans.person('u.id'), 'admin.active_ban mod_ban WHERE mod_ban.user_id = u.id')
    assert.equal(bans.clip('c.id'), 'true')

    const removals = new Visibility({ ...none, removals: true })
    assert.equal(removals.person('u.id'), 'true')
    assert.include(removals.clip('c.id'), `mod_rm.kind = 'clip' AND mod_rm.target_id = c.id`)
    assert.include(
      removals.comment('cc.id::text'),
      `mod_rm.kind = 'comment' AND mod_rm.target_id = cc.id::text`
    )
  })

  test('a reply shows only while the comment it answers shows', ({ assert }) => {
    const thread = new Visibility({ bans: true, tags: true, removals: true }).thread('cc')
    assert.include(thread, 'mod_ban.user_id = cc.user_id')
    assert.include(thread, 'mod_rm.target_id = cc.id::text')
    assert.include(thread, 'mod_parent.id = cc.parent_id')
    assert.include(thread, 'mod_ban.user_id = mod_parent.user_id')
  })
})
