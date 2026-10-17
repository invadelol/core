import { test } from '@japa/runner'
import { selfTag } from '../../inertia/lib/self_tags.js'
import type { Match, Participant } from '../../inertia/lib/types.js'

/* A fictional lobby: "me" and nine others with an ordinary game each. */
const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']

function seat(puuid: string, teamId: number, position: string, win: boolean) {
  return {
    puuid,
    teamId,
    position,
    win,
    kills: 5,
    deaths: 5,
    assists: 7,
    cs: 200,
    champLevel: 15,
    goldEarned: 11000,
    visionScore: 25,
    totalDamageDealtToChampions: 18000,
  } as unknown as Participant
}

function game(me: Partial<Participant> = {}, options: Partial<Match> = {}): Match {
  const participants: Participant[] = []
  for (const [teamId, win] of [
    [100, false],
    [200, true],
  ] as const)
    for (const position of ROLES)
      participants.push(seat(`${teamId}-${position}`, teamId, position, win))
  Object.assign(participants[2], { puuid: 'me' }, me)
  return {
    matchId: 'TEST_1',
    mapId: 11,
    queueId: 420,
    duration: 30 * 60,
    participants,
    ...options,
  } as Match
}

test.group('Self tags', () => {
  test('an ordinary loss earns nothing', ({ assert }) => {
    assert.isNull(selfTag(game(), 'me'))
  })

  test('a clearly bad loss earns one tag, the first that fits', ({ assert }) => {
    assert.equal(selfTag(game({ kills: 1, deaths: 12, assists: 3 }), 'me')?.id, 'grey')
    assert.equal(selfTag(game({ kills: 0, deaths: 4, assists: 1 }), 'me')?.id, 'visiting')
    assert.equal(selfTag(game({ cs: 90 }), 'me')?.id, 'spared')
    assert.equal(selfTag(game({ totalDamageDealtToChampions: 4000 }), 'me')?.id, 'pacifist')
    assert.equal(selfTag(game({ visionScore: 4 }), 'me')?.id, 'dark')
  })

  test('wins, short games, remakes, other maps and custom games earn nothing', ({ assert }) => {
    const bad = { kills: 1, deaths: 12, assists: 3 }
    assert.isNull(selfTag(game({ ...bad, win: true }), 'me'))
    assert.isNull(selfTag(game(bad, { duration: 18 * 60 }), 'me'))
    assert.isNull(selfTag(game(bad, { duration: 200 }), 'me'))
    assert.isNull(selfTag(game(bad, { mapId: 12, queueId: 450 }), 'me'))
    assert.isNull(selfTag(game(bad, { queueId: 0 }), 'me'))
  })

  test('a player who was away earns nothing', ({ assert }) => {
    assert.isNull(selfTag(game({ kills: 0, assists: 0, champLevel: 6, goldEarned: 3000 }), 'me'))
  })

  test('lane rules leave supports and junglers alone', ({ assert }) => {
    const support = game({ cs: 30, totalDamageDealtToChampions: 3000 })
    Object.assign(support.participants[2], { position: 'UTILITY' })
    assert.isNull(selfTag(support, 'me'))
  })

  test('a player not in the game earns nothing', ({ assert }) => {
    assert.isNull(selfTag(game(), 'someone-else'))
  })
})
