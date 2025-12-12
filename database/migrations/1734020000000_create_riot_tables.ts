import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateRiotTables extends BaseSchema {
  async up() {
    /**
     * Needed for case-insensitive text columns (game_name/tag_line)
     */
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS citext')

    this.schema.createTable('riot_player', (table) => {
      table.text('puuid').primary()
      table.string('platform', 8).notNullable()
      table.specificType('game_name', 'citext').notNullable()
      table.specificType('tag_line', 'citext').notNullable()
      table.integer('profile_icon_id')
      table.integer('summoner_level')
      table.timestamp('last_refresh_at', { useTz: true })
      table.bigInteger('view_count').notNullable().defaultTo(0)
      table
        .timestamp('created_at', { useTz: true })
        .notNullable()
        .defaultTo(this.now())
    })

    this.schema.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS riot_player_riot_id_uq
      ON riot_player (platform, game_name, tag_line)
    `)
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS riot_player_last_refresh_at_idx
      ON riot_player (last_refresh_at)
      WHERE last_refresh_at IS NOT NULL
    `)
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS riot_player_view_count_desc_idx
      ON riot_player (view_count DESC)
    `)

    this.schema.createTable('riot_rank', (table) => {
      table
        .text('puuid')
        .notNullable()
        .references('puuid')
        .inTable('riot_player')
        .onDelete('CASCADE')

      table.string('queue_type', 32).notNullable()
      table.string('tier', 16)
      table.string('division', 8)
      table.integer('league_points')
      table.integer('wins')
      table.integer('losses')
      table
        .timestamp('fetched_at', { useTz: true })
        .notNullable()
        .defaultTo(this.now())

      table.primary(['puuid', 'queue_type', 'fetched_at'])
    })

    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS riot_rank_latest_idx
      ON riot_rank (puuid, queue_type, fetched_at DESC)
    `)

    this.schema.createTable('riot_match', (table) => {
      table.text('match_id').primary()
      table.string('routing_region', 16).notNullable()
      table.string('platform', 8).notNullable()
      table.text('s3_key').notNullable()
      table.timestamp('fetched_at', { useTz: true })
    })

    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS riot_match_platform_fetched_at_idx
      ON riot_match (platform, fetched_at DESC)
    `)
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS riot_match_routing_region_idx
      ON riot_match (routing_region)
    `)
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS riot_match_s3_key_idx
      ON riot_match (s3_key)
    `)
  }

  async down() {
    this.schema.dropTable('riot_match')
    this.schema.dropTable('riot_rank')
    this.schema.dropTable('riot_player')
  }
}
