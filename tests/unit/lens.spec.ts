import { test } from '@japa/runner'
import {
  EDGE,
  MIN_GAMES,
  PACE_RATING,
  readLens,
  type LensDomain,
  type LensFrame,
  type LensEvent,
  type LensRole,
} from '../../inertia/lib/lens.js'
import { scoreLobby } from '../../inertia/lib/match.js'
import { lensRole, mainRole } from '../../app/services/lens_service.js'
import type { Match, Participant } from '../../inertia/lib/types.js'

/* Fictional lobbies: p0…p4 on blue, p5…p9 on red, in lane order, so p0 and p5 share a lane. */
const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']
const ME = 'p0'

function player(index: number, overrides: Partial<Participant> = {}): Participant {
  const teamId = index < 5 ? 100 : 200
  return {
    puuid: `p${index}`,
    gameName: `Player ${index}`,
    tagLine: 'TEST',
    championId: index + 1,
    teamId,
    win: teamId === 100,
    kills: 4,
    deaths: 4,
    assists: 6,
    champLevel: 15,
    cs: 190,
    visionScore: 25,
    wardsPlaced: 10,
    wardsKilled: 3,
    visionWardsBoughtInGame: 2,
    damageTaken: 20000,
    totalDamageDealtToChampions: 18000,
    damageDealtToObjectives: 6000,
    damageDealtToTurrets: 3000,
    goldEarned: 12000,
    position: ROLES[index % 5],
    items: [],
    spells: [],
    perks: { primary: 8000, sub: 8100, keystone: 8005 },
    ...overrides,
  } as Participant
}

let ids = 0
function game(
  overrides: Record<number, Partial<Participant>> = {},
  options: { duration?: number; at?: number } = {}
): Match {
  const n = ++ids
  return {
    matchId: `TEST_${n}`,
    gameStartMs: options.at ?? n * 1000,
    duration: options.duration ?? 1800,
    queueId: 420,
    t1Win: 1,
    t2Win: 0,
    participants: Array.from({ length: 10 }, (_, i) => player(i, overrides[i])),
  } as Match
}

const games = (count: number, overrides: Record<number, Partial<Participant>> = {}) =>
  Array.from({ length: count }, () => game(overrides))

/** Frames at 10, 14 and 15 minutes for both players of a lane. */
function frames(
  match: Match,
  mine: { cs10?: number; gold15?: number; deaths14?: number } = {},
  theirs: { cs10?: number; gold15?: number; deaths14?: number } = {},
  lane = [0, 5]
): LensFrame[] {
  return lane.flatMap((index, side) => {
    const line = side ? theirs : mine
    const puuid = `p${index}`
    return [10, 14, 15].map((minute) => ({
      matchId: match.matchId,
      puuid,
      participantId: index + 1,
      minute,
      cs: minute === 10 ? (line.cs10 ?? 75) : 110,
      gold: minute === 15 ? (line.gold15 ?? 6000) : 4000,
      xp: 5000,
      deaths: minute === 14 ? (line.deaths14 ?? 1) : 0,
    }))
  })
}

const domain = (lens: { domains: LensDomain[] }, key: string) =>
  lens.domains.find((d) => d.key === key)!
const read = (
  matches: Match[],
  extra: { frames?: LensFrame[]; events?: LensEvent[] } = {},
  role: LensRole = 'TOP'
) => readLens({ puuid: ME, role, matches, ...extra })

test.group('Lens', () => {
  test('reads only the role asked for, without remakes or games the player left', ({ assert }) => {
    const matches = [
      ...games(4),
      game({ 0: { position: 'MIDDLE' }, 2: { position: 'TOP' } }),
      game({}, { duration: 200 }),
      game({ 0: { champLevel: 6, goldEarned: 2000 } }),
    ]
    const lens = read(matches)
    assert.equal(lens.games.length, 4)
    assert.equal(lens.role, 'TOP')
  })

  test('games are read oldest first, with the score the match list shows', ({ assert }) => {
    const late = game({}, { at: 9_000_000 })
    const early = game({ 0: { kills: 10 } }, { at: 1_000 })
    const lens = read([late, early])
    assert.deepEqual(
      lens.games.map((g) => g.matchId),
      [early.matchId, late.matchId]
    )
    assert.equal(lens.games[0].score, scoreLobby(early)[ME].score)
  })

  test('every rating stays within 0–100', ({ assert }) => {
    const stomp = games(8, {
      0: { kills: 20, deaths: 0, cs: 320, goldEarned: 21000, visionScore: 60 },
    })
    const lens = read(stomp, {
      frames: stomp.flatMap((m) => frames(m, { cs10: 110 }, { cs10: 40 })),
    })
    for (const d of lens.domains) {
      assert.isNotNull(d.rating, d.key)
      assert.isAtLeast(d.rating!, 0)
      assert.isAtMost(d.rating!, 100)
    }
  })

  test('farming above the pace and the lane opponent is a strength, below it is not', ({
    assert,
  }) => {
    const ahead = read(games(10, { 0: { cs: 270, goldEarned: 15500 } }))
    const behind = read(games(10, { 0: { cs: 120, goldEarned: 9000 } }))
    const farming = domain(ahead, 'farming')
    assert.isAtLeast(farming.rating!, EDGE)
    assert.isBelow(domain(behind, 'farming').rating!, PACE_RATING)
    assert.match(farming.read!, /Emerald pace 6\.4/)
    const cs = farming.figures.find((f) => f.key === 'csm')!
    assert.closeTo(cs.value!, 9, 1e-9)
    assert.deepEqual(
      cs.refs.map((r) => r.label),
      ['Emerald', 'Opponents']
    )
    assert.isAbove(cs.standing!, 0)
  })

  test('a lane opponent who farms the same leaves the lane half even', ({ assert }) => {
    // Both top laners at 9 CS a minute: ahead of the pace, level with each other.
    const lens = read(games(10, { 0: { cs: 270 }, 5: { cs: 270 } }))
    const solo = read(games(10, { 0: { cs: 270 } }))
    assert.isBelow(domain(lens, 'farming').rating!, domain(solo, 'farming').rating!)
  })

  test('laning waits for timelines, then reads them against the lane opponent', ({ assert }) => {
    const matches = games(6)
    const without = domain(read(matches), 'laning')
    assert.isNull(without.rating)
    assert.equal(without.need, 'timeline')
    assert.isNull(without.read)

    const timeline = matches.flatMap((m) => frames(m, { deaths14: 3 }, { deaths14: 0 }))
    const laning = domain(read(matches, { frames: timeline }), 'laning')
    assert.isNotNull(laning.rating)
    assert.isBelow(laning.rating!, PACE_RATING)
    assert.equal(laning.games, 6)
    const deaths = laning.figures.find((f) => f.key === 'deaths14')!
    assert.equal(deaths.value, 3)
    assert.equal(deaths.refs[0].value, 0)
    assert.isBelow(deaths.standing!, 0)
    assert.match(laning.read!, /^Early deaths cost your lane\./)
  })

  test('CS at 10 is read as the gap to the lane opponent', ({ assert }) => {
    const matches = games(5)
    const timeline = matches.flatMap((m) => frames(m, { cs10: 88 }, { cs10: 70 }))
    const laning = domain(read(matches, { frames: timeline }), 'laning')
    assert.isAbove(laning.rating!, PACE_RATING)
    assert.match(laning.read!, /18 CS up at 10/)
  })

  test('solo kills come from the events of the laning phase', ({ assert }) => {
    const matches = games(4)
    const events: LensEvent[] = matches.flatMap((m) => [
      { matchId: m.matchId, t: 300, kind: 'kill', killer: 1, victim: 6, assists: [] },
      { matchId: m.matchId, t: 400, kind: 'kill', killer: 1, victim: 6, assists: [2] },
      { matchId: m.matchId, t: 1200, kind: 'kill', killer: 1, victim: 6, assists: [] },
    ])
    const laning = domain(
      read(matches, { frames: matches.flatMap((m) => frames(m)), events }),
      'laning'
    )
    const solo = laning.figures.find((f) => f.key === 'solo')!
    assert.equal(solo.value, 1)
    assert.equal(solo.refs[0].value, 0)
  })

  test('too few games give no rating, and a few are pulled towards the pace', ({ assert }) => {
    const strong = { 0: { cs: 300, goldEarned: 17000 } }
    const two = domain(read(games(MIN_GAMES - 1, strong)), 'farming')
    assert.isNull(two.rating)
    assert.equal(two.need, 'games')
    const few = domain(read(games(MIN_GAMES, strong)), 'farming')
    const many = domain(read(games(30, strong)), 'farming')
    assert.isAbove(few.rating!, PACE_RATING)
    assert.isBelow(few.rating!, many.rating!)
  })

  test('a support is not read on CS, and only a jungler on epic monsters', ({ assert }) => {
    const support = read(games(5), {}, 'UTILITY')
    assert.notInclude(
      domain(support, 'farming').figures.map((f) => f.key),
      'csm'
    )
    const matches = games(4)
    const events: LensEvent[] = matches.map((m) => ({
      matchId: m.matchId,
      t: 900,
      kind: 'dragon',
      killer: 2,
      victim: 0,
      assists: [],
    }))
    const jungle = readLens({
      puuid: 'p1',
      role: 'JUNGLE',
      matches,
      frames: matches.flatMap((m) => frames(m, {}, {}, [1, 6])),
      events,
    })
    const epic = domain(jungle, 'objectives').figures.find((f) => f.key === 'epic')!
    assert.equal(epic.value, 1)
    assert.notInclude(
      domain(read(matches), 'objectives').figures.map((f) => f.key),
      'epic'
    )
  })

  test('steady games rate higher on consistency than swinging ones', ({ assert }) => {
    const steady = games(12)
    const swinging = Array.from({ length: 12 }, (_, i) =>
      game(
        i % 2
          ? { 0: { kills: 14, deaths: 1, assists: 10, cs: 280, goldEarned: 17000 } }
          : { 0: { kills: 0, deaths: 11, assists: 1, cs: 110, goldEarned: 7000 } }
      )
    )
    const a = domain(read(steady), 'consistency')
    const b = domain(read(swinging), 'consistency')
    assert.isAbove(a.rating!, b.rating!)
    assert.match(b.read!, /swing/)
    assert.equal(a.trend.length, 12)
  })

  test('the main role is the one played most, lane order breaking a tie', ({ assert }) => {
    assert.equal(
      mainRole([
        { role: 'MIDDLE', games: 4 },
        { role: 'TOP', games: 4 },
        { role: 'UTILITY', games: 2 },
      ]),
      'TOP'
    )
    assert.isNull(mainRole([]))
    assert.equal(lensRole('SUPPORT'), 'UTILITY')
    assert.equal(lensRole('jungle'), 'JUNGLE')
    assert.isNull(lensRole('ARAM'))
  })
})
