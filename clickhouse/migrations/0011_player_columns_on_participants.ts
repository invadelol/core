import { BaseSchema } from 'adonisjs-clickhouse/schema'

/**
 * What a player keeps for the whole game moves from every timeline frame to their participant row,
 * and the tables are keyed for how they are read (October 2026):
 *
 * - `participants` gains `participant_id`, the six runes, the three shards and the game's whole
 *   `skill_order`, and is keyed by player (`puuid, game_start_ms, match_id`), without monthly
 *   partitions or skip indexes: a `_part_offset` projection ordered by `match_id` serves the reads
 *   by game. ZSTD(3) on every column but the ones 0009 gave another codec.
 * - `matches` is keyed by `match_id` alone, without partitions.
 * - `match_timeline` keeps only each frame's own numbers, plus `skill_points`: the frame's skill
 *   order is that prefix of the player's `participants.skill_order`. Spells, runes, shards, skill
 *   order and puuid are read from `participants`, joined by `(match_id, participant_id)`.
 * - `participant_items` (written by the crawler, never by this app) loses `puuid`, which no one reads.
 * - `match_events` gets the codecs measured on the production data.
 *
 * A table's key or partitioning cannot be altered: a table still keyed the old way is copied into
 * a new one and swapped with it (instant on a fresh database). The copy fills the new participant
 * columns from the timeline's first frame (runes) and last frame (skill order) while the timeline
 * still has them. Every step checks the current shape first, so on a database already in this
 * shape the migration changes nothing. The timeline columns are dropped only once no participant
 * row with a timeline lacks its participant id: elsewhere the migration stops and asks for that
 * backfill first.
 */

const PARTICIPANTS_KEY = 'puuid, game_start_ms, match_id'

/** Name, type with its default, codec: the whole table, in order. */
const PARTICIPANT_COLUMNS: [name: string, type: string, codec: string][] = [
  ['match_id', 'String', 'ZSTD(3)'],
  ['platform', 'LowCardinality(String)', 'ZSTD(3)'],
  ['game_start_ms', 'UInt64', 'ZSTD(3)'],
  ['queue_id', 'UInt16 DEFAULT 0', 'ZSTD(3)'],
  ['puuid', 'String', 'ZSTD(3)'],
  ['riot_id_game_name', "String DEFAULT ''", 'ZSTD(3)'],
  ['riot_id_tag_line', "LowCardinality(String) DEFAULT ''", 'ZSTD(3)'],
  ['profile_icon_id', 'UInt16 DEFAULT 0', 'ZSTD(3)'],
  ['summoner_level', 'UInt16 DEFAULT 0', 'ZSTD(3)'],
  ['team_id', 'UInt16', 'ZSTD(3)'],
  ['win', 'UInt8', 'ZSTD(3)'],
  ['champion_id', 'UInt16', 'ZSTD(3)'],
  ['team_position', 'LowCardinality(String)', 'ZSTD(3)'],
  ['lane', 'LowCardinality(String)', 'ZSTD(3)'],
  ['kills', 'UInt8', 'ZSTD(3)'],
  ['deaths', 'UInt8', 'ZSTD(3)'],
  ['assists', 'UInt8', 'ZSTD(3)'],
  ['champ_level', 'UInt8', 'ZSTD(3)'],
  ['total_cs', 'UInt16', 'ZSTD(3)'],
  ['gold_earned', 'UInt32', 'ZSTD(3)'],
  ['dmg_to_champ', 'UInt32', 'ZSTD(3)'],
  ['dmg_taken', 'UInt32', 'ZSTD(3)'],
  ['vision_score', 'UInt16', 'ZSTD(3)'],
  ['wards_placed', 'UInt16', 'ZSTD(3)'],
  ['wards_killed', 'UInt16', 'ZSTD(3)'],
  ['item0', 'UInt16', 'ZSTD(3)'],
  ['item1', 'UInt16', 'ZSTD(3)'],
  ['item2', 'UInt16', 'ZSTD(3)'],
  ['item3', 'UInt16', 'ZSTD(3)'],
  ['item4', 'UInt16', 'ZSTD(3)'],
  ['item5', 'UInt16', 'ZSTD(3)'],
  ['item6', 'UInt16', 'ZSTD(3)'],
  ['role_item', 'UInt16 DEFAULT 0', 'ZSTD(1)'],
  ['spell1', 'UInt16', 'ZSTD(3)'],
  ['spell2', 'UInt16', 'ZSTD(3)'],
  ['primary_style', 'UInt16', 'ZSTD(3)'],
  ['keystone', 'UInt16', 'ZSTD(3)'],
  ['secondary_style', 'UInt16', 'ZSTD(3)'],
  ['ingested_at', 'DateTime DEFAULT now()', 'ZSTD(9)'],
  ['dmg_to_turrets', 'UInt32 DEFAULT 0', 'ZSTD(3)'],
  ['dmg_to_objectives', 'UInt32 DEFAULT 0', 'ZSTD(3)'],
  ['physical_dmg_dealt', 'UInt32 DEFAULT 0', 'T64, ZSTD(3)'],
  ['magic_dmg_dealt', 'UInt32 DEFAULT 0', 'T64, ZSTD(3)'],
  ['true_dmg_dealt', 'UInt32 DEFAULT 0', 'T64, ZSTD(3)'],
  ['physical_dmg_to_champ', 'UInt32 DEFAULT 0', 'ZSTD(3)'],
  ['magic_dmg_to_champ', 'UInt32 DEFAULT 0', 'ZSTD(3)'],
  ['true_dmg_to_champ', 'UInt32 DEFAULT 0', 'ZSTD(3)'],
  ['neutral_minions_killed', 'UInt16 DEFAULT 0', 'T64, ZSTD(3)'],
  ['vision_wards_bought', 'UInt16 DEFAULT 0', 'ZSTD(3)'],
  ['all_in_pings', 'UInt16 DEFAULT 0', 'T64, ZSTD(3)'],
  ['assist_pings', 'UInt16 DEFAULT 0', 'ZSTD(1)'],
  ['command_pings', 'UInt16 DEFAULT 0', 'T64, ZSTD(3)'],
  ['danger_pings', 'UInt16 DEFAULT 0', 'T64, ZSTD(3)'],
  ['enemy_missing_pings', 'UInt16 DEFAULT 0', 'T64, ZSTD(3)'],
  ['enemy_vision_pings', 'UInt16 DEFAULT 0', 'T64, ZSTD(3)'],
  ['get_back_pings', 'UInt16 DEFAULT 0', 'T64, ZSTD(3)'],
  ['need_vision_pings', 'UInt16 DEFAULT 0', 'T64, ZSTD(3)'],
  ['on_my_way_pings', 'UInt16 DEFAULT 0', 'T64, ZSTD(3)'],
  ['push_pings', 'UInt16 DEFAULT 0', 'T64, ZSTD(3)'],
  ['vision_cleared_pings', 'UInt16 DEFAULT 0', 'ZSTD(1)'],
  ['bait_pings', 'UInt16 DEFAULT 0', 'ZSTD(1)'],
  ['hold_pings', 'UInt16 DEFAULT 0', 'ZSTD(1)'],
  ['participant_id', 'UInt8 DEFAULT 0', 'ZSTD(3)'],
  ['rune1', 'UInt16 DEFAULT 0', 'ZSTD(3)'],
  ['rune2', 'UInt16 DEFAULT 0', 'ZSTD(3)'],
  ['rune3', 'UInt16 DEFAULT 0', 'ZSTD(3)'],
  ['rune4', 'UInt16 DEFAULT 0', 'ZSTD(3)'],
  ['rune5', 'UInt16 DEFAULT 0', 'ZSTD(3)'],
  ['rune6', 'UInt16 DEFAULT 0', 'ZSTD(3)'],
  ['stat_offense', 'UInt16 DEFAULT 0', 'ZSTD(3)'],
  ['stat_flex', 'UInt16 DEFAULT 0', 'ZSTD(3)'],
  ['stat_defense', 'UInt16 DEFAULT 0', 'ZSTD(3)'],
  ['skill_order', 'Array(UInt8) DEFAULT []', 'ZSTD(9)'],
]

/** The participant columns this migration adds, all of them on the timeline until now. */
const PLAYER_COLUMNS = PARTICIPANT_COLUMNS.slice(
  PARTICIPANT_COLUMNS.findIndex(([name]) => name === 'participant_id')
)

/** The per-player timeline columns that move to `participants`, with their type and 0009 codec. */
const TIMELINE_PLAYER_COLUMNS: [name: string, type: string, codec: string][] = [
  ['puuid', 'String', 'ZSTD(3)'],
  ['spell1', 'UInt16', 'ZSTD(1)'],
  ['spell2', 'UInt16', 'ZSTD(1)'],
  ['primary_style', 'UInt16', 'ZSTD(1)'],
  ['secondary_style', 'UInt16', 'ZSTD(1)'],
  ['keystone', 'UInt16', 'ZSTD(1)'],
  ['rune1', 'UInt16', 'ZSTD(1)'],
  ['rune2', 'UInt16', 'ZSTD(1)'],
  ['rune3', 'UInt16', 'ZSTD(1)'],
  ['rune4', 'UInt16', 'ZSTD(1)'],
  ['rune5', 'UInt16', 'ZSTD(1)'],
  ['rune6', 'UInt16', 'ZSTD(1)'],
  ['stat_offense', 'UInt16', 'ZSTD(1)'],
  ['stat_flex', 'UInt16', 'ZSTD(1)'],
  ['stat_defense', 'UInt16', 'ZSTD(1)'],
  ['skill_order', 'Array(UInt8)', 'ZSTD(12)'],
]

/** `match_events` codecs; `match_id` had none before, which is how a database without them shows. */
const EVENT_CODECS: Record<string, [type: string, codec: string]> = {
  match_id: ['String', 'ZSTD(3)'],
  kind: ['LowCardinality(String)', 'ZSTD(3)'],
  sub: ['LowCardinality(String)', 'ZSTD(3)'],
  lane: ['LowCardinality(String)', 'ZSTD(3)'],
  assists: ['Array(UInt8)', 'ZSTD(3)'],
  killer: ['UInt8', 'ZSTD(3)'],
  victim: ['UInt8', 'ZSTD(3)'],
  pos_x: ['UInt16', 'T64, ZSTD(3)'],
  pos_y: ['UInt16', 'T64, ZSTD(3)'],
}

const normalized = (key: string) => key.replace(/\s+/g, '')

export default class extends BaseSchema {
  private async rows<T>(query: string): Promise<T[]> {
    const result = await this.client.query({ query, format: 'JSONEachRow' })
    return (await result.json<T>()) ?? []
  }

  /** The table's sorting key, or null when it does not exist. */
  private async sortingKey(table: string) {
    const [row] = await this.rows<{ sorting_key: string }>(
      `SELECT sorting_key FROM system.tables WHERE database = currentDatabase() AND name = '${table}'`
    )
    return row ? normalized(row.sorting_key) : null
  }

  /** Column name → compression codec ('' for the default). */
  private async columns(table: string) {
    const rows = await this.rows<{ name: string; compression_codec: string }>(
      `SELECT name, compression_codec FROM system.columns
       WHERE database = currentDatabase() AND table = '${table}'`
    )
    return new Map(rows.map((row) => [row.name, row.compression_codec]))
  }

  /** Copies `table` into `next` (created by the caller) and swaps them. */
  private async swap(table: string, next: string, insert: string) {
    await this.client.command({ query: insert })
    await this.client.command({ query: `EXCHANGE TABLES ${table} AND ${next}` })
    await this.client.command({ query: `DROP TABLE ${next}` })
  }

  async up() {
    await this.participants()
    await this.matches()
    await this.timeline()
    await this.participantItems()
    await this.events()
  }

  private async participants() {
    const additions = PLAYER_COLUMNS.map(
      ([name, type, codec]) => `ADD COLUMN IF NOT EXISTS ${name} ${type} CODEC(${codec})`
    )
    await this.client.command({ query: `ALTER TABLE participants ${additions.join(', ')}` })
    if ((await this.sortingKey('participants')) === normalized(PARTICIPANTS_KEY)) return

    await this.client.command({ query: 'DROP TABLE IF EXISTS participants_next' })
    await this.client.command({
      query: `
        CREATE TABLE participants_next (
          ${PARTICIPANT_COLUMNS.map(([name, type, codec]) => `${name} ${type} CODEC(${codec})`).join(',\n          ')},
          PROJECTION by_match (SELECT _part_offset ORDER BY match_id)
        )
        ENGINE = MergeTree
        ORDER BY (${PARTICIPANTS_KEY})
        SETTINGS index_granularity = 1024, lightweight_mutation_projection_mode = 'rebuild'
      `,
    })

    const names = PARTICIPANT_COLUMNS.map(([name]) => name)
    const timeline = await this.columns('match_timeline')
    if (!timeline.has('skill_order')) {
      await this.swap(
        'participants',
        'participants_next',
        `INSERT INTO participants_next (${names.join(', ')}) SELECT ${names.join(', ')} FROM participants`
      )
      return
    }

    // Rows written before these columns take them from the player's frames: runes and shards from
    // any frame (they never change), the skill order from the last one.
    const moved = new Set(PLAYER_COLUMNS.map(([name]) => name))
    const select = names.map((name) =>
      moved.has(name) ? `if(p.participant_id = 0, t.${name}, p.${name}) AS ${name}` : `p.${name}`
    )
    const frames = [...moved].map((name) =>
      name === 'skill_order'
        ? 'argMax(skill_order, frame_ms) AS skill_order'
        : `any(${name}) AS ${name}`
    )
    await this.swap(
      'participants',
      'participants_next',
      `INSERT INTO participants_next (${names.join(', ')})
       SELECT ${select.join(', ')}
       FROM participants AS p
       ANY LEFT JOIN (
         SELECT match_id, puuid, ${frames.join(', ')}
         FROM match_timeline
         GROUP BY match_id, puuid
       ) AS t ON p.match_id = t.match_id AND p.puuid = t.puuid
       SETTINGS join_use_nulls = 0`
    )
  }

  private async matches() {
    if ((await this.sortingKey('matches')) === 'match_id') return
    await this.client.command({ query: 'DROP TABLE IF EXISTS matches_next' })
    await this.client.command({
      query: `
        CREATE TABLE matches_next AS matches
        ENGINE = MergeTree
        ORDER BY match_id
        SETTINGS index_granularity = 1024
      `,
    })
    // The match id is the key now: its bloom filter (0002) has nothing left to skip.
    await this.client.command({
      query: 'ALTER TABLE matches_next DROP INDEX IF EXISTS idx_match_id_bf',
    })
    await this.swap('matches', 'matches_next', 'INSERT INTO matches_next SELECT * FROM matches')
  }

  private async timeline() {
    let columns = await this.columns('match_timeline')
    if (!columns.has('skill_points')) {
      if (columns.has('skill_order')) {
        await this.client.command({
          query: `ALTER TABLE match_timeline
                  ADD COLUMN skill_points UInt8 DEFAULT length(skill_order) CODEC(Delta, ZSTD(9)) AFTER team_id`,
        })
        await this.client.command({
          query: 'ALTER TABLE match_timeline MATERIALIZE COLUMN skill_points',
          clickhouse_settings: { mutations_sync: '2' },
        })
      } else {
        await this.client.command({
          query: `ALTER TABLE match_timeline
                  ADD COLUMN skill_points UInt8 DEFAULT 0 CODEC(Delta, ZSTD(9)) AFTER team_id`,
        })
      }
      columns = await this.columns('match_timeline')
    }

    const drops = TIMELINE_PLAYER_COLUMNS.map(([name]) => name).filter((name) => columns.has(name))
    if (!drops.length) return

    const [{ missing }] = await this.rows<{ missing: string }>(
      `SELECT count() AS missing FROM participants
       WHERE participant_id = 0 AND match_id IN (SELECT match_id FROM match_timeline)`
    )
    if (Number(missing)) {
      throw new Error(
        `${missing} participant rows of games with a timeline have no participant id: backfill ` +
          'participant_id, runes, shards and skill_order from match_timeline before dropping its player columns'
      )
    }

    // Its default reads `skill_order`, which goes.
    const [points] = await this.rows<{ default_kind: string }>(
      `SELECT default_kind FROM system.columns
       WHERE database = currentDatabase() AND table = 'match_timeline' AND name = 'skill_points'`
    )
    if (points?.default_kind) {
      await this.client.command({
        query: 'ALTER TABLE match_timeline MODIFY COLUMN skill_points REMOVE DEFAULT',
      })
    }
    await this.client.command({
      query: `ALTER TABLE match_timeline ${drops.map((name) => `DROP COLUMN ${name}`).join(', ')}`,
    })
  }

  private async participantItems() {
    // The crawler's table: absent from a database it never wrote to.
    const key = await this.sortingKey('participant_items')
    if (key === null || key.split(',').includes('puuid')) return
    const columns = await this.columns('participant_items')
    if (columns.has('puuid')) {
      await this.client.command({ query: 'ALTER TABLE participant_items DROP COLUMN puuid' })
    }
  }

  private async events() {
    const columns = await this.columns('match_events')
    if (columns.get('match_id')) return
    const changes = Object.entries(EVENT_CODECS).map(
      ([column, [type, codec]]) => `MODIFY COLUMN ${column} ${type} CODEC(${codec})`
    )
    await this.client.command({ query: `ALTER TABLE match_events ${changes.join(', ')}` })
  }

  /**
   * Back to the columns the code before this migration reads: the timeline's player columns come
   * back empty (their values live on `participants`), `participant_items.puuid` too. Keys, codecs
   * and the new participant columns stay: the code before reads them just as well.
   */
  async down() {
    const timeline = await this.columns('match_timeline')
    const additions = TIMELINE_PLAYER_COLUMNS.filter(([name]) => !timeline.has(name)).map(
      ([name, type, codec]) => `ADD COLUMN ${name} ${type} CODEC(${codec})`
    )
    if (additions.length) {
      await this.client.command({ query: `ALTER TABLE match_timeline ${additions.join(', ')}` })
    }

    if ((await this.sortingKey('participant_items')) !== null) {
      await this.client.command({
        query: "ALTER TABLE participant_items ADD COLUMN IF NOT EXISTS puuid String DEFAULT ''",
      })
    }
  }
}
