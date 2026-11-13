import { test } from '@japa/runner'
import { LobbyGamesService, lobbyGame, pickPlayers } from '#services/lobby_games_service'

const stored = (puuid: string, platform: string, name: string, tag: string, at: string | null) => ({
  puuid,
  platform,
  game_name: name,
  tag_line: tag,
  last_refresh_at: at,
})

const game = (matchId: string, startMs: number) => ({ ...lobbyGame([]), matchId, startMs })

test.group('Lobby games', () => {
  test('reads a participants row as one game line', ({ assert }) => {
    const row = [
      'p',
      'EUW1_9',
      '1700',
      420,
      266,
      100,
      1,
      5,
      2,
      7,
      'TOP',
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      4,
      12,
      8010,
      8000,
      8400,
    ]
    assert.deepEqual(lobbyGame(row), {
      matchId: 'EUW1_9',
      startMs: 1700,
      duration: 0,
      queueId: 420,
      championId: 266,
      teamId: 100,
      win: true,
      kills: 5,
      deaths: 2,
      assists: 7,
      position: 'TOP',
      items: [1, 2, 3, 4, 5, 6, 7],
      spells: [4, 12],
      keystone: 8010,
      primary: 8000,
      sub: 8400,
    })
  })

  test('one stored player per Riot ID: the asked platform first, else the freshest', ({
    assert,
  }) => {
    const rows = [
      stored('a-na', 'NA1', 'Northwind', 'EUW', '2026-11-01T00:00:00Z'),
      stored('a-euw', 'EUW1', 'northwind', 'euw', '2026-10-01T00:00:00Z'),
      stored('b-old', 'EUW1', 'Cinder', '0001', null),
      stored('b-new', 'EUW1', 'Cinder', '0001', '2026-11-02T00:00:00Z'),
    ]
    const onEuw = pickPlayers(rows, 'EUW1')
    assert.equal(onEuw.get('northwind#euw')?.puuid, 'a-euw')
    assert.equal(onEuw.get('cinder#0001')?.puuid, 'b-new')
    assert.equal(pickPlayers(rows, undefined).get('northwind#euw')?.puuid, 'a-na')
    assert.equal(pickPlayers(rows, 'KR').get('northwind#euw')?.puuid, 'a-na')
  })

  test('answers in the order asked, unknown players empty, and reads each player once', async ({
    assert,
  }) => {
    let now = 1_000_000
    const service = new LobbyGamesService(() => now)
    const reads: string[][] = []
    service.storedPlayers = async () =>
      pickPlayers(
        [
          stored('p1', 'EUW1', 'Northwind', 'EUW', null),
          stored('p2', 'EUW1', 'Cinder', '0001', null),
        ],
        'EUW1'
      )
    service.storedGames = async (puuids) => {
      reads.push([...puuids])
      return new Map([['p1', [game('EUW1_3', 3), game('EUW1_2', 2), game('EUW1_1', 1)]]])
    }
    const asked = [
      { gameName: 'Cinder', tagLine: '0001' },
      { gameName: 'Nobody', tagLine: 'X' },
      { gameName: 'NORTHWIND', tagLine: 'euw' },
    ]
    const first = await service.games(asked, 'EUW1', 2)
    assert.deepEqual(
      first.map((p) => [p.gameName, p.known, p.games.map((g) => g.matchId)]),
      [
        ['Cinder', true, []],
        ['Nobody', false, []],
        ['NORTHWIND', true, ['EUW1_3', 'EUW1_2']],
      ]
    )
    // Asked again by another player of the same lobby: served from memory.
    await service.games(asked, 'EUW1', 40)
    assert.deepEqual(reads, [['p1', 'p2']])
    // Read again once the entry is old.
    now += 6 * 60 * 1000
    await service.games(asked, 'EUW1', 40)
    assert.lengthOf(reads, 2)
  })
})
