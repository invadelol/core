import { test } from '@japa/runner'
import type { Badge } from '@invadelol/ui/logic'
import { detailOf, scoreLobby, SCORE_CATEGORIES } from '../../inertia/lib/match.js'
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
    items: [],
    spells: [],
    perks: { primary: 8000, sub: 8100, keystone: 8005 },
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
    for (const p of detailOf(remake).players) {
      assert.isNull(p.score)
      assert.equal(p.rank, 0)
      assert.notInclude(p.badges, 'mvp')
    }
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

  test('MVP and ACE go to the best of each team', ({ assert }) => {
    const detail = detailOf(lobby({ 2: { kills: 15 }, 7: { kills: 15 } }))
    const badged = (badge: Badge) => detail.players.filter((p) => p.badges.includes(badge))
    assert.deepEqual(
      badged('mvp').map((p) => p.puuid),
      ['p2']
    )
    assert.deepEqual(
      badged('ace').map((p) => p.puuid),
      ['p7']
    )
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
    const ranks = (m: Match) => detailOf(m).players.map((p) => p.rank)
    assert.deepEqual(ranks(summary), ranks(full))
    assert.isAbove(without.p2.score, 0)
    assert.exists(withObjectives.p2)
  })
})
