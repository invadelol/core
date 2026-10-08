import { test } from '@japa/runner'
import { buildMatchRow, buildParticipantRows, buildTimelineRows } from '#utils/clickhouse'
import {
  canonicalHash,
  compareFacts,
  completenessOf,
  riotFacts,
  timelineFits,
  toMatchDto,
  toTimelineDto,
  uploadFacts,
} from '#services/desktop/conversion'
import { apiPuuids, makeUpload, riotMatch } from '#tests/fixtures/desktop'

test.group('Desktop LCU → match-v5 conversion', (group) => {
  group.tap((t) => t.tags(['@desktop']))
  test('maps the client game onto MatchDTO.info for the existing row builders', ({ assert }) => {
    const upload = makeUpload()
    const puuids = apiPuuids(upload)
    const match = toMatchDto(upload, puuids)
    const info = match.info as any

    assert.equal(match.metadata.matchId, upload.matchId)
    assert.lengthOf(info.participants, 10)
    assert.equal(info.gameCreation, upload.game.gameCreation)
    // The client does not report a start timestamp; nothing is invented for it.
    assert.notProperty(info, 'gameStartTimestamp')

    const ahri = info.participants.find((p: any) => p.participantId === 3)
    const identity = upload.game.participantIdentities.find((i) => i.participantId === 3)!.player
    assert.equal(ahri.puuid, puuids.get(identity.puuid.toLowerCase()))
    assert.equal(ahri.riotIdGameName, identity.gameName)
    assert.equal(ahri.riotIdTagline, identity.tagLine)
    assert.equal(ahri.profileIcon, identity.profileIcon)
    assert.equal(ahri.teamPosition, 'MIDDLE')
    assert.equal(ahri.lane, 'MIDDLE')
    assert.equal(ahri.summoner1Id, 4)
    assert.equal(ahri.summoner2Id, 14)
    assert.isTrue(ahri.win)
    assert.equal(ahri.magicDamageTaken, upload.game.participants[2].stats.magicalDamageTaken)
    assert.deepEqual(
      ahri.perks.styles.map((s: any) => [
        s.description,
        s.style,
        s.selections.map((x: any) => x.perk),
      ]),
      [
        ['primaryStyle', 8100, [8112, 8139, 8138, 8135]],
        ['subStyle', 8200, [8226, 8210]],
      ]
    )

    const blue = info.teams.find((t: any) => t.teamId === 100)
    assert.isTrue(blue.win)
    assert.deepEqual(
      Object.fromEntries(Object.entries(blue.objectives).map(([k, v]: any) => [k, v.kills])),
      { baron: 1, champion: 27, dragon: 3, horde: 3, inhibitor: 2, riftHerald: 1, tower: 8 }
    )
    assert.isFalse(info.teams.find((t: any) => t.teamId === 200).win)
  })

  test('produces the same ClickHouse rows a Riot match would, minus what the client lacks', ({
    assert,
  }) => {
    const upload = makeUpload()
    const match = toMatchDto(upload, apiPuuids(upload))
    const gameStartMs = upload.game.gameCreation

    const row = buildMatchRow(upload.matchId, 'EUW1', gameStartMs, match.info)
    assert.include(row, {
      queue_id: 420,
      patch: '16.20',
      duration_sec: 1810,
      map_id: 11,
      t1_win: 1,
      t2_win: 0,
      t1_towers: 8,
      t2_towers: 3,
      t1_dragons: 3,
      t2_dragons: 1,
      t1_barons: 1,
      t1_heralds: 1,
      t1_inhibs: 2,
    })
    assert.deepEqual(row.t1_bans, [238, 157, 555, 893, 11])

    const participants = buildParticipantRows(upload.matchId, 'EUW1', gameStartMs, match.info)
    assert.lengthOf(participants, 10)
    const ahri = participants.find((p) => p.champion_id === 103)!
    assert.include(ahri, {
      team_position: 'MIDDLE',
      kills: 9,
      deaths: 2,
      assists: 8,
      win: 1,
      total_cs: 233,
      keystone: 8112,
      primary_style: 8100,
      secondary_style: 8200,
      spell1: 4,
      spell2: 14,
      item0: 6655,
      // Not in the client's match history: stored as 0, flagged in completeness.
      summoner_level: 0,
      all_in_pings: 0,
    })
    assert.equal(ahri.riot_id_game_name, upload.game.participantIdentities[2].player.gameName)
  })

  test('drops participants it could not map rather than storing them under no one', ({
    assert,
  }) => {
    const upload = makeUpload()
    const puuids = apiPuuids(upload)
    puuids.delete(upload.game.participantIdentities[0].player.puuid.toLowerCase())
    const match = toMatchDto(upload, puuids)
    assert.lengthOf(buildParticipantRows(upload.matchId, 'EUW1', 0, match.info), 9)
  })

  test('the client timeline feeds buildTimelineRows with consistent totals', ({ assert }) => {
    const upload = makeUpload()
    const match = toMatchDto(upload, apiPuuids(upload))
    const participants = match.info.participants.map((p) => ({
      participantId: p.participantId,
      puuid: p.puuid,
    }))
    const timeline = toTimelineDto(
      upload.timeline!,
      upload.matchId,
      upload.game.gameId,
      participants
    )
    assert.equal(timeline.info.frameInterval, 60000)

    const rows = buildTimelineRows(upload.matchId, 'EUW1', 0, match.info, timeline)
    assert.lengthOf(rows, upload.timeline!.frames.length * 10)

    const last = rows.filter((row) => row.frame_ms === 1810000)
    for (const participant of upload.game.participants) {
      const row = last.find((r) => r.participant_id === participant.participantId)!
      assert.equal(row.kills, participant.stats.kills)
      assert.equal(row.deaths, participant.stats.deaths)
      assert.equal(row.assists, participant.stats.assists)
      assert.equal(row.keystone, participant.stats.perk0)
      assert.isAbove(row.skill_order.length, 10)
      // Stat shards are not reported by the client.
      assert.equal(row.stat_offense, 0)
    }
  })

  test('keeps only the documented event types and fields', ({ assert }) => {
    const upload = makeUpload()
    upload.timeline!.frames[1].events.push(
      { type: 'PAUSE_END', timestamp: 61000 },
      {
        type: 'CHAMPION_KILL',
        timestamp: 61500,
        killerId: 1,
        victimId: 6,
        assistingParticipantIds: [2, 'x'],
        victimDamageReceived: [{ secret: true }],
      }
    )
    const timeline = toTimelineDto(upload.timeline!, upload.matchId, 1, [])
    const events = timeline.info.frames[1].events
    assert.notInclude(
      events.map((e) => e.type),
      'PAUSE_END'
    )
    const kill = events.find((e) => e.timestamp === 61500)!
    assert.deepEqual(kill.assistingParticipantIds, [2])
    assert.notProperty(kill, 'victimDamageReceived')
  })

  test('completeness lists what a desktop game lacks', ({ assert }) => {
    const upload = makeUpload()
    assert.deepEqual(completenessOf(upload), {
      pings: false,
      summonerLevel: false,
      statPerks: false,
      timeline: true,
      position: 'inferred',
    })
    const bare = makeUpload({ timeline: false })
    delete bare.game.participants[0].position
    assert.deepInclude(completenessOf(bare), { timeline: false, position: 'absent' })
  })

  test('compares two descriptions of a game on champions, K/D/A, results and duration', ({
    assert,
  }) => {
    const upload = makeUpload()
    const riot = riotMatch(upload, apiPuuids(upload))
    assert.deepEqual(compareFacts(uploadFacts(upload), riotFacts(riot.info)), [])

    // Whole seconds on both sides; a one-second rounding step is not a lie.
    ;(riot.info as any).gameDuration += 1
    assert.deepEqual(compareFacts(uploadFacts(upload), riotFacts(riot.info)), [])

    riot.info.participants[2].kills += 1
    assert.lengthOf(compareFacts(uploadFacts(upload), riotFacts(riot.info)), 1)
  })

  test('canonical hash identifies the game, not the request', ({ assert }) => {
    const now = Date.now()
    const a = makeUpload({ now })
    const b = makeUpload({ now })
    b.capturedAt += 5000
    b.app = '0.2.8'
    b.timeline = null
    b.lp = { queue: 'RANKED_SOLO_5x5' }
    assert.equal(canonicalHash(a), canonicalHash(b))

    b.game.participants[0].stats.item3 = 3078
    assert.notEqual(canonicalHash(a), canonicalHash(b))
  })

  test('the client timeline is only reused when the players line up with Riot', ({ assert }) => {
    const upload = makeUpload()
    const riot = riotMatch(upload, apiPuuids(upload))
    assert.isTrue(timelineFits(upload, riot.info))
    riot.info.participants[0].championId = 122
    assert.isFalse(timelineFits(upload, riot.info))
  })
})
