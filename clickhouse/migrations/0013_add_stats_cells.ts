import { BaseSchema } from 'adonisjs-clickhouse/schema'

/**
 * Pre-counted champion statistics: a filter of the champion pages and of the desktop app's
 * matchups (patch, rank bracket, region) sums a few thousand counted rows instead of joining a
 * whole patch's games at request time (seconds per filter before, milliseconds now).
 *
 * Each table holds, per patch, one row per crawled seed tier and platform ("cell"): a bracket is
 * a set of seed tiers and a region a set of platforms, so any filter is a sum of cells, and the
 * sums equal the per-game filters (`match_seed` holds one row per game).
 *
 * - `stats_lane_pairs`: champion against its lane opponent, games and wins of the champion.
 * - `stats_champion_roles`: champion in a role, games and wins (the tier list's records).
 * - `stats_cell_counts`: crawled games of the cell (`champion` 0) and games each champion was
 *   banned in; `refreshed` says when the patch was last counted.
 *
 * `stats_cells.ts` counts a patch into the `_next` copy of each table, then swaps the partition in
 * (`REPLACE PARTITION`): readers see the old count or the new one, never half of it. The tables
 * start empty; until a patch is counted the services read the games as before.
 */

const TABLES: Record<string, string> = {
  stats_lane_pairs: `(
      patch     LowCardinality(String),
      seed_tier LowCardinality(String),
      platform  LowCardinality(String),
      position  LowCardinality(String),
      champion  UInt16,
      opponent  UInt16,
      games     UInt32,
      wins      UInt32
    )
    ENGINE = MergeTree
    PARTITION BY patch
    ORDER BY (patch, position, champion, opponent, seed_tier, platform)`,
  stats_champion_roles: `(
      patch     LowCardinality(String),
      seed_tier LowCardinality(String),
      platform  LowCardinality(String),
      position  LowCardinality(String),
      champion  UInt16,
      games     UInt32,
      wins      UInt32
    )
    ENGINE = MergeTree
    PARTITION BY patch
    ORDER BY (patch, seed_tier, platform, position, champion)`,
  stats_cell_counts: `(
      patch     LowCardinality(String),
      seed_tier LowCardinality(String),
      platform  LowCardinality(String),
      champion  UInt16,
      games     UInt32,
      refreshed DateTime
    )
    ENGINE = MergeTree
    PARTITION BY patch
    ORDER BY (patch, seed_tier, platform, champion)`,
}

export default class extends BaseSchema {
  async up() {
    for (const [name, body] of Object.entries(TABLES)) {
      await this.client.command({ query: `CREATE TABLE IF NOT EXISTS ${name} ${body}` })
      await this.client.command({ query: `CREATE TABLE IF NOT EXISTS ${name}_next ${body}` })
    }
  }

  async down() {
    for (const name of Object.keys(TABLES)) {
      await this.client.command({ query: `DROP TABLE IF EXISTS ${name}_next` })
      await this.client.command({ query: `DROP TABLE IF EXISTS ${name}` })
    }
  }
}
