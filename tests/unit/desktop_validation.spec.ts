import { test } from '@japa/runner'
import { validateStructure } from '#services/desktop/match_validation'
import { makeUpload } from '#tests/fixtures/desktop'
import type { MatchUpload } from '#types/desktop'

const NOW = Date.UTC(2026, 9, 8, 12)
const CHAMPIONS = new Set([266, 64, 103, 222, 412, 122, 234, 134, 145, 117])

function check(mutate: (upload: MatchUpload) => void = () => {}, championIds = CHAMPIONS) {
  const upload = makeUpload({ now: NOW })
  mutate(upload)
  return validateStructure(upload, { now: NOW, championIds })
}

const participant = (upload: MatchUpload, id: number) =>
  upload.game.participants.find((p) => p.participantId === id)!

test.group('Desktop upload structural checks (§4.1)', (group) => {
  group.tap((t) => t.tags(['@desktop']))
  test('accepts the fixture game', ({ assert }) => {
    assert.isNull(check())
  })

  test('rejects a match id that does not identify the game', ({ assert }) => {
    assert.equal(
      check((u) => (u.matchId = 'euw1_1')),
      'matchId is malformed'
    )
    assert.equal(
      check((u) => (u.matchId = 'EUW1_1')),
      'matchId does not match platformId and gameId'
    )
    assert.equal(
      check((u) => {
        u.game.platformId = 'XX1'
        u.matchId = `XX1_${u.game.gameId}`
      }),
      'platform XX1 is not supported'
    )
  })

  test('rejects games that are not matchmade games on accepted queues and maps', ({ assert }) => {
    assert.equal(
      check((u) => (u.game.gameType = 'CUSTOM_GAME')),
      'not a matchmade game'
    )
    assert.equal(
      check((u) => (u.game.queueId = 830)),
      'queue 830 is not accepted'
    )
    assert.equal(
      check((u) => (u.game.queueId = 1300)),
      'queue 1300 is not accepted'
    )
    assert.equal(
      check((u) => (u.game.mapId = 21)),
      'map 21 is not accepted'
    )
  })

  test('rejects games out of the time window', ({ assert }) => {
    assert.equal(
      check((u) => (u.game.gameCreation = NOW + 10 * 60_000)),
      'game is in the future'
    )
    assert.equal(
      check((u) => (u.game.gameCreation = NOW - 8 * 24 * 3600_000)),
      'game is older than 7 days'
    )
    assert.equal(
      check((u) => (u.game.gameDuration = 7201)),
      'gameDuration is out of range'
    )
    assert.equal(
      check((u) => (u.capturedAt = u.game.gameCreation + 600_000)),
      'captured before the game ended'
    )
  })

  test('rejects rosters that cannot be a real lobby', ({ assert }) => {
    assert.equal(
      check((u) => u.game.participants.pop()),
      '9 participants'
    )
    assert.equal(
      check((u) => (u.game.participants[1].participantId = 1)),
      'participantIds are not unique'
    )
    assert.equal(
      check((u) => u.game.participantIdentities.splice(4, 1)),
      'participant 5 has no identity'
    )
    assert.equal(
      check((u) => {
        u.game.participantIdentities[1].player.puuid = u.game.participantIdentities[0].player.puuid
      }),
      'raw PUUIDs are not unique'
    )
    assert.equal(
      check((u) => (u.game.participantIdentities[0].player.tagLine = '')),
      'participant 1 has no Riot ID'
    )
    assert.equal(
      check((u) => (u.uploader = '00000000-0000-4000-8000-000000000000')),
      'the uploader is not a participant'
    )
    assert.equal(
      check((u) => (participant(u, 5).teamId = 200)),
      'teams are not two teams of five'
    )
  })

  test('rejects unknown champions, against the list or the id range', ({ assert }) => {
    assert.equal(
      check((u) => (participant(u, 1).championId = 9999)),
      'champion 9999 is unknown'
    )
    assert.equal(
      check((u) => (participant(u, 1).championId = 950), CHAMPIONS),
      'champion 950 is unknown'
    )
    // Without a list, any id in Riot's range passes and anything else does not.
    assert.isNull(check((u) => (participant(u, 1).championId = 950), null as any))
    assert.equal(
      check((u) => (participant(u, 1).championId = 2500), null as any),
      'champion 2500 is unknown'
    )
  })

  test('rejects stats that are not numbers or not plausible', ({ assert }) => {
    assert.equal(
      check((u) => ((participant(u, 1).stats as any).goldEarned = '12840')),
      'stats.goldEarned is not a number'
    )
    assert.equal(
      check((u) => delete (participant(u, 1).stats as any).kills),
      'stats.kills is missing'
    )
    assert.equal(
      check((u) => (participant(u, 6).stats.deaths = 101)),
      'stats.deaths is out of range'
    )
    assert.equal(
      check((u) => (participant(u, 4).stats.totalMinionsKilled = 2001)),
      'stats.totalMinionsKilled is out of range'
    )
    assert.equal(
      check((u) => (participant(u, 4).stats.goldEarned = 150_001)),
      'stats.goldEarned is out of range'
    )
    assert.equal(
      check((u) => (participant(u, 4).stats.totalDamageDealtToChampions = 500_001)),
      'stats.totalDamageDealtToChampions is out of range'
    )
  })

  test('rejects a scoreboard that does not add up', ({ assert }) => {
    // Team 100 has 27 kills against 28 enemy deaths (one execution).
    assert.equal(
      check((u) => (participant(u, 1).stats.kills = 6)),
      'team 100 kills exceed enemy deaths'
    )
    assert.equal(
      check((u) => (participant(u, 6).stats.assists = 16)),
      'team 200 assists exceed its kills'
    )
    assert.equal(
      check((u) => (u.game.teams[1].win = 'Win')),
      'not exactly one winning team'
    )
    assert.equal(
      check((u) => (participant(u, 7).stats.win = true)),
      'participant 7 result disagrees with the team result'
    )
  })

  test('Arena lobbies are checked on size, not on two teams of five', ({ assert }) => {
    assert.isNull(
      check((u) => {
        u.game.mapId = 30
        u.game.queueId = 1700
        u.game.participants.forEach((p, i) => (p.teamId = 100 + Math.floor(i / 2) * 100))
      })
    )
  })
})
