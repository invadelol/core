import { BaseSchema } from 'adonisjs-clickhouse/schema'

export default class extends BaseSchema {
  async up() {
    await this.client.command({
      query: `
        CREATE TABLE IF NOT EXISTS match_timeline (
          match_id        String,
          platform        LowCardinality(String),
          game_start_ms   UInt64,
          frame_ms        UInt32,

          participant_id  UInt8,
          puuid           String,
          team_id         UInt16,

          spell1          UInt16,
          spell2          UInt16,

          primary_style   UInt16,
          secondary_style UInt16,
          keystone        UInt16,
          rune1           UInt16,
          rune2           UInt16,
          rune3           UInt16,
          rune4           UInt16,
          rune5           UInt16,
          rune6           UInt16,

          stat_offense    UInt16,
          stat_flex       UInt16,
          stat_defense    UInt16,

          skill_order     Array(UInt8),

          level           UInt8,
          xp              UInt32,
          gold_current    UInt32,
          gold_total      UInt32,
          gold_per_sec    Float32,

          cs              UInt16,
          jungle_cs       UInt16,

          kills           UInt8,
          deaths          UInt8,
          assists         UInt8,

          pos_x           UInt16,
          pos_y           UInt16,

          time_cc         UInt32,

          ingested_at     DateTime DEFAULT now()
        )
        ENGINE = MergeTree
        PARTITION BY toYYYYMM(toDateTime(game_start_ms / 1000))
        ORDER BY (platform, match_id, participant_id, frame_ms)
      `,
    })
  }

  async down() {
    await this.client.command({ query: 'DROP TABLE IF EXISTS match_timeline' })
  }
}
