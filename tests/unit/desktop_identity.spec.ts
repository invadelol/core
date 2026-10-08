import { test } from '@japa/runner'
import { resolveIdentities, type IdentityInput } from '#services/desktop/identity_service'

const raw = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const api = (n: number) => `API${n}`.padEnd(78, '_')

const identities: IdentityInput[] = [1, 2, 3].map((n) => ({
  participantId: n,
  rawPuuid: raw(n),
  gameName: `Player ${n}`,
  tagLine: 'EUW',
}))
const player = (n: number, platform = 'EUW1') => ({
  puuid: api(n),
  platform,
  gameName: `player ${n}`,
  tagLine: 'euw',
})

test.group('Desktop identity mapping (§3)', (group) => {
  group.tap((t) => t.tags(['@desktop']))
  test('a known alias wins over a stored player with the same Riot ID', ({ assert }) => {
    const result = resolveIdentities(identities, 'EUW1', {
      aliases: [{ rawPuuid: raw(1), puuid: api(11), status: 'verified' }],
      players: [player(1)],
      claims: [],
    })
    assert.equal(result.puuids.get(raw(1)), api(11))
    assert.equal(result.via.get(raw(1)), 'alias')
    assert.notInclude(
      result.learned.map((l) => l.rawPuuid),
      raw(1)
    )
  })

  test('then the stored player with the Riot ID at game time, learned as asserted', ({
    assert,
  }) => {
    const result = resolveIdentities(identities, 'EUW1', {
      aliases: [],
      players: [player(2)],
      claims: [],
    })
    // Riot IDs are compared case-insensitively, as citext stores them.
    assert.equal(result.puuids.get(raw(2)), api(2))
    assert.equal(result.via.get(raw(2)), 'riot_player')
    assert.deepEqual(result.learned, [
      { rawPuuid: raw(2), puuid: api(2), status: 'asserted', gameName: 'Player 2', tagLine: 'EUW' },
    ])
    assert.deepEqual(result.unmapped, [raw(1), raw(3)])
  })

  test('a namesake on another platform is someone else', ({ assert }) => {
    const result = resolveIdentities(identities, 'EUW1', {
      aliases: [],
      players: [player(2, 'NA1')],
      claims: [],
    })
    assert.isFalse(result.puuids.has(raw(2)))
  })

  test('a disputed raw PUUID waits for Riot instead of being re-asserted by name', ({ assert }) => {
    const result = resolveIdentities(identities, 'EUW1', {
      aliases: [{ rawPuuid: raw(1), puuid: api(1), status: 'conflict' }],
      players: [player(1)],
      claims: [],
    })
    assert.include(result.unmapped, raw(1))
  })

  test('two participants landing on one account are both in conflict', ({ assert }) => {
    const result = resolveIdentities(identities, 'EUW1', {
      aliases: [
        { rawPuuid: raw(1), puuid: api(9), status: 'asserted' },
        { rawPuuid: raw(2), puuid: api(9), status: 'asserted' },
      ],
      players: [],
      claims: [],
    })
    assert.sameMembers(result.conflicts, [raw(1), raw(2)])
    assert.sameMembers(result.unmapped, [raw(1), raw(2), raw(3)])
  })

  test('another raw PUUID claiming the same account: both conflict unless Riot settled it', ({
    assert,
  }) => {
    const other = '00000000-0000-4000-8000-999999999999'
    const asserted = resolveIdentities(identities, 'EUW1', {
      aliases: [],
      players: [player(3)],
      claims: [{ rawPuuid: other, puuid: api(3), status: 'asserted' }],
    })
    assert.sameMembers(asserted.conflicts, [raw(3), other])
    assert.isFalse(asserted.puuids.has(raw(3)))
    assert.lengthOf(asserted.learned, 0)

    // Riot already tied the account to the other raw PUUID: only this claim is wrong.
    const verified = resolveIdentities(identities, 'EUW1', {
      aliases: [],
      players: [player(3)],
      claims: [{ rawPuuid: other, puuid: api(3), status: 'verified' }],
    })
    assert.deepEqual(verified.conflicts, [raw(3)])

    // And a verified alias of ours outranks someone else's assertion.
    const ours = resolveIdentities(identities, 'EUW1', {
      aliases: [{ rawPuuid: raw(3), puuid: api(3), status: 'verified' }],
      players: [],
      claims: [{ rawPuuid: other, puuid: api(3), status: 'asserted' }],
    })
    assert.deepEqual(ours.conflicts, [other])
    assert.equal(ours.puuids.get(raw(3)), api(3))
  })
})
