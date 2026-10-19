import { BaseSchema } from 'adonisjs-clickhouse/schema'

/**
 * Column codecs instead of the default LZ4: about -46% on match_timeline and -34% on match_events
 * on the production data (October 2026), lossless (checksums of every column identical).
 *
 * Delta suits the per-player counters that only grow minute to minute (xp, gold, cs, kills...),
 * T64 the small integers, ZSTD the rest. participants keeps LZ4 on every column the profile and
 * match pages read, since ZSTD made those lookups slower; only the columns no page reads change.
 *
 * A codec only changes how new parts are written: existing parts keep theirs until they are merged
 * or rewritten (`ALTER TABLE ... REWRITE PARTS`). Types are restated as they are: no data change.
 */
const codecs: Record<string, Record<string, [type: string, codec: string]>> = {
  match_timeline: {
    match_id: ['String', 'ZSTD(9)'],
    platform: ['LowCardinality(String)', 'ZSTD(3)'],
    game_start_ms: ['UInt64', 'ZSTD(9)'],
    frame_ms: ['UInt32', 'Delta, ZSTD(9)'],
    participant_id: ['UInt8', 'LZ4HC(9)'],
    puuid: ['String', 'ZSTD(3)'],
    team_id: ['UInt16', 'ZSTD(1)'],
    spell1: ['UInt16', 'ZSTD(1)'],
    spell2: ['UInt16', 'ZSTD(1)'],
    primary_style: ['UInt16', 'ZSTD(1)'],
    secondary_style: ['UInt16', 'ZSTD(1)'],
    keystone: ['UInt16', 'ZSTD(1)'],
    rune1: ['UInt16', 'ZSTD(1)'],
    rune2: ['UInt16', 'ZSTD(1)'],
    rune3: ['UInt16', 'ZSTD(1)'],
    rune4: ['UInt16', 'ZSTD(1)'],
    rune5: ['UInt16', 'ZSTD(1)'],
    rune6: ['UInt16', 'ZSTD(1)'],
    stat_offense: ['UInt16', 'ZSTD(1)'],
    stat_flex: ['UInt16', 'ZSTD(1)'],
    stat_defense: ['UInt16', 'ZSTD(1)'],
    skill_order: ['Array(UInt8)', 'ZSTD(12)'],
    level: ['UInt8', 'Delta, ZSTD(9)'],
    xp: ['UInt32', 'Delta, T64, ZSTD(9)'],
    gold_current: ['UInt32', 'T64, ZSTD(3)'],
    gold_total: ['UInt32', 'Delta, T64, ZSTD(9)'],
    gold_per_sec: ['Float32', 'ZSTD(9)'],
    cs: ['UInt16', 'Delta, T64, ZSTD(9)'],
    jungle_cs: ['UInt16', 'Delta, ZSTD(9)'],
    kills: ['UInt8', 'Delta, ZSTD(9)'],
    deaths: ['UInt8', 'Delta, ZSTD(9)'],
    assists: ['UInt8', 'Delta, ZSTD(9)'],
    pos_x: ['UInt16', 'T64, ZSTD(3)'],
    pos_y: ['UInt16', 'T64, ZSTD(3)'],
    time_cc: ['UInt32', 'Delta, T64, ZSTD(9)'],
    ingested_at: ['DateTime', 'ZSTD(9)'],
  },
  match_events: {
    platform: ['LowCardinality(String)', 'ZSTD(3)'],
    game_start_ms: ['UInt64', 'ZSTD(3)'],
    ingested_at: ['DateTime', 'ZSTD(9)'],
    t_ms: ['UInt32', 'Delta, ZSTD(3)'],
    assists: ['Array(UInt8)', 'ZSTD(1)'],
    team_id: ['UInt16', 'T64, ZSTD(9)'],
    killer: ['UInt8', 'ZSTD(1)'],
    victim: ['UInt8', 'ZSTD(1)'],
  },
  participants: {
    ingested_at: ['DateTime', 'ZSTD(9)'],
    lane: ['LowCardinality(String)', 'ZSTD(3)'],
    role_item: ['UInt16', 'ZSTD(1)'],
    physical_dmg_dealt: ['UInt32', 'T64, ZSTD(3)'],
    magic_dmg_dealt: ['UInt32', 'T64, ZSTD(3)'],
    true_dmg_dealt: ['UInt32', 'T64, ZSTD(3)'],
    neutral_minions_killed: ['UInt16', 'T64, ZSTD(3)'],
    all_in_pings: ['UInt16', 'T64, ZSTD(3)'],
    assist_pings: ['UInt16', 'ZSTD(1)'],
    command_pings: ['UInt16', 'T64, ZSTD(3)'],
    danger_pings: ['UInt16', 'T64, ZSTD(3)'],
    enemy_missing_pings: ['UInt16', 'T64, ZSTD(3)'],
    enemy_vision_pings: ['UInt16', 'T64, ZSTD(3)'],
    get_back_pings: ['UInt16', 'T64, ZSTD(3)'],
    need_vision_pings: ['UInt16', 'T64, ZSTD(3)'],
    on_my_way_pings: ['UInt16', 'T64, ZSTD(3)'],
    push_pings: ['UInt16', 'T64, ZSTD(3)'],
    vision_cleared_pings: ['UInt16', 'ZSTD(1)'],
    bait_pings: ['UInt16', 'ZSTD(1)'],
    hold_pings: ['UInt16', 'ZSTD(1)'],
  },
}

export default class extends BaseSchema {
  async up() {
    for (const [table, columns] of Object.entries(codecs)) {
      const changes = Object.entries(columns).map(
        ([column, [type, codec]]) => `MODIFY COLUMN ${column} ${type} CODEC(${codec})`
      )
      await this.client.command({ query: `ALTER TABLE ${table} ${changes.join(', ')}` })
    }
  }

  async down() {
    for (const [table, columns] of Object.entries(codecs)) {
      const changes = Object.keys(columns).map((column) => `MODIFY COLUMN ${column} REMOVE CODEC`)
      await this.client.command({ query: `ALTER TABLE ${table} ${changes.join(', ')}` })
    }
  }
}
