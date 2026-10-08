import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Storage for the desktop app's uploads (docs/desktop-sync.md).
 *
 * Postgres holds everything about *who* sent a game and *how much it is
 * trusted*; the game itself still lands in ClickHouse through the existing
 * row builders. `match_source` is the one place both writers (the web sync
 * and the desktop pipeline) agree on who ingests a match, because the
 * ClickHouse tables are plain MergeTree and a second insert would duplicate
 * every row.
 */
export default class CreateDesktopSyncTables extends BaseSchema {
  async up() {
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS citext')

    /**
     * One row per installed app that switched publishing on. Only the SHA-256
     * of the bearer token is kept: a database leak must not hand out tokens.
     */
    this.schema.createTable('desktop_device', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.specificType('token_hash', 'char(64)').notNullable().unique()
      table.string('app', 32).notNullable()
      table.string('os', 16).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('last_seen_at', { useTz: true })
      table.timestamp('revoked_at', { useTz: true })
      table.string('revoked_reason', 32)
      // Trust: uploads Riot confirmed, and uploads Riot contradicted.
      table.integer('verified_uploads').notNullable().defaultTo(0)
      table.integer('mismatches').notNullable().defaultTo(0)
    })

    /** The accounts a device may upload for. */
    this.schema.createTable('desktop_device_account', (table) => {
      table
        .uuid('device_id')
        .notNullable()
        .references('id')
        .inTable('desktop_device')
        .onDelete('CASCADE')
      table
        .text('puuid')
        .notNullable()
        .references('puuid')
        .inTable('riot_player')
        .onDelete('CASCADE')
      table.string('platform', 8).notNullable()
      table.uuid('raw_puuid')
      table.string('source', 8).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.primary(['device_id', 'puuid'])
    })

    /**
     * The client's raw PUUID to the API key's encrypted PUUID. They are never
     * compared to each other, only linked here through Riot IDs or match-v5.
     */
    this.schema.createTable('riot_puuid_alias', (table) => {
      table.uuid('raw_puuid').primary()
      table.text('puuid').notNullable()
      table.specificType('game_name', 'citext')
      table.specificType('tag_line', 'citext')
      table.string('status', 10).notNullable()
      table.timestamp('observed_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.index(['puuid'], 'riot_puuid_alias_puuid_idx')
    })
    this.schema.raw(`
      ALTER TABLE riot_puuid_alias
      ADD CONSTRAINT riot_puuid_alias_status_check
      CHECK (status IN ('verified', 'asserted', 'conflict'))
    `)

    /** Every upload, accepted or not yet published. Re-sends hit the unique key. */
    this.schema.createTable('desktop_match_upload', (table) => {
      table.bigIncrements('id').primary()
      table.text('match_id').notNullable()
      table
        .uuid('device_id')
        .notNullable()
        .references('id')
        .inTable('desktop_device')
        .onDelete('CASCADE')
      table.text('uploader_puuid').notNullable()
      table.uuid('uploader_raw_puuid').notNullable()
      // Canonical hash of the game (not of the request), so two devices can agree.
      table.specificType('payload_hash', 'char(64)').notNullable()
      table.string('status', 16).notNullable()
      table.string('lp_status', 8).notNullable().defaultTo('none')
      // Keyed hash of the client IP: corroboration needs equality, not the address.
      table.specificType('ip_hash', 'char(64)')
      table.string('app', 32)
      table.timestamp('received_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('processed_at', { useTz: true })
      table.unique(['match_id', 'device_id'])
    })
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS desktop_match_upload_uploader_idx
      ON desktop_match_upload (uploader_puuid, received_at DESC)
    `)

    /**
     * Provenance of a match in ClickHouse, and the single-writer lock: the
     * writer whose `INSERT … ON CONFLICT DO NOTHING` returns the row ingests.
     * Matches without a row predate this table and came from Riot.
     */
    this.schema.createTable('match_source', (table) => {
      table.text('match_id').primary()
      table.string('source', 8).notNullable()
      table.string('verification', 12).notNullable()
      table.jsonb('completeness')
      table.uuid('first_device_id').references('id').inTable('desktop_device').onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('verified_at', { useTz: true })
      table.index(['first_device_id'], 'match_source_first_device_idx')
    })
    this.schema.raw(`
      ALTER TABLE match_source
      ADD CONSTRAINT match_source_source_check CHECK (source IN ('riot', 'desktop')),
      ADD CONSTRAINT match_source_verification_check
        CHECK (verification IN ('verified', 'unverified', 'corroborated', 'conflict'))
    `)

    /** Accepted LP changes, only ever for the uploader of the game. */
    this.schema.createTable('lp_change', (table) => {
      table.bigIncrements('id').primary()
      table.text('match_id').notNullable()
      table.text('puuid').notNullable()
      table.string('queue', 32).notNullable()
      for (const side of ['before', 'after']) {
        table.string(`${side}_tier`, 16).notNullable()
        table.string(`${side}_division`, 8)
        table.integer(`${side}_lp`).notNullable()
        table.integer(`${side}_wins`).notNullable()
        table.integer(`${side}_losses`).notNullable()
        table.timestamp(`${side}_at`, { useTz: true }).notNullable()
      }
      table.integer('delta').notNullable()
      table.string('source', 8).notNullable().defaultTo('desktop')
      table.uuid('device_id').references('id').inTable('desktop_device').onDelete('SET NULL')
      table.string('status', 10).notNullable().defaultTo('accepted')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.unique(['match_id', 'puuid'])
      table.index(['puuid', 'match_id'], 'lp_change_puuid_match_idx')
    })
  }

  async down() {
    this.schema.dropTable('lp_change')
    this.schema.dropTable('match_source')
    this.schema.dropTable('desktop_match_upload')
    this.schema.dropTable('riot_puuid_alias')
    this.schema.dropTable('desktop_device_account')
    this.schema.dropTable('desktop_device')
  }
}
