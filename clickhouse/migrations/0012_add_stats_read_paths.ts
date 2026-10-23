import { BaseSchema } from 'adonisjs-clickhouse/schema'

/**
 * Read paths for the champion statistics (`champion_stats.ts`, rune pages, summoner spells):
 * every per-champion query reads one champion's rows instead of scanning a whole table.
 *
 * - `participants.by_champion`: a projection sorted by champion, role and time, with the columns
 *   the champion pages read, runes, shards and skill order included (0011 put them on the
 *   participant row). `participants` is sorted by player, so without it one champion's games are
 *   spread over the whole table. ClickHouse keeps it in step with the table and picks it by itself.
 * - `match_lineups`: who played where in each crawled game (`participant_items`), for lane
 *   opponents and teammates. Kept by a materialized view.
 *
 * `match_lineups` merges its rows with `groupUniqArrayArray`, which gives the same answer however
 * often a row is written: a game inserted twice, or written by the view while the backfill below
 * runs, changes nothing. Plain values, not aggregate states: they read 3x faster.
 *
 * About 450 MB on disk in all (October 2026: the projection's columns hold 366 MiB in
 * `participants`). The projection is built by a background mutation: until a part has it, that
 * part is read as before, so the pages are right all along and fast once it is done.
 */

/** Long statements report progress so the HTTP connection is never idle long enough to drop. */
const LONG = {
  send_progress_in_http_headers: 1,
  http_headers_progress_interval_ms: '10000',
  max_execution_time: 0,
} as const

const LINEUP_SELECT = `
  SELECT patch, match_id,
    groupUniqArray(tuple(participant_id, team_id, toString(team_position), champion_id)) AS players
  FROM participant_items
  WHERE queue_id = 420`

export default class extends BaseSchema {
  async up() {
    await this.client.command({
      query: `ALTER TABLE participants ADD PROJECTION IF NOT EXISTS by_champion (
        SELECT queue_id, champion_id, team_position, game_start_ms, match_id, participant_id, win,
               spell1, spell2, kills, deaths, assists, total_cs, gold_earned, dmg_to_champ, vision_score,
               primary_style, rune1, rune2, rune3, rune4, secondary_style, rune5, rune6,
               stat_offense, stat_flex, stat_defense, skill_order
        ORDER BY (queue_id, champion_id, team_position, game_start_ms)
      )`,
    })
    await this.client.command({
      query: 'ALTER TABLE participants MATERIALIZE PROJECTION by_champion',
    })

    await this.client.command({
      query: `
        CREATE TABLE IF NOT EXISTS match_lineups (
          patch    LowCardinality(String),
          match_id String,
          players  SimpleAggregateFunction(groupUniqArrayArray,
                     Array(Tuple(UInt8, UInt16, String, UInt16))) CODEC(ZSTD(3))
        )
        ENGINE = AggregatingMergeTree
        PARTITION BY patch
        ORDER BY (patch, match_id)
      `,
    })
    await this.client.command({
      query: `CREATE MATERIALIZED VIEW IF NOT EXISTS match_lineups_mv TO match_lineups AS
        ${LINEUP_SELECT} GROUP BY patch, match_id`,
    })
    // The games written before the view existed.
    await this.client.command({
      query: `INSERT INTO match_lineups ${LINEUP_SELECT} GROUP BY patch, match_id`,
      clickhouse_settings: LONG,
    })
  }

  async down() {
    await this.client.command({ query: 'DROP VIEW IF EXISTS match_lineups_mv' })
    await this.client.command({ query: 'DROP TABLE IF EXISTS match_lineups' })
    await this.client.command({
      query: 'ALTER TABLE participants DROP PROJECTION IF EXISTS by_champion',
    })
  }
}
