import { readFileSync } from 'node:fs'
import { test } from '@japa/runner'
import type { Badge } from '@invadelol/ui/logic'
import { detailOf, isAfk, scoreLobby, SCORE_CATEGORIES } from '../../inertia/lib/match.js'
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
    champLevel: 15,
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

  test('winning lifts identical lines without making the game great', ({ assert }) => {
    const scores = scoreLobby(lobby())
    assert.isAbove(scores.p0.score, scores.p5.score)
    assert.isBelow(scores.p0.score - scores.p5.score, 15)
  })

  test('a support is weighted on vision, not farm', ({ assert }) => {
    const scores = scoreLobby(lobby())
    assert.isBelow(scores.p4.weights.farming, scores.p4.weights.vision)
    assert.isAbove(scores.p4.weights.vision, scores.p3.weights.vision)
  })

  test('the standard is real: a weaker lobby scores lower all round', ({ assert }) => {
    const even = scoreLobby(lobby())
    const weaker = scoreLobby(
      lobby(
        Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [
            i,
            { cs: 120, goldEarned: 8500, visionScore: 15, deaths: 6 },
          ])
        )
      )
    )
    for (const id of Object.keys(even)) assert.isBelow(weaker[id].score, even[id].score)
  })

  test('90 is rare and 100 is out of reach', ({ assert }) => {
    const stomp = scoreLobby(
      lobby({
        2: {
          kills: 18,
          deaths: 1,
          assists: 8,
          cs: 290,
          goldEarned: 19000,
          totalDamageDealtToChampions: 52000,
        },
      })
    )
    assert.isAbove(stomp.p2.score, 80)
    assert.isBelow(stomp.p2.score, 100)
  })

  test('an AFK player gets no score and does not count', ({ assert }) => {
    const base = scoreLobby(lobby())
    const m = lobby({ 7: { champLevel: 7, goldEarned: 4000, kills: 0, assists: 1, cs: 40 } })
    assert.isTrue(isAfk(m, m.participants[7]))
    const scores = scoreLobby(m)
    assert.notProperty(scores, 'p7')
    assert.equal(detailOf(m).players.find((p) => p.puuid === 'p7')!.rank, 0)
    // The enemy mid's lane is not free points: the duel is dropped.
    assert.isBelow(Math.abs(scores.p2.score - base.p2.score), 6)
    // A support far behind on levels is not AFK.
    const sup = lobby({ 4: { champLevel: 12, goldEarned: 7000 } })
    assert.isFalse(isAfk(sup, sup.participants[4]))
  })

  test('scores the real games of the fixture as the desktop app does', ({ assert }) => {
    // The app checks its own scorer (src-tauri/src/profile/score.rs) against this same file.
    const doc = JSON.parse(
      readFileSync(new URL('../fixtures/score_lobbies.json', import.meta.url), 'utf8')
    )
    for (const l of doc.lobbies) {
      const scores = scoreLobby(match(l.participants, l.duration))
      assert.deepEqual(
        l.participants.map((p: Participant) => scores[p.puuid]?.score ?? null),
        l.scores
      )
    }
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
    // Dropping a figure moves the scores a little, never who played best.
    const best = (m: Match) => detailOf(m).players.find((p) => p.rank === 1)?.puuid
    assert.equal(best(summary), 'p2')
    assert.equal(best(full), 'p2')
    assert.isAbove(without.p2.score, 0)
    assert.exists(withObjectives.p2)
  })
})

test.group('Match detail order', () => {
  test('each team reads top to support, whatever order the store returns', ({ assert }) => {
    // ClickHouse returns a game's participants in no fixed order.
    const shuffled = [7, 3, 9, 0, 5, 1, 8, 4, 2, 6].map((i) => player(i))
    const players = detailOf(match(shuffled)).players
    assert.deepEqual(
      players.map((p) => [p.teamId, p.position]),
      [100, 200].flatMap((team) =>
        ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'].map((position) => [team, position])
      )
    )
  })

  test('players without a lane keep their order, after the laned ones', ({ assert }) => {
    const aram = [4, 1, 3, 0, 2].map((i) => player(i, { position: '' }))
    assert.deepEqual(
      detailOf(match(aram)).players.map((p) => p.puuid),
      ['p4', 'p1', 'p3', 'p0', 'p2']
    )
  })
})
