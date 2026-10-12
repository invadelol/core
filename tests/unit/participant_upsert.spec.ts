import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import summonerService from '#services/summoner_service'

const puuid = (tag: string) => `upsert-${tag}-${randomUUID()}`.padEnd(78, 'x').slice(0, 78)

test.group('Participant upsert', (group) => {
  const created: string[] = []
  group.each.teardown(async () => {
    await db.from('riot_player').whereIn('puuid', created.splice(0)).delete()
  })

  test('writes a batch in two statements and leaves unchanged players alone', async ({
    assert,
  }) => {
    const [kept, recased, fresh] = ['kept', 'recased', 'fresh'].map(puuid)
    created.push(kept, recased, fresh)
    const player = (id: string, gameName: string) => ({
      puuid: id,
      gameName,
      tagLine: 'EUW',
      profileIconId: 7,
      summonerLevel: 30,
    })
    await summonerService.upsertFromParticipants(
      [player(kept, `Kept ${kept.slice(-6)}`), player(recased, `case ${recased.slice(-6)}`)],
      'EUW1'
    )
    const version = async () => {
      const row = await db
        .from('riot_player')
        .select(db.raw('ctid::text as ctid'))
        .where('puuid', kept)
        .first()
      return row.ctid
    }
    const before = await version()

    const statements: string[] = []
    const listener = (query: { sql: string }) => statements.push(query.sql)
    db.connection().getWriteClient().on('query', listener)
    try {
      const stored = await summonerService.upsertFromParticipants(
        [
          player(kept, `Kept ${kept.slice(-6)}`),
          player(recased, `CASE ${recased.slice(-6)}`),
          player(fresh, `Fresh ${fresh.slice(-6)}`),
          player(fresh, `Fresh ${fresh.slice(-6)}`),
        ],
        'EUW1'
      )
      assert.equal(stored, 3)
    } finally {
      db.connection().getWriteClient().off('query', listener)
    }

    // The select that decides history, the upsert, the history insert. (Staged
    // desktop snapshots are looked up for the new names in the background.)
    assert.lengthOf(
      statements.filter((sql) => !sql.includes('player_observation')),
      3
    )
    // Not rewritten: the same row version.
    assert.equal(await version(), before)
    const rows = await db
      .from('riot_player')
      .whereIn('puuid', [recased, fresh])
      .orderBy('puuid')
      .select('puuid', 'game_name')
    assert.deepEqual(
      rows.map((row) => row.game_name).sort(),
      [`CASE ${recased.slice(-6)}`, `Fresh ${fresh.slice(-6)}`].sort()
    )
    const history = await db
      .from('riot_player_history')
      .whereIn('puuid', [kept, recased, fresh])
      .count('* as total')
      .first()
    // First batch: kept and recased. Second: the new name of recased, and fresh once.
    assert.equal(Number(history.total), 4)
  })
})
