import { BaseSchema } from 'adonisjs-clickhouse/schema'

/**
 * Pre-counted lane phase of every lane pair, like the cells of migrations 0013 and 0014: per
 * patch, one row per crawled seed tier, platform, role, champion and lane opponent, so the
 * matchups answer sums a few rows instead of reading the timeline of a champion's games.
 *
 * - `stats_lane_early`: the champion against that opponent at 15 minutes: games with both
 *   frames, the CS (lane and jungle), gold and experience gaps summed (signed), the games it led
 *   in gold with their wins, and its kills and assists before 15 minutes with its team's kills
 *   (kill participation is the ratio of the two sums).
 * - `stats_lane_counts`: when each patch was last counted into it.
 *
 * `stats_cells.ts` counts a patch into the `_next` copy a platform at a time, then swaps the
 * partition in. Like the early game, the newest patches are counted daily and the older ones once.
 */

const LANE_EARLY = `(
    patch      LowCardinality(String),
    seed_tier  LowCardinality(String),
    platform   LowCardinality(String),
    position   LowCardinality(String),
    champion   UInt16,
    opponent   UInt16,
    games      UInt32,
    cs_diff    Int64,
    gold_diff  Int64,
    xp_diff    Int64,
    ahead      UInt32,
    ahead_wins UInt32,
    involved   UInt32,
    team_kills UInt32
  )
  ENGINE = MergeTree
  PARTITION BY patch
  ORDER BY (patch, position, champion, opponent, seed_tier, platform)`

const COUNTS = `(
    patch     LowCardinality(String),
    refreshed DateTime
  )
  ENGINE = ReplacingMergeTree(refreshed)
  ORDER BY patch`

export default class extends BaseSchema {
  async up() {
    await this.client.command({
      query: `CREATE TABLE IF NOT EXISTS stats_lane_early ${LANE_EARLY}`,
    })
    await this.client.command({
      query: `CREATE TABLE IF NOT EXISTS stats_lane_early_next ${LANE_EARLY}`,
    })
    await this.client.command({ query: `CREATE TABLE IF NOT EXISTS stats_lane_counts ${COUNTS}` })
  }

  async down() {
    await this.client.command({ query: 'DROP TABLE IF EXISTS stats_lane_counts' })
    await this.client.command({ query: 'DROP TABLE IF EXISTS stats_lane_early_next' })
    await this.client.command({ query: 'DROP TABLE IF EXISTS stats_lane_early' })
  }
}
