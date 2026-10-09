import { BaseSchema } from 'adonisjs-clickhouse/schema'

/**
 * The events a match timeline is read from: champion kills (killer, victim, assists, where) and
 * objectives (epic monsters and buildings, with the team that took them). Item purchases, wards
 * and skill-ups stay out: the match page never shows them and they are most of a timeline.
 *
 * ReplacingMergeTree: a match whose events are backfilled while a sync stores it ends up with
 * the same rows twice, which merges collapse (reads also select DISTINCT).
 */
export default class extends BaseSchema {
  async up() {
    await this.client.command({
      query: `
        CREATE TABLE IF NOT EXISTS match_events (
          match_id        String,
          platform        LowCardinality(String),
          game_start_ms   UInt64,
          t_ms            UInt32,

          kind            LowCardinality(String),
          sub             LowCardinality(String),
          lane            LowCardinality(String),
          team_id         UInt16,

          killer          UInt8,
          victim          UInt8,
          assists         Array(UInt8),

          pos_x           UInt16,
          pos_y           UInt16,

          ingested_at     DateTime DEFAULT now()
        )
        ENGINE = ReplacingMergeTree(ingested_at)
        PARTITION BY toYYYYMM(toDateTime(game_start_ms / 1000))
        ORDER BY (platform, match_id, t_ms, kind, killer, victim)
      `,
    })
  }

  async down() {
    await this.client.command({ query: 'DROP TABLE IF EXISTS match_events' })
  }
}
