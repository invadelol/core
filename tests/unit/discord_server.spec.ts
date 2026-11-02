import { test } from '@japa/runner'
import { parseInvite } from '#services/discord_server'

test.group('Discord server counts', () => {
  test('reads the members and who is online out of an invite', ({ assert }) => {
    assert.deepEqual(
      parseInvite({ approximate_member_count: 179, approximate_presence_count: 67 }),
      { members: 179, online: 67 }
    )
  })

  test('never shows more people online than members', ({ assert }) => {
    assert.deepEqual(
      parseInvite({ approximate_member_count: 10, approximate_presence_count: 12 }),
      { members: 10, online: 10 }
    )
  })

  test('has no counts when Discord leaves them out', ({ assert }) => {
    assert.isNull(parseInvite({ code: 'abc' }))
    assert.isNull(parseInvite({ approximate_member_count: 0, approximate_presence_count: 0 }))
    assert.isNull(parseInvite(null))
  })
})
