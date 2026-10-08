import { test } from '@japa/runner'
import {
  corroborates,
  implausibleJump,
  judgeSnapshot,
  sameRank,
  snapshotHash,
  validatePlayer,
  type PlayerContext,
  type PreviousReport,
  type StoredRank,
} from '#services/desktop/player_rules'
import { MATCH_AUDIT_ONE_IN, PLAYER_AUDIT_ONE_IN, oneIn } from '#services/desktop/sampling'
import type { ObservedRank, PlayerSnapshot } from '#types/desktop'

const NOW = Date.UTC(2026, 9, 8, 12)
const CONTEXT: PlayerContext = {
  now: NOW,
  platform: 'EUW1',
  championIds: new Set([45, 103, 222]),
}

function player(overrides: Record<string, unknown> = {}) {
  return {
    rawPuuid: '5c8a0b1e-1111-4222-8333-444455556666',
    gameName: 'Kesha',
    tagLine: 'EUW',
    profileIconId: 4568,
    summonerLevel: 245,
    privacy: 'PUBLIC',
    self: false,
    context: 'in_game',
    observedAt: NOW - 60_000,
    ranks: [
      {
        queue: 'RANKED_SOLO_5x5',
        tier: 'EMERALD',
        division: 'II',
        lp: 64,
        wins: 61,
        losses: null,
        provisional: false,
      },
    ],
    mastery: [
      { championId: 45, championLevel: 38, championPoints: 402115, lastPlayTime: NOW - 1e6 },
    ],
    ...overrides,
  }
}

function reason(input: unknown, context = CONTEXT) {
  const verdict = validatePlayer(input, context)
  return verdict.ok ? null : verdict.reason
}

const rank = (overrides: Partial<ObservedRank> = {}): ObservedRank => ({
  queue: 'RANKED_SOLO_5x5',
  tier: 'EMERALD',
  division: 'II',
  lp: 64,
  wins: 61,
  losses: null,
  ...overrides,
})

test.group('Desktop player snapshots: validation (§6.2)', (group) => {
  group.tap((t) => t.tags(['@desktop']))

  test('accepts the documented example and normalises it', ({ assert }) => {
    const verdict = validatePlayer(
      player({ rawPuuid: '5C8A0B1E-1111-4222-8333-444455556666' }),
      CONTEXT
    )
    assert.isTrue(verdict.ok)
    if (!verdict.ok) return
    assert.equal(verdict.player.rawPuuid, '5c8a0b1e-1111-4222-8333-444455556666')
    assert.equal(verdict.player.platform, 'EUW1')
    assert.deepEqual(verdict.player.ranks, [rank()])
    assert.lengthOf(verdict.player.mastery!, 1)
  })

  test('accepts what was not read, and apex tiers with division I or none', ({ assert }) => {
    assert.isNull(reason(player({ ranks: null, mastery: null, profileIconId: null })))
    assert.isNull(reason(player({ ranks: [], summonerLevel: undefined, privacy: undefined })))
    for (const division of ['I', '', null]) {
      const verdict = validatePlayer(
        player({
          ranks: [{ queue: 'RANKED_FLEX_SR', tier: 'MASTER', division, lp: 412, wins: 9 }],
        }),
        CONTEXT
      )
      assert.isTrue(verdict.ok)
      if (verdict.ok) assert.equal(verdict.player.ranks![0].division, 'I')
    }
  })

  test('rejects malformed identities', ({ assert }) => {
    assert.equal(reason(player({ rawPuuid: 'not-a-uuid' })), 'rawPuuid is not a UUID')
    assert.equal(reason(player({ gameName: '' })), 'gameName is not a valid Riot ID name')
    assert.equal(
      reason(player({ gameName: 'x'.repeat(17) })),
      'gameName is not a valid Riot ID name'
    )
    assert.equal(reason(player({ gameName: 'Kesha#EUW' })), 'gameName is not a valid Riot ID name')
    assert.equal(reason(player({ tagLine: 'TOOLONG' })), 'tagLine is not a valid Riot ID tag')
    // Characters, not UTF-16 units: a 16-character Korean name is fine.
    assert.isNull(reason(player({ gameName: '가'.repeat(16) })))
    assert.equal(reason(player(), { ...CONTEXT, platform: null }), 'platform is not supported')
  })

  test('rejects observations outside the last 24 hours', ({ assert }) => {
    const message = 'observedAt is not within the last 24 hours'
    assert.equal(reason(player({ observedAt: NOW - 25 * 3600_000 })), message)
    assert.equal(reason(player({ observedAt: NOW + 6 * 60_000 })), message)
    assert.equal(reason(player({ observedAt: String(NOW) })), message)
    assert.isNull(reason(player({ observedAt: NOW + 4 * 60_000 })))
  })

  test('rejects out-of-range profile fields', ({ assert }) => {
    assert.equal(reason(player({ summonerLevel: 0 })), 'summonerLevel is out of range')
    assert.equal(reason(player({ summonerLevel: 5001 })), 'summonerLevel is out of range')
    assert.equal(reason(player({ profileIconId: 100_001 })), 'profileIconId is out of range')
    assert.equal(reason(player({ privacy: 'FRIENDS' })), 'privacy is neither PUBLIC nor PRIVATE')
    assert.equal(reason(player({ context: 'lobby' })), 'context lobby is not valid')
    assert.equal(reason(player({ self: 'yes' })), 'self is not a boolean')
  })

  test('rejects ranks that cannot exist', ({ assert }) => {
    const ranks = (entry: Record<string, unknown>) =>
      reason(player({ ranks: [{ ...rank(), ...entry }] }))
    assert.equal(ranks({ tier: 'WOOD' }), 'tier WOOD is not valid')
    assert.equal(ranks({ division: 'V' }), 'division V is not valid')
    assert.equal(ranks({ tier: 'MASTER', division: 'II' }), 'division II is not valid for MASTER')
    assert.equal(ranks({ lp: 101 }), 'lp 101 is out of range')
    assert.isNull(ranks({ tier: 'CHALLENGER', division: 'I', lp: 1800 }))
    assert.equal(ranks({ tier: 'CHALLENGER', division: 'I', lp: 5001 }), 'lp 5001 is out of range')
    assert.equal(ranks({ wins: -1 }), 'wins is out of range')
    assert.equal(ranks({ queue: 'RANKED_TFT' }), 'queue RANKED_TFT is not ranked solo or flex')
    assert.equal(
      reason(player({ ranks: [rank(), rank()] })),
      'queue RANKED_SOLO_5x5 is listed twice'
    )
    assert.equal(
      reason(player({ ranks: [rank(), rank({ queue: 'RANKED_FLEX_SR' }), rank()] })),
      'more than two rank entries'
    )
  })

  test('losses only come with the signed-in account', ({ assert }) => {
    assert.equal(
      reason(player({ ranks: [rank({ losses: 52 })] })),
      'losses are only known for the signed-in account'
    )
    assert.isNull(reason(player({ self: true, context: 'self', ranks: [rank({ losses: 52 })] })))
  })

  test('drops provisional queues instead of rejecting the player', ({ assert }) => {
    const verdict = validatePlayer(
      player({ ranks: [{ queue: 'RANKED_SOLO_5x5', tier: '', division: '', provisional: true }] }),
      CONTEXT
    )
    assert.isTrue(verdict.ok)
    if (verdict.ok) assert.deepEqual(verdict.player.ranks, [])
  })

  test('rejects implausible mastery, and keeps none for a private profile', ({ assert }) => {
    const mastery = (entry: Record<string, unknown>) =>
      reason(
        player({
          mastery: [
            { championId: 45, championLevel: 1, championPoints: 1, lastPlayTime: 1, ...entry },
          ],
        })
      )
    assert.equal(mastery({ championId: 9999 }), 'champion 9999 is unknown')
    assert.equal(mastery({ championLevel: 1001 }), 'championLevel is out of range')
    assert.equal(mastery({ championPoints: 100_000_001 }), 'championPoints is out of range')
    assert.equal(
      mastery({ lastPlayTime: NOW + 3600_000 }),
      'lastPlayTime is in the future or not a timestamp'
    )
    const eleven = Array.from({ length: 11 }, (_, i) => ({
      championId: i + 1,
      championLevel: 1,
      championPoints: 1,
      lastPlayTime: 1,
    }))
    assert.equal(
      reason(player({ mastery: eleven }), { ...CONTEXT, championIds: null }),
      'more than ten mastery entries'
    )

    const verdict = validatePlayer(player({ privacy: 'PRIVATE' }), CONTEXT)
    assert.isTrue(verdict.ok)
    if (verdict.ok) assert.isNull(verdict.player.mastery)
  })

  test('the hash ignores when and where a player was seen', ({ assert }) => {
    const a = validatePlayer(player(), CONTEXT)
    const b = validatePlayer(player({ observedAt: NOW - 1000, context: 'profile' }), CONTEXT)
    const c = validatePlayer(player({ summonerLevel: 246 }), CONTEXT)
    if (!a.ok || !b.ok || !c.ok) return assert.fail('valid players')
    assert.equal(snapshotHash(a.player), snapshotHash(b.player))
    assert.notEqual(snapshotHash(a.player), snapshotHash(c.player))
  })
})

test.group('Desktop player snapshots: trust rules (§6.4)', (group) => {
  group.tap((t) => t.tags(['@desktop']))

  const stored = (overrides: Partial<StoredRank> = {}): StoredRank => ({
    queue: 'RANKED_SOLO_5x5',
    tier: 'EMERALD',
    division: 'II',
    lp: 64,
    wins: 61,
    losses: 52,
    fetchedAt: NOW - 3600_000,
    ...overrides,
  })

  test('unknown losses are no difference, known different ones are', ({ assert }) => {
    assert.isTrue(sameRank(stored(), rank()))
    assert.isTrue(sameRank(stored(), rank({ losses: 52 })))
    assert.isFalse(sameRank(stored(), rank({ losses: 53 })))
    assert.isFalse(sameRank(stored({ losses: null }), rank({ losses: 52 })))
    assert.isFalse(sameRank(stored(), rank({ lp: 65 })))
    assert.isTrue(
      sameRank(
        stored({ tier: 'MASTER', division: 'I', lp: 10 }),
        rank({ tier: 'MASTER', division: 'I', lp: 10 })
      )
    )
  })

  test('more than 800 ladder points from a rank stored within a day is implausible', ({
    assert,
  }) => {
    const latest = new Map([['RANKED_SOLO_5x5', stored()]])
    // Emerald II 64 is 2264 on the ladder; Master 300 is 3100 (836 away).
    assert.isTrue(implausibleJump([rank({ tier: 'MASTER', division: 'I', lp: 300 })], latest, NOW))
    assert.isFalse(implausibleJump([rank({ tier: 'DIAMOND', division: 'IV', lp: 0 })], latest, NOW))
    // A day later, a run of games could explain anything.
    assert.isFalse(
      implausibleJump(
        [rank({ tier: 'MASTER', division: 'I', lp: 300 })],
        latest,
        NOW + 25 * 3600_000
      )
    )
    assert.isFalse(implausibleJump(null, latest, NOW))
  })

  test('corroboration needs another device, another network, the same rank, within 6 h', ({
    assert,
  }) => {
    const verdict = validatePlayer(player(), CONTEXT)
    if (!verdict.ok) return assert.fail('valid player')
    const snapshot: PlayerSnapshot = verdict.player
    const previous: PreviousReport = {
      deviceId: 'device-a',
      ipHash: 'ip-a',
      gameName: 'kesha',
      tagLine: 'euw',
      platform: 'EUW1',
      observedAt: snapshot.observedAt - 3600_000,
      ranks: snapshot.ranks,
      status: 'held',
    }
    const reporter = { deviceId: 'device-b', ipHash: 'ip-b' }
    assert.isTrue(corroborates(previous, snapshot, reporter))
    assert.isFalse(corroborates(previous, snapshot, { ...reporter, deviceId: 'device-a' }))
    assert.isFalse(corroborates(previous, snapshot, { ...reporter, ipHash: 'ip-a' }))
    assert.isFalse(
      corroborates(
        { ...previous, observedAt: snapshot.observedAt - 7 * 3600_000 },
        snapshot,
        reporter
      )
    )
    assert.isFalse(corroborates({ ...previous, ranks: [rank({ lp: 65 })] }, snapshot, reporter))
    assert.isFalse(
      corroborates({ ...previous, ranks: null }, { ...snapshot, ranks: null }, reporter)
    )
    assert.isFalse(corroborates({ ...previous, status: 'conflict' }, snapshot, reporter))
    assert.isFalse(corroborates(null, snapshot, reporter))
  })
})

test.group('Desktop player snapshots: continuous verification (§1.2)', (group) => {
  group.tap((t) => t.tags(['@desktop']))

  const riot = (overrides: Record<string, unknown> = {}) => ({
    queueType: 'RANKED_SOLO_5x5',
    tier: 'EMERALD',
    rank: 'II',
    leaguePoints: 64,
    wins: 61,
    losses: 52,
    ...overrides,
  })
  const timing = { observedAt: NOW, checkedAt: NOW + 60_000 }

  test('the same rank, or LP within 30, is a match', ({ assert }) => {
    assert.deepEqual(judgeSnapshot([rank()], [riot()], timing), { verdict: 'match' })
    assert.deepEqual(judgeSnapshot([rank()], [riot({ leaguePoints: 90 })], timing), {
      verdict: 'match',
    })
  })

  test('another tier or division, or LP off by more than 30, is a mismatch', ({ assert }) => {
    assert.equal(judgeSnapshot([rank()], [riot({ tier: 'GOLD' })], timing).verdict, 'mismatch')
    assert.equal(judgeSnapshot([rank()], [riot({ rank: 'I' })], timing).verdict, 'mismatch')
    assert.equal(judgeSnapshot([rank()], [riot({ leaguePoints: 100 })], timing).verdict, 'mismatch')
    assert.equal(judgeSnapshot([rank()], [], timing).verdict, 'mismatch')
    // Counts never go down.
    assert.equal(judgeSnapshot([rank()], [riot({ wins: 60 })], timing).verdict, 'mismatch')
  })

  test('what games played since could explain is never a mismatch', ({ assert }) => {
    // A win since the snapshot.
    assert.equal(
      judgeSnapshot([rank()], [riot({ wins: 62, tier: 'EMERALD', rank: 'I' })], timing).verdict,
      'inconclusive'
    )
    // Another player's hidden loss, even with a demotion.
    assert.equal(
      judgeSnapshot([rank({ lp: 0 })], [riot({ rank: 'III', leaguePoints: 75 })], timing).verdict,
      'inconclusive'
    )
    // The account's own losses are known: a demotion without a recorded loss is a lie.
    assert.equal(
      judgeSnapshot(
        [rank({ lp: 0, losses: 52 })],
        [riot({ rank: 'III', leaguePoints: 75 })],
        timing
      ).verdict,
      'mismatch'
    )
    // Too late to judge at all.
    assert.equal(
      judgeSnapshot([rank()], [riot({ tier: 'GOLD' })], {
        observedAt: NOW,
        checkedAt: NOW + 11 * 60_000,
      }).verdict,
      'inconclusive'
    )
  })

  test('sampling: one in N, with N as constants', ({ assert }) => {
    assert.equal(MATCH_AUDIT_ONE_IN, 10)
    assert.equal(PLAYER_AUDIT_ONE_IN, 20)
    let draw = 0
    const cycle = (max: number) => draw++ % max
    const hits = Array.from({ length: 200 }, () => oneIn(PLAYER_AUDIT_ONE_IN, cycle)).filter(
      Boolean
    )
    assert.lengthOf(hits, 10)
    // The real dice stay close to the rate.
    const real = Array.from({ length: 20_000 }, () => oneIn(PLAYER_AUDIT_ONE_IN)).filter(Boolean)
    assert.isAbove(real.length, 800)
    assert.isBelow(real.length, 1200)
  })
})
