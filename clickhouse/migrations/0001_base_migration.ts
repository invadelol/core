import { BaseSchema } from 'adonisjs-clickhouse/schema'

export default class extends BaseSchema {
  async up() {
    await this.client.command({
      query: `
        CREATE TABLE IF NOT EXISTS matches (
          match_id        String,
          platform        LowCardinality(String),
          queue_id        UInt16,
          patch           LowCardinality(String),
          game_start_ms   UInt64,
          duration_sec    UInt16,
          map_id          UInt16,

          t1_win          UInt8,
          t2_win          UInt8,

          t1_towers       UInt8,
          t2_towers       UInt8,
          t1_inhibs       UInt8,
          t2_inhibs       UInt8,
          t1_dragons      UInt8,
          t2_dragons      UInt8,
          t1_barons       UInt8,
          t2_barons       UInt8,
          t1_heralds      UInt8,
          t2_heralds      UInt8,

          t1_bans         Array(UInt16),
          t2_bans         Array(UInt16),

          ingested_at     DateTime DEFAULT now()
        )
        ENGINE = MergeTree
        PARTITION BY toYYYYMM(toDateTime(game_start_ms / 1000))
        ORDER BY (platform, game_start_ms, match_id)
      `,
    })

    await this.client.command({
      query: `
        CREATE TABLE IF NOT EXISTS participants (
          match_id        String,
          platform        LowCardinality(String),

          game_start_ms   UInt64,

          puuid           String,
          team_id         UInt16,
          win             UInt8,

          champion_id     UInt16,
          team_position   LowCardinality(String),
          lane            LowCardinality(String),

          kills           UInt8,
          deaths          UInt8,
          assists         UInt8,
          champ_level     UInt8,

          total_cs        UInt16,
          gold_earned     UInt32,
          dmg_to_champ    UInt32,
          dmg_taken       UInt32,
          vision_score    UInt16,
          wards_placed    UInt16,
          wards_killed    UInt16,

          item0           UInt16,
          item1           UInt16,
          item2           UInt16,
          item3           UInt16,
          item4           UInt16,
          item5           UInt16,
          item6           UInt16,

          spell1          UInt16,
          spell2          UInt16,

          primary_style   UInt16,
          keystone        UInt16,
          secondary_style UInt16,

          ingested_at     DateTime DEFAULT now()
        )
        ENGINE = MergeTree
        PARTITION BY toYYYYMM(toDateTime(game_start_ms / 1000))
        ORDER BY (platform, puuid, game_start_ms, match_id)
      `,
    })
  }

  async down() {
    await this.client.command({ query: 'DROP TABLE IF EXISTS participants' })
    await this.client.command({ query: 'DROP TABLE IF EXISTS matches' })
  }
}
