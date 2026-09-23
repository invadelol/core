import { test } from '@japa/runner'
import { rankLobby, scoreLobby, SCORE_CATEGORIES } from '../../inertia/lib/match.js'
import type { Match, Participant } from '../../inertia/lib/types.js'

const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']

function player(index: number, overrides: Partial<Participant> = {}): Participant {
  const teamId = index < 5 ? 100 : 200
  return {
    puuid: `p${index}`,
    gameName: `Player ${index}`,
    tagLine: 'EUW',
    championId: index + 1,
    teamId,
    win: teamId === 100,
    kills: 4,
    deaths: 4,
    assists: 6,
    cs: 180,
    visionScore: 25,
    damageTaken: 20000,
    totalDamageDealtToChampions: 18000,
    damageDealtToObjectives: 6000,
    goldEarned: 11000,
    position: ROLES[index % 5],
    ...overrides,
  } as Participant
}

function match(players: Participant[], duration = 1800): Match {
  return { matchId: 'EUW1_1', duration, t1Win: 1, t2Win: 0, participants: players } as Match
}

function lobby(overrides: Record<number, Partial<Participant>> = {}, duration?: number) {
  return match(
    Array.from({ length: 10 }, (_, i) => player(i, overrides[i])),
    duration
  )
}

test.group('Match score', () => {
  test('a remake is not scored', ({ assert }) => {
    const remake = lobby({}, 120)
    assert.deepEqual(scoreLobby(remake), {})
    assert.deepEqual(rankLobby(remake).rank, {})
    assert.isNull(rankLobby(remake).mvpPuuid)
  })

  test('scores and every category stay within 0–100', ({ assert }) => {
    const scores = scoreLobby(
      lobby({ 2: { kills: 25, deaths: 0, totalDamageDealtToChampions: 90000 } })
    )
    for (const entry of Object.values(scores)) {
      assert.isAtLeast(entry.score, 0)
      assert.isAtMost(entry.score, 100)
      for (const category of SCORE_CATEGORIES) {
        assert.isAtLeast(entry.categories[category], 0)
        assert.isAtMost(entry.categories[category], 100)
      }
    }
  })

  test('outplaying the lane opponent scores higher than the mirror', ({ assert }) => {
    // p2 and p7 are both mid, on opposite teams, so the win bonus is
    // removed by comparing two games where only p2's own line changes.
    const even = scoreLobby(lobby())
    const stomp = scoreLobby(
      lobby({ 2: { kills: 12, deaths: 1, totalDamageDealtToChampions: 40000, goldEarned: 16000 } })
    )
    assert.isAbove(stomp.p2.score, even.p2.score)
    assert.isAbove(stomp.p2.categories.fighting, even.p2.categories.fighting)
    assert.isBelow(stomp.p7.categories.fighting, even.p7.categories.fighting)
  })

  test('winning is worth the same fixed bonus to identical lines', ({ assert }) => {
    const scores = scoreLobby(lobby())
    assert.equal(scores.p0.score - scores.p5.score, 10)
  })

  test('a support is weighted on vision, not farm', ({ assert }) => {
    const scores = scoreLobby(lobby())
    assert.equal(scores.p4.weights.farming, 0)
    assert.isAbove(scores.p4.weights.vision, scores.p3.weights.vision)
  })

  test('a stat missing from the payload is dropped, not zeroed', ({ assert }) => {
    const full = lobby({ 2: { kills: 10 } })
    const summary = match(
      full.participants.map(({ damageDealtToObjectives, ...rest }) => rest as Participant)
    )
    const withObjectives = scoreLobby(full)
    const without = scoreLobby(summary)
    assert.equal(without.p2.weights.objectives, 0)
    // Objectives are even across this lobby, so dropping them keeps the order.
    assert.deepEqual(rankLobby(summary).rank, rankLobby(full).rank)
    assert.isAbove(without.p2.score, 0)
    assert.exists(withObjectives.p2)
  })
})
