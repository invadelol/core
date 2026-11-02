import { BaseSchema } from 'adonisjs-clickhouse/schema'

/**
 * Pre-counted early game and first blood, like the cells of migration 0013: per patch, one row
 * per crawled seed tier, platform, role and champion, so the desktop app's statistics route sums
 * a few rows instead of reading the timeline or the kill events of a champion's games at request
 * time (a popular champion's games touch a quarter of a patch's timeline: half a minute).
 *
 * - `stats_early`: the champion at minute 10 and 15 against its lane opponent: games, its CS
 *   (lane and jungle), gold and experience summed, the same three as signed gaps, and the games
 *   it led and trailed in gold with their wins.
 * - `stats_first_blood`: the champion's games with a kill event, the games it took first blood,
 *   assisted it, gave it, and the wins of the games it was part of.
 * - `stats_event_counts`: when each patch was last counted into the two.
 *
 * `stats_cells.ts` counts a patch into the `_next` copies a platform at a time, then swaps the
 * partitions in. Reading every frame of a patch is heavy (a few minutes), so the newest patches
 * are counted daily and the older ones once.
 */

const TABLES: Record<string, string> = {
  stats_early: `(
      patch       LowCardinality(String),
      seed_tier   LowCardinality(String),
      platform    LowCardinality(String),
      position    LowCardinality(String),
      champion    UInt16,
      minute      UInt8,
      games       UInt32,
      cs          UInt64,
      gold        UInt64,
      xp          UInt64,
      cs_diff     Int64,
      gold_diff   Int64,
      xp_diff     Int64,
      ahead       UInt32,
      ahead_wins  UInt32,
      behind      UInt32,
      behind_wins UInt32
    )
    ENGINE = MergeTree
    PARTITION BY patch
    ORDER BY (patch, position, champion, minute, seed_tier, platform)`,
  stats_first_blood: `(
      patch         LowCardinality(String),
      seed_tier     LowCardinality(String),
      platform      LowCardinality(String),
      position      LowCardinality(String),
      champion      UInt16,
      games         UInt32,
      kills         UInt32,
      assists       UInt32,
      victims       UInt32,
      involved_wins UInt32
    )
    ENGINE = MergeTree
    PARTITION BY patch
    ORDER BY (patch, position, champion, seed_tier, platform)`,
}

const COUNTS = `(
    patch     LowCardinality(String),
    refreshed DateTime
  )
  ENGINE = ReplacingMergeTree(refreshed)
  ORDER BY patch`

export default class extends BaseSchema {
  async up() {
    for (const [name, body] of Object.entries(TABLES)) {
      await this.client.command({ query: `CREATE TABLE IF NOT EXISTS ${name} ${body}` })
      await this.client.command({ query: `CREATE TABLE IF NOT EXISTS ${name}_next ${body}` })
    }
    await this.client.command({ query: `CREATE TABLE IF NOT EXISTS stats_event_counts ${COUNTS}` })
  }

  async down() {
    await this.client.command({ query: 'DROP TABLE IF EXISTS stats_event_counts' })
    for (const name of Object.keys(TABLES)) {
      await this.client.command({ query: `DROP TABLE IF EXISTS ${name}_next` })
      await this.client.command({ query: `DROP TABLE IF EXISTS ${name}` })
    }
  }
}
