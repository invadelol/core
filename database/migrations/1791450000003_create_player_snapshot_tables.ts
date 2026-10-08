import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Player snapshots from the desktop app (docs/desktop-sync.md §6).
 *
 * The app reports what the League client showed about a player: identity,
 * ranks, champion mastery. Core keeps the latest report per raw PUUID, and
 * applies it to the web profile once it knows whose it is and trusts it.
 * Every row a device writes carries its `device_id`, so a device caught
 * lying can be rolled back (§1.2).
 */
export default class CreatePlayerSnapshotTables extends BaseSchema {
  async up() {
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS citext')

    /**
     * The latest report per raw (client) PUUID. Never replaced by an older
     * one; `puuid` stays null while the report is `staged` (§6.3).
     */
    this.schema.createTable('player_observation', (table) => {
      table.uuid('raw_puuid').primary()
      table.specificType('game_name', 'citext').notNullable()
      table.specificType('tag_line', 'citext').notNullable()
      table.string('platform', 8).notNullable()
      table.integer('profile_icon_id')
      table.integer('summoner_level')
      table.string('privacy', 8)
      // The client's claim; a link to the device is what makes it believable.
      table.boolean('self').notNullable().defaultTo(false)
      table.string('context', 16)
      // Null: not read. []: read, unranked in both queues.
      table.jsonb('ranks')
      table.jsonb('mastery')
      table.timestamp('observed_at', { useTz: true }).notNullable()
      table.timestamp('received_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.uuid('device_id').references('id').inTable('desktop_device').onDelete('SET NULL')
      // Keyed hash of the sender's IP: corroboration needs a different network, not the address.
      table.specificType('ip_hash', 'char(64)')
      // What was reported, without `observedAt` and `context` (the app's own dedup hash, §6.6).
      table.specificType('payload_hash', 'char(64)').notNullable()
      table.text('puuid')
      table.timestamp('applied_at', { useTz: true })
      table.string('status', 10).notNullable()
    })
    this.schema.raw(`
      ALTER TABLE player_observation
      ADD CONSTRAINT player_observation_status_check
      CHECK (status IN ('staged', 'applied', 'unchanged', 'stale', 'held', 'conflict'))
    `)
    // `freshness.lastObservedAt` and the rollback of a revoked device.
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS player_observation_puuid_idx
      ON player_observation (puuid, observed_at DESC) WHERE puuid IS NOT NULL
    `)
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS player_observation_device_idx
      ON player_observation (device_id) WHERE device_id IS NOT NULL
    `)
    // The lookup run whenever core learns a Riot ID's PUUID: tiny, since only
    // staged reports are in it, and that lookup must stay one index probe.
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS player_observation_staged_idx
      ON player_observation (game_name, tag_line, platform) WHERE status = 'staged'
    `)

    /** The newest top-10 mastery snapshot per player, Riot's or the app's. */
    this.schema.createTable('player_mastery', (table) => {
      table.text('puuid').primary().references('puuid').inTable('riot_player').onDelete('CASCADE')
      table.jsonb('entries').notNullable()
      table.timestamp('observed_at', { useTz: true }).notNullable()
      table.string('source', 8).notNullable()
      table.uuid('device_id').references('id').inTable('desktop_device').onDelete('SET NULL')
    })
    this.schema.raw(`
      ALTER TABLE player_mastery
      ADD CONSTRAINT player_mastery_source_check CHECK (source IN ('riot', 'desktop'))
    `)
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS player_mastery_device_idx
      ON player_mastery (device_id) WHERE device_id IS NOT NULL
    `)

    /**
     * When the newest stored rank of a queue was last seen unchanged. Lets
     * core skip league-v4 without writing a duplicate `riot_rank` row. A
     * queue with a confirmation and no rank row was confirmed unranked.
     */
    this.schema.createTable('riot_rank_confirmed', (table) => {
      table
        .text('puuid')
        .notNullable()
        .references('puuid')
        .inTable('riot_player')
        .onDelete('CASCADE')
      table.string('queue_type', 32).notNullable()
      table.timestamp('confirmed_at', { useTz: true }).notNullable()
      // Null when Riot confirmed it.
      table.uuid('device_id').references('id').inTable('desktop_device').onDelete('SET NULL')
      table.primary(['puuid', 'queue_type'])
    })

    // Other players' losses are hidden by the client, so desktop rows may
    // have none. The column was created nullable (1734020000000) and has
    // stayed so; this only guarantees it on a database created otherwise.
    this.schema.raw('ALTER TABLE riot_rank ALTER COLUMN losses DROP NOT NULL')
  }

  async down() {
    // Code from before snapshots reads `losses` as a number. Rows without one
    // take the losses of the newest earlier row of the same queue that has
    // them, else 0: a guess, which is exactly why `up` leaves them NULL. The
    // column itself stays nullable, as it always was.
    this.schema.raw(`
      UPDATE riot_rank AS r
      SET losses = COALESCE(
        (
          SELECT p.losses FROM riot_rank AS p
          WHERE p.puuid = r.puuid
            AND p.queue_type = r.queue_type
            AND p.fetched_at < r.fetched_at
            AND p.losses IS NOT NULL
          ORDER BY p.fetched_at DESC
          LIMIT 1
        ),
        0
      )
      WHERE r.losses IS NULL
    `)
    this.schema.dropTable('riot_rank_confirmed')
    this.schema.dropTable('player_mastery')
    this.schema.dropTable('player_observation')
  }
}
