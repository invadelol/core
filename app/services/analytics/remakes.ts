import { escapeClickhouseString } from '#utils/clickhouse'
import { REMAKE_SECONDS } from '../../../inertia/lib/match.js'

/**
 * A ClickHouse condition on `participants` rows that leaves out remakes: games that ended
 * before `REMAKE_SECONDS`, which count as no result (not a win, not a loss, not in any average).
 *
 * `participants` holds no duration, so the remakes among the players' games are read from
 * `matches` by match id: the same pruned `IN` lookup the summaries already make for durations.
 * Put it before any `LIMIT`, so a window of N games is N games that were played.
 */
export function notRemake(puuids: string | readonly string[]) {
  const list = (typeof puuids === 'string' ? [puuids] : puuids)
    .map((puuid) => `'${escapeClickhouseString(puuid)}'`)
    .join(',')
  return `match_id NOT IN (
    SELECT match_id FROM matches
    WHERE match_id IN (SELECT match_id FROM participants PREWHERE puuid IN (${list}))
      AND duration_sec < ${REMAKE_SECONDS}
  )`
}
