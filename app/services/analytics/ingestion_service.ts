import clickhouse from 'adonisjs-clickhouse/services/main'
import {
  toInt,
  platformFromMatchId,
  buildMatchRow,
  buildParticipantRows,
  buildTimelineRows,
} from '#utils/clickhouse'
import { RiotAPITypes } from '@fightmegg/riot-api'

/**
 * Service for ingesting match data into ClickHouse
 */
export class IngestionService {
  /**
   * Ingest a match and its participants into ClickHouse
   */
  async ingestMatch(
    matchId: string,
    matchData: RiotAPITypes.MatchV5.MatchDTO
  ): Promise<{
    platform: string
    gameStartMs: number
  }> {
    const info = matchData.info
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

  async ingestTimeline(
    matchId: string,
    matchData: RiotAPITypes.MatchV5.MatchDTO,
    timelineData: RiotAPITypes.MatchV5.MatchTimelineDTO,
    meta?: { platform?: string; gameStartMs?: number }
  ) {
    const info = matchData.info
    const platform =
      meta?.platform ||
      (typeof info.platformId === 'string' && info.platformId) ||
      platformFromMatchId(matchId) ||
      ''
    const gameStartMs =
      meta?.gameStartMs ?? toInt(info.gameStartTimestamp ?? info.gameCreation ?? 0, 0)

    const timelineRows = buildTimelineRows(matchId, platform, gameStartMs, info, timelineData)

    if (timelineRows.length) {
      await clickhouse.insert({
        table: 'match_timeline',
        values: timelineRows,
        format: 'JSONEachRow',
      })
    }
  }
}

export default new IngestionService()
