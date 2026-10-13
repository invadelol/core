import clickhouse from 'adonisjs-clickhouse/services/main'
import logger from '@adonisjs/core/services/logger'
import { asString, escapeClickhouseString } from '#utils/clickhouse'
import type { LensEvent, LensFrame, LensRole } from '../../../inertia/lib/lens.js'

/** One positional result set (see `columns.ts`). */
async function rows(query: string): Promise<unknown[][]> {
  const result = await clickhouse.query({ query, format: 'JSONCompactEachRow' })
  return (await result.json<unknown[]>()) ?? []
}

const number = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** The minutes of a timeline the Lens reads: CS at 10, deaths before 14, gold at 15. */
export const LENS_MINUTES = [10, 14, 15] as const
/** Games the main role is read from. */
const ROLE_SAMPLE = 100

export interface LensWindow {
  puuid: string
  queueIds: readonly number[]
  role: LensRole
  count: number
}

/**
 * The reads behind a player's Lens that the match list does not make: the roles they play, and
 * the minute frames and events of the games in their window.
 *
 * The window is the same subquery as the match list's (the player's newest games of a role,
 * `match_id` breaking ties), inlined into each read so all of them start at once. Both timeline
 * tables are ordered by match first, so the `IN` set prunes them to the window's games.
 */
export class LensRepository {
  private window({ puuid, queueIds, role, count }: LensWindow) {
    const queues = queueIds.length ? `AND queue_id IN (${queueIds.map(Number).join(',')})` : ''
    return `
      SELECT match_id
      FROM participants
      PREWHERE puuid = '${escapeClickhouseString(puuid)}'
      WHERE team_position = '${escapeClickhouseString(role)}' ${queues}
      ORDER BY game_start_ms DESC, match_id DESC
      LIMIT ${Math.max(1, Math.trunc(count) || 1)}
    `
  }

  /** Games per role among the player's latest games of these queues (no role: ARAM, Arena). */
  async roles(puuid: string, queueIds: readonly number[]) {
    const queues = queueIds.length ? `AND queue_id IN (${queueIds.map(Number).join(',')})` : ''
    const result = await rows(`
      SELECT team_position, count() AS games
      FROM (
        SELECT team_position
        FROM participants
        PREWHERE puuid = '${escapeClickhouseString(puuid)}'
        WHERE 1=1 ${queues}
        ORDER BY game_start_ms DESC, match_id DESC
        LIMIT ${ROLE_SAMPLE}
      )
      WHERE team_position != ''
      GROUP BY team_position
    `)
    return result.map((row) => ({ role: asString(row[0]), games: number(row[1]) }))
  }

  /** Every player's frame at the Lens's minutes, in the window's games that have a timeline. */
  async frames(window: LensWindow): Promise<LensFrame[]> {
    const result = await rows(`
      SELECT match_id, puuid, participant_id, intDiv(frame_ms, 60000) AS minute,
             cs + jungle_cs, gold_total, xp, deaths
      FROM match_timeline
      WHERE match_id IN (${this.window(window)})
        AND intDiv(frame_ms, 60000) IN (${LENS_MINUTES.join(',')})
      LIMIT 1 BY match_id, participant_id, minute
    `)
    return result.map((row) => ({
      matchId: asString(row[0]),
      puuid: asString(row[1]),
      participantId: number(row[2]),
      minute: number(row[3]),
      cs: number(row[4]),
      gold: number(row[5]),
      xp: number(row[6]),
      deaths: number(row[7]),
    }))
  }

  /** Kills and epic monsters of the window's games. Optional: older games have none. */
  async events(window: LensWindow): Promise<LensEvent[]> {
    try {
      const result = await rows(`
        SELECT DISTINCT match_id, t_ms, kind, killer, victim, assists
        FROM match_events
        WHERE match_id IN (${this.window(window)})
          AND kind IN ('kill', 'dragon', 'herald', 'baron')
      `)
      return result.map((row) => ({
        matchId: asString(row[0]),
        t: Math.round(number(row[1]) / 1000),
        kind: asString(row[2]),
        killer: number(row[3]),
        victim: number(row[4]),
        assists: Array.isArray(row[5]) ? row[5].map(number) : [],
      }))
    } catch (error) {
      logger.warn({ err: error }, 'lens events unavailable')
      return []
    }
  }
}

export default new LensRepository()
