import clickhouse from 'adonisjs-clickhouse/services/main'
import {
  toInt,
  platformFromMatchId,
  buildMatchRow,
  buildParticipantRows,
  buildTimelineRows,
  buildEventRows,
  skillOrders,
} from '#utils/clickhouse'
import { RiotAPITypes } from '@fightmegg/riot-api'

/**
 * Service for ingesting match data into ClickHouse
 */
export class IngestionService {
  /**
   * Ingest a match and its participants into ClickHouse. With its timeline, each participant row
   * keeps the player's skill order (`participants.skill_order`), which the timeline's frames are
   * read from; a game stored without one keeps empty skill orders for good, even when its timeline
   * is stored later (ClickHouse rewrites no rows for that).
   */
  async ingestMatch(
    matchId: string,
    matchData: RiotAPITypes.MatchV5.MatchDTO,
    timelineData?: RiotAPITypes.MatchV5.MatchTimelineDTO | null
  ): Promise<{
    platform: string
    gameStartMs: number
  }> {
    const info = matchData.info
    const platform =
      (typeof info.platformId === 'string' && info.platformId) || platformFromMatchId(matchId) || ''
    const gameStartMs = toInt(info.gameStartTimestamp ?? info.gameCreation ?? 0, 0)

    const matchRow = buildMatchRow(matchId, platform, gameStartMs, info)
    const participantRows = buildParticipantRows(
      matchId,
      platform,
      gameStartMs,
      info,
      timelineData ? skillOrders(timelineData) : undefined
    )

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

    await this.ingestFrames(matchId, platform, gameStartMs, info, timelineData)

    const participants: any[] = Array.isArray(info?.participants) ? info.participants : []
    const teamOf = new Map(
      participants.map((p: any) => [toInt(p.participantId ?? 0, 0), toInt(p.teamId ?? 0, 0)])
    )
    await this.ingestEvents(matchId, platform, gameStartMs, timelineData, teamOf)
  }

  /**
   * Per-minute participant frames of a timeline (`match_timeline`). Also used on its own to
   * backfill a match whose frames were not stored with it.
   */
  async ingestFrames(
    matchId: string,
    platform: string,
    gameStartMs: number,
    info: RiotAPITypes.MatchV5.MatchInfoDTO,
    timelineData: RiotAPITypes.MatchV5.MatchTimelineDTO
  ) {
    const rows = buildTimelineRows(matchId, platform, gameStartMs, info, timelineData)
    if (rows.length) {
      await clickhouse.insert({ table: 'match_timeline', values: rows, format: 'JSONEachRow' })
    }
    return rows.length
  }

  /**
   * Kill, objective and shop events of a timeline (`match_events`). Also used on its own to backfill
   * the events of a match stored before they were kept.
   */
  async ingestEvents(
    matchId: string,
    platform: string,
    gameStartMs: number,
    timelineData: RiotAPITypes.MatchV5.MatchTimelineDTO,
    teamOf: Map<number, number>
  ) {
    const rows = buildEventRows(matchId, platform, gameStartMs, timelineData, teamOf)
    if (rows.length) {
      await clickhouse.insert({ table: 'match_events', values: rows, format: 'JSONEachRow' })
    }
    return rows.length
  }
}

export default new IngestionService()
