import { test } from '@japa/runner'
import { rollingForm, shrink, synergyReport } from '../../inertia/lib/synergy.js'
import type { Match, Participant } from '../../inertia/lib/types.js'

/* A fictional player ("me"), a few fictional friends, and strangers who appear once. */
const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']
let strangers = 0
let matches = 0

function seat(puuid: string, teamId: number, position: string, win: boolean, championId = 1) {
  return {
    puuid,
    gameName: puuid,
    tagLine: 'TEST',
    championId,
    teamId,
    win,
    kills: 5,
    deaths: 5,
    assists: 7,
    cs: 170,
    champLevel: 15,
    visionScore: 24,
    damageTaken: 20000,
    totalDamageDealtToChampions: 18000,
    damageDealtToObjectives: 5000,
    goldEarned: 11000,
    position,
    items: [],
    spells: [],
    perks: { primary: 8000, sub: 8100, keystone: 8005 },
  } as unknown as Participant
}

/**
 * One game: me in `role`, the friends beside me in their seats, strangers everywhere else.
 * Friends are `[puuid, role, championId]`.
 */
function game(
  win: boolean,
  friends: Array<[string, string, number?]> = [],
  options: {
    role?: string
    champion?: number
    queueId?: number
    duration?: number
    at?: number
  } = {}
): Match {
  const role = options.role ?? 'MIDDLE'
  const participants: Participant[] = [seat('me', 100, role, win, options.champion ?? 1)]
  for (const position of ROLES) {
    if (position === role) continue
    const friend = friends.find(([, seatRole]) => seatRole === position)
    participants.push(
      friend
        ? seat(friend[0], 100, position, win, friend[2] ?? 2)
        : seat(`stranger-${strangers++}`, 100, position, win)
    )
  }
  for (const position of ROLES)
    participants.push(seat(`stranger-${strangers++}`, 200, position, !win))
  matches++
  return {
    matchId: `TEST_${matches}`,
    gameStartMs: options.at ?? matches * 3_600_000,
    duration: options.duration ?? 1800,
    queueId: options.queueId ?? 420,
    participants,
  } as Match
}

function solo(count: number, wins: number) {
  return Array.from({ length: count }, (_, i) => game(i < wins))
}

test.group('Friends synergy', (group) => {
  group.each.setup(() => {
    strangers = 0
    matches = 0
  })

  test('a lucky pair stays close to the usual rate, a long run keeps its edge', ({ assert }) => {
    const report = synergyReport(
      [
        ...solo(60, 30),
        ...Array.from({ length: 2 }, () => game(true, [['lucky', 'JUNGLE']])),
        ...Array.from({ length: 30 }, (_, i) => game(i < 21, [['steady', 'BOTTOM']])),
      ],
      'me'
    )
    const lucky = report.partners.find((p) => p.puuid === 'lucky')!
    const steady = report.partners.find((p) => p.puuid === 'steady')!
    // 2–0 is 100 %, but only a few points above the usual rate once pulled toward it.
    assert.isBelow(lucky.synergy, 8)
    assert.isAbove(lucky.synergy, 0)
    assert.equal(lucky.confidence, 'low')
    // 21–9 is 70 % against 50 % without: most of the 20 points survive.
    assert.isAbove(steady.synergy, 10)
    assert.isAbove(steady.synergy, lucky.synergy)
    assert.equal(steady.confidence, 'solid')
    assert.closeTo(steady.baseline, 32 / 62, 1e-9)
  })

  test('customs and remakes are not part of anyone’s record', ({ assert }) => {
    const report = synergyReport(
      [
        game(true, [['pal', 'JUNGLE']]),
        game(true, [['pal', 'JUNGLE']], { queueId: 0 }),
        game(true, [['pal', 'JUNGLE']], { duration: 200 }),
        game(false, [['pal', 'JUNGLE']]),
      ],
      'me'
    )
    assert.equal(report.games, 2)
    assert.equal(report.partners[0].games, 2)
  })

  test('tiers follow the size of the sample', ({ assert }) => {
    const report = synergyReport(
      [
        ...solo(70, 35),
        ...Array.from({ length: 12 }, () => game(true, [['duo', 'JUNGLE']])),
        ...Array.from({ length: 4 }, () => game(false, [['regular', 'TOP']])),
        ...Array.from({ length: 2 }, () => game(true, [['twice', 'TOP']])),
      ],
      'me'
    )
    const tier = (puuid: string) => report.partners.find((p) => p.puuid === puuid)?.tier
    // 88 games: a regular needs 3 (3 %), a duo partner 8 (8 %).
    assert.deepEqual(report.thresholds, { regular: 3, duo: 8 })
    assert.equal(tier('duo'), 'duo')
    assert.equal(tier('regular'), 'regular')
    assert.equal(tier('twice'), 'occasional')
    // Games with a friend: the duo's and the regular's, not the occasional one's.
    assert.equal(report.friends.games, 16)
    assert.equal(report.alone.games, 72)
  })

  test('seats and picks need three games; groups need three friends together', ({ assert }) => {
    const report = synergyReport(
      [
        ...solo(20, 10),
        ...Array.from({ length: 4 }, (_, i) =>
          game(i < 3, [
            ['ally', 'JUNGLE', 64],
            ['third', 'TOP', 516],
          ])
        ),
        game(true, [['ally', 'BOTTOM', 64]]),
        game(true, [['ally', 'BOTTOM', 222]]),
      ],
      'me'
    )
    const ally = report.partners.find((p) => p.puuid === 'ally')!
    assert.deepEqual(
      ally.roles.map((r) => [r.mine, r.theirs, r.games]),
      [['MIDDLE', 'JUNGLE', 4]]
    )
    assert.deepEqual(
      ally.champions.map((c) => [c.mine, c.theirs, c.games, c.wins]),
      [[1, 64, 5, 4]]
    )
    assert.lengthOf(report.groups, 1)
    assert.deepEqual(
      report.groups[0].members.map((m) => m.puuid),
      ['ally', 'third']
    )
    assert.equal(report.groups[0].games, 4)
  })

  test('the form line starts at the baseline, not at 0 or 100 %', ({ assert }) => {
    const form = rollingForm(
      [
        { t: 1, win: true, score: null },
        { t: 2, win: true, score: null },
        { t: 3, win: false, score: null },
      ],
      0.5
    )
    assert.closeTo(form[0], shrink(1, 1, 0.5, 4), 1e-9)
    assert.isBelow(form[0], 0.7)
    assert.isAbove(form[1], form[0])
    assert.isBelow(form[2], form[1])
  })
})
