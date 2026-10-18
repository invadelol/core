import { test } from '@japa/runner'
import { queueName, UNKNOWN_QUEUE } from '@invadelol/ui/logic'
import { buildMatchRow, buildParticipantRows } from '#utils/clickhouse'

test.group('Queue identity', () => {
  test('missing or invalid metadata stays unknown in match and participant rows', ({ assert }) => {
    for (const queueId of [undefined, null, '', ' ', false, -1, 1.5, NaN, 65536]) {
      const info = { queueId, participants: [{ puuid: 'player' }] }
      const match = buildMatchRow('EUW1_1', 'EUW1', 1, info)
      const players = buildParticipantRows('EUW1_1', 'EUW1', 1, info)
      assert.equal(match.queue_id, UNKNOWN_QUEUE)
      assert.equal(players[0].queue_id, UNKNOWN_QUEUE)
      assert.equal(queueName(match.queue_id), 'Unknown queue')
    }
  })

  test('current and historical ranked queues survive ingestion and display', ({ assert }) => {
    for (const queueId of [4, 6, 42, 410, 420, 440]) {
      const match = buildMatchRow('EUW1_1', 'EUW1', 1, { queueId })
      assert.equal(match.queue_id, queueId)
      assert.notEqual(queueName(match.queue_id), 'Custom')
    }
    const custom = buildMatchRow('EUW1_1', 'EUW1', 1, { queueId: 0 })
    assert.equal(custom.queue_id, 0)
    assert.equal(queueName(custom.queue_id), 'Custom')
  })
})
