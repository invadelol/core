import { test } from '@japa/runner'
import { assignPositions, type PositionEvidence } from '#services/live/positions'
import { buildLiveGame, type SpectatorGame } from '#services/live/live_game'

/** Summoner spells and champions by name, so the fixtures read as a lobby. */
const FLASH = 4
const SMITE = 11
const TELEPORT = 12
const IGNITE = 14
const HEAL = 7
const EXHAUST = 3
const CHAMPIONS = {
  Darius: 122,
  LeeSin: 64,
  Graves: 104,
  Ahri: 103,
  Jinx: 222,
  Thresh: 412,
  Seraphine: 147,
  Lux: 99,
  Yone: 777,
  Irelia: 39,
  Vi: 254,
  Caitlyn: 51,
  Leona: 89,
}

const player = (
  championId: number,
  spells: [number, number],
  extra: Partial<PositionEvidence> = {}
): PositionEvidence => ({ championId, spell1Id: spells[0], spell2Id: spells[1], ...extra })

const seats = (team: PositionEvidence[]) => assignPositions(team)!.map((seat) => seat.position)

test.group('Live game positions', () => {
  test('seats a shuffled team in its lanes', ({ assert }) => {
    const team = [
      player(CHAMPIONS.Jinx, [HEAL, FLASH]),
      player(CHAMPIONS.LeeSin, [SMITE, FLASH]),
      player(CHAMPIONS.Thresh, [FLASH, IGNITE]),
      player(CHAMPIONS.Darius, [FLASH, TELEPORT]),
      player(CHAMPIONS.Ahri, [FLASH, IGNITE]),
    ]
    assert.deepEqual(seats(team), ['ADC', 'JUNGLE', 'SUPPORT', 'TOP', 'MID'])
    for (const seat of assignPositions(team)!) assert.isAbove(seat.confidence, 0.95)
  })

  test('Smite makes the jungler, whatever the champion', ({ assert }) => {
    const team = [
      player(CHAMPIONS.Graves, [FLASH, TELEPORT]),
      player(CHAMPIONS.Darius, [SMITE, FLASH]),
      player(CHAMPIONS.Ahri, [FLASH, IGNITE]),
      player(CHAMPIONS.Caitlyn, [HEAL, FLASH]),
      player(CHAMPIONS.Leona, [FLASH, EXHAUST]),
    ]
    assert.deepEqual(seats(team), ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'])
  })

  test("a flex pick follows the player's own games", ({ assert }) => {
    const rest = [
      player(CHAMPIONS.Darius, [FLASH, TELEPORT]),
      player(CHAMPIONS.Vi, [SMITE, FLASH]),
      player(CHAMPIONS.Jinx, [HEAL, FLASH]),
    ]
    const seraphine = player(CHAMPIONS.Seraphine, [FLASH, IGNITE])
    const lux = player(CHAMPIONS.Lux, [FLASH, IGNITE])
    // Without history, Seraphine is the support and Lux the mid laner.
    assert.deepEqual(seats([seraphine, lux, ...rest]).slice(0, 2), ['SUPPORT', 'MID'])
    // A mid laner who plays Seraphine there takes mid; Lux supports.
    const midMain = {
      ...seraphine,
      history: [1, 0, 30, 2, 3],
      championHistory: [0, 0, 10, 0, 0],
    }
    assert.deepEqual(seats([midMain, lux, ...rest]).slice(0, 2), ['MID', 'SUPPORT'])
  })

  test('says how sure each seat is', ({ assert }) => {
    const team = [
      player(CHAMPIONS.Yone, [FLASH, IGNITE]),
      player(CHAMPIONS.Irelia, [FLASH, IGNITE]),
      player(CHAMPIONS.LeeSin, [SMITE, FLASH]),
      player(CHAMPIONS.Jinx, [HEAL, FLASH]),
      player(CHAMPIONS.Thresh, [FLASH, EXHAUST]),
    ]
    const result = assignPositions(team)!
    // Yone and Irelia both go Top or Mid: either way round is close.
    assert.isBelow(result[0].confidence, 0.7)
    assert.isBelow(result[1].confidence, 0.7)
    assert.sameMembers([result[0].position, result[1].position], ['TOP', 'MID'])
    assert.isAbove(result[2].confidence, 0.95)
  })

  test('leaves a team that is not five players unseated', ({ assert }) => {
    assert.isNull(assignPositions([player(CHAMPIONS.Ahri, [FLASH, IGNITE])]))
  })
})

/** A fictional lobby as spectator-v5 sends it: each team listed in no lane order. */
const puuid = (letter: string) => letter.repeat(78)
const lobby: SpectatorGame & { observers: unknown } = {
  gameId: 42,
  gameStartTime: 1_700_000_000_000,
  gameLength: 600,
  gameQueueConfigId: 420,
  mapId: 11,
  gameMode: 'CLASSIC',
  observers: { encryptionKey: 'private-observer-value' },
  bannedChampions: [{ championId: 157, teamId: 100, pickTurn: 1 }],
  participants: [
    {
      puuid: puuid('a'),
      riotId: 'Quiet Fern#0001',
      championId: 222,
      teamId: 100,
      spell1Id: 7,
      spell2Id: 4,
    },
    {
      puuid: puuid('b'),
      riotId: 'Amber Kite#0002',
      championId: 64,
      teamId: 100,
      spell1Id: 11,
      spell2Id: 4,
    },
    {
      puuid: puuid('c'),
      riotId: 'Low Tide#0003',
      championId: 412,
      teamId: 100,
      spell1Id: 4,
      spell2Id: 14,
    },
    {
      puuid: puuid('d'),
      riotId: 'North Gate#0004',
      championId: 122,
      teamId: 100,
      spell1Id: 4,
      spell2Id: 12,
    },
    {
      puuid: puuid('e'),
      riotId: 'Pale Comet#0005',
      championId: 103,
      teamId: 100,
      spell1Id: 4,
      spell2Id: 14,
    },
    {
      puuid: puuid('f'),
      riotId: 'Iron Wren#0006',
      championId: 89,
      teamId: 200,
      spell1Id: 4,
      spell2Id: 3,
    },
    {
      puuid: puuid('g'),
      riotId: 'Slow River#0007',
      championId: 51,
      teamId: 200,
      spell1Id: 4,
      spell2Id: 7,
    },
    {
      puuid: puuid('h'),
      riotId: 'Red Lantern#0008',
      championId: 104,
      teamId: 200,
      spell1Id: 11,
      spell2Id: 4,
    },
    {
      puuid: puuid('i'),
      riotId: 'Glass Owl#0009',
      championId: 61,
      teamId: 200,
      spell1Id: 4,
      spell2Id: 14,
    },
    {
      puuid: puuid('j'),
      riotId: 'Stone Bell#0010',
      championId: 86,
      teamId: 200,
      spell1Id: 4,
      spell2Id: 12,
    },
  ],
}

test.group('Live game', () => {
  test('seats both teams in lane order, with ranks and stored games', ({ assert }) => {
    const game = buildLiveGame(
      lobby,
      [
        {
          puuid: puuid('e'),
          tier: 'GOLD',
          division: 'II',
          leaguePoints: 40,
          wins: 30,
          losses: 20,
        },
      ],
      [
        { puuid: puuid('e'), championId: 103, position: 'MIDDLE', win: true },
        { puuid: puuid('e'), championId: 103, position: 'MIDDLE', win: false },
        { puuid: puuid('e'), championId: 7, position: 'MIDDLE', win: true },
      ]
    )
    assert.deepEqual(
      game.participants.map((p) => [p.teamId, p.position, p.championId]),
      [
        [100, 'TOP', 122],
        [100, 'JUNGLE', 64],
        [100, 'MID', 103],
        [100, 'ADC', 222],
        [100, 'SUPPORT', 412],
        [200, 'TOP', 86],
        [200, 'JUNGLE', 104],
        [200, 'MID', 61],
        [200, 'ADC', 51],
        [200, 'SUPPORT', 89],
      ]
    )
    const mid = game.participants[2]
    assert.deepEqual(mid.championStats, { games: 2, winrate: 0.5 })
    assert.deepEqual(mid.recent, { games: 3, wins: 2 })
    assert.deepEqual(mid.rank, {
      tier: 'GOLD',
      division: 'II',
      leaguePoints: 40,
      wins: 30,
      losses: 20,
    })
    assert.isNull(game.participants[0].rank)
    assert.isNull(game.participants[0].championStats)
    assert.deepEqual(game.bannedChampions, [{ championId: 157, teamId: 100 }])
    assert.notInclude(JSON.stringify(game), 'private-observer-value')
  })

  test('keeps Riot order and no lanes off Summoner’s Rift', ({ assert }) => {
    const game = buildLiveGame({ ...lobby, mapId: 12, gameQueueConfigId: 450 }, [], [])
    assert.deepEqual(
      game.participants.map((p) => p.championId),
      lobby.participants.map((p) => p.championId)
    )
    assert.isTrue(game.participants.every((p) => p.position === null))
  })
})
