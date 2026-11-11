import { test } from '@japa/runner'
import lobbyGamesService from '#services/lobby_games_service'

test.group('Lobby games', (group) => {
  const games = lobbyGamesService.games
  group.each.teardown(() => {
    lobbyGamesService.games = games
  })

  test('answers the stored games of the players sent in the body', async ({ client, assert }) => {
    let asked: unknown[] = []
    lobbyGamesService.games = async (players, platform, count) => {
      asked = [players, platform, count]
      return players.map((p) => ({ ...p, known: false, games: [] }))
    }
    const response = await client
      .post('/api/lobby/games')
      .json({ platform: 'euw1', players: [{ gameName: ' Northwind ', tagLine: 'EUW' }] })
    response.assertStatus(200)
    assert.deepEqual(asked, [[{ gameName: 'Northwind', tagLine: 'EUW' }], 'EUW1', 40])
    assert.deepEqual(response.body().players, [
      { gameName: 'Northwind', tagLine: 'EUW', known: false, games: [] },
    ])
    assert.equal(response.header('cache-control'), 'no-store')
  })

  test('refuses no player, more than ten, and more than forty games', async ({ client }) => {
    lobbyGamesService.games = async () => []
    const player = { gameName: 'Northwind', tagLine: 'EUW' }
    for (const body of [
      { players: [] },
      { players: Array.from({ length: 11 }, () => player) },
      { players: [player], count: 41 },
    ]) {
      const response = await client.post('/api/lobby/games').json(body)
      response.assertStatus(422)
    }
  })
})
