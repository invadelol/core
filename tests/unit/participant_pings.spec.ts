import { test } from '@japa/runner'
import { buildParticipantRows } from '#utils/clickhouse'

function assistPings(participant: Record<string, unknown>) {
  const info = { participants: [{ participantId: 1, puuid: 'puuid-1', ...participant }] }
  return buildParticipantRows('EUW1_1', 'EUW1', 0, info)[0].assist_pings
}

test.group('participant pings', () => {
  test('reads assist pings from Riot assistMePings', ({ assert }) => {
    assert.equal(assistPings({ assistMePings: 3 }), 3)
  })

  test('falls back to assistPings in older payloads', ({ assert }) => {
    assert.equal(assistPings({ assistPings: 2 }), 2)
  })

  test('is zero when neither field is present', ({ assert }) => {
    assert.equal(assistPings({}), 0)
  })
})
