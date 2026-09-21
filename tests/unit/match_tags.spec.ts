import { test } from '@japa/runner'
import { matchTags } from '../../inertia/lib/match_tags.js'
import type { Match, Participant } from '../../inertia/lib/types.js'

function fixture(): Match {
  const roles = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']
  return {
    matchId: 'EUW1_tags',
    platform: 'EUW1',
    gameStartMs: 1,
    duration: 1800,
    queueId: 420,
    mapId: 11,
    patch: 'test',
    t1Win: 1,
    t2Win: 0,
    t1Towers: 8,
    t2Towers: 3,
    t1Inhibs: 1,
    t2Inhibs: 0,
    t1Dragons: 4,
    t2Dragons: 1,
    t1Barons: 2,
    t2Barons: 0,
    t1Heralds: 1,
    t2Heralds: 0,
    t1Bans: [],
    t2Bans: [],
    participants: Array.from(
      { length: 10 },
      (_, i) =>
        ({
          puuid: `p${i}`,
          gameName: `Player ${i}`,
          tagLine: 'EUW',
          championId: i + 1,
          teamId: i < 5 ? 100 : 200,
          win: i < 5,
          kills: 5,
          deaths: 5,
          assists: 5,
          cs: 180,
          champLevel: 16,
          level: 100,
          items: [],
          spells: [],
          perks: { primary: 8000, sub: 8100, keystone: 8005 },
          visionScore: 20,
          damageTaken: 10000,
          totalDamageDealtToChampions: 15000,
          position: roles[i % 5],
          goldEarned: 10000,
          // Deliberately omit detail-only fields, just like the summary API.
        }) as unknown as Participant
    ),
  }
}

test.group('Match preview tags', () => {
  test('explains a carry from summary data without a timeline or LP guesses', ({ assert }) => {
    const match = fixture()
    Object.assign(match.participants[2], {
      kills: 15,
      deaths: 0,
      assists: 12,
      goldEarned: 18000,
      totalDamageDealtToChampions: 45000,
      cs: 270,
      visionScore: 65,
    })
    const tags = matchTags(match, 'p2')
    const ids = tags.map((tag) => tag.id)
    assert.includeMembers(ids, [
      'hard-carry',
      'role-diff',
      'deathless',
      'everywhere',
      'top-damage',
      'cs-machine',
      'gold-rush',
      'vision-control',
      'tower-control',
      'dragon-control',
      'baron-control',
    ])
    assert.notInclude(ids, 'great-kda')
    assert.equal(tags.find((tag) => tag.id === 'role-diff')?.label, 'Mid diff')
    assert.include(tags.find((tag) => tag.id === 'role-diff')!.description, '8,000 gold')
    assert.equal(new Set(ids).size, ids.length)
    assert.isFalse(tags.some((tag) => /\bLP\b/.test(tag.label)))
    assert.isTrue(tags.every((tag) => tag.description.length > 0))
  })

  test('role comparisons reverse for the opponent and require an unambiguous role', ({
    assert,
  }) => {
    const match = fixture()
    Object.assign(match.participants[2], { kills: 15, deaths: 2, goldEarned: 14000 })
    assert.equal(
      matchTags(match, 'p7').find((tag) => tag.id === 'role-outmatched')?.label,
      'Mid outmatched'
    )
    match.participants[6].position = 'MIDDLE'
    assert.isFalse(matchTags(match, 'p2').some((tag) => tag.id.startsWith('role-')))
    match.participants[2].position = ''
    assert.isFalse(matchTags(match, 'p2').some((tag) => tag.id.startsWith('role-')))
  })

  test('team and outcome tags follow the viewed player on either side', ({ assert }) => {
    const match = fixture()
    for (const player of match.participants.slice(0, 5)) {
      Object.assign(player, { kills: 10, deaths: 2, assists: 12, goldEarned: 14000 })
    }
    const winner = matchTags(match, 'p0').map((tag) => tag.id)
    const loser = matchTags(match, 'p5').map((tag) => tag.id)
    assert.includeMembers(winner, ['amazing-team', 'stomp'])
    assert.notInclude(winner, 'one-sided')
    assert.includeMembers(loser, ['team-struggled', 'one-sided'])
    assert.notInclude(loser, 'amazing-team')
    assert.notInclude(loser, 'stomp')
  })

  test('ARAM keeps combat highlights without Rift role, economy or objective claims', ({
    assert,
  }) => {
    const match = fixture()
    match.mapId = 12
    match.queueId = 450
    Object.assign(match.participants[2], {
      kills: 20,
      assists: 25,
      deaths: 0,
      cs: 300,
      goldEarned: 20000,
      visionScore: 90,
    })
    const ids = matchTags(match, 'p2').map((tag) => tag.id)
    assert.includeMembers(ids, ['deathless', 'kill-machine', 'team-player'])
    for (const id of [
      'role-diff',
      'cs-machine',
      'gold-rush',
      'vision-control',
      'tower-control',
      'dragon-control',
      'baron-control',
    ])
      assert.notInclude(ids, id)
  })

  test('missing players, invalid duration, short games and partial scoreboards are safe', ({
    assert,
  }) => {
    const match = fixture()
    assert.deepEqual(matchTags(match, 'missing'), [])
    match.duration = 0
    assert.deepEqual(matchTags(match, 'p0'), [])
    match.duration = 180
    assert.deepEqual(
      matchTags(match, 'p0').map((tag) => tag.id),
      ['short-game']
    )
    match.duration = 1800
    match.participants = [match.participants[0]]
    assert.deepEqual(matchTags(match, 'p0'), [])
    match.participants[0].deaths = 0
    assert.deepEqual(
      matchTags(match, 'p0').map((tag) => tag.id),
      ['deathless']
    )
  })

  test('zero totals and absent vision do not produce division artifacts or vision leaders', ({
    assert,
  }) => {
    const match = fixture()
    for (const player of match.participants) {
      Object.assign(player, {
        kills: 0,
        assists: 0,
        deaths: 0,
        goldEarned: 0,
        totalDamageDealtToChampions: 0,
        damageTaken: 0,
        visionScore: undefined,
      })
    }
    const tags = matchTags(match, 'p0')
    assert.isFalse(tags.some((tag) => /NaN|Infinity/.test(tag.description)))
    for (const id of [
      'deathless',
      'everywhere',
      'top-damage',
      'damage-dealer',
      'frontline',
      'vision-control',
      'vision-leader',
    ])
      assert.notInclude(
        tags.map((tag) => tag.id),
        id
      )
  })
})
