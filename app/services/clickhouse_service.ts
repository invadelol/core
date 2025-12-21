import clickhouse from 'adonisjs-clickhouse/services/main'
import {
  toInt,
  asString,
  escapeClickhouseString,
  platformFromMatchId,
  buildMatchRow,
  buildParticipantRows,
} from '#utils/clickhouse'

export type IngestedMatchMeta = {
  platform: string
  gameStartMs: number
}

export class ClickhouseService {
  /**
   * Returns the subset of matchIds that already exist in ClickHouse.
   */
  async getExistingMatchIds(matchIds: string[]): Promise<Set<string>> {
    const unique = Array.from(new Set(matchIds.filter(Boolean)))
    if (!unique.length) return new Set()

    const inList = unique.map((id) => `'${escapeClickhouseString(id)}'`).join(',')
    const result = await clickhouse.query({
      query: `SELECT match_id FROM matches WHERE match_id IN (${inList})`,
      format: 'JSONEachRow',
    })

    const rows = (await result.json<{ match_id: string }>()) ?? []
    return new Set(rows.map((r) => asString(r.match_id)).filter(Boolean))
  }

  async ingestMatch(matchId: string, matchData: any): Promise<IngestedMatchMeta> {
    const info = matchData?.info ?? {}
    const platform =
      (typeof info.platformId === 'string' && info.platformId) || platformFromMatchId(matchId) || ''
    const gameStartMs = toInt(info.gameStartTimestamp ?? info.gameCreation ?? 0, 0)

    const matchRow = buildMatchRow(matchId, platform, gameStartMs, info)
    const participantRows = buildParticipantRows(matchId, platform, gameStartMs, info)

    await clickhouse.insert({
      table: 'matches',
      values: [matchRow],
      format: 'JSONEachRow',
    })

    if (participantRows.length) {
      await clickhouse.insert({
        table: 'participants',
        values: participantRows,
        format: 'JSONEachRow',
      })
    }

    return { platform, gameStartMs }
  }
}

export default new ClickhouseService()
