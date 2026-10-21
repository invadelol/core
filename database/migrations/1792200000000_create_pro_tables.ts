import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Professional players, their teams and their ranked accounts: what tags a profile "Pro", the
 * pro and team pages, and the accounts the crawler reads first. Filled outside the app.
 *
 * `pro_account_puuid` maps an account to its PUUID under each of our Riot keys (Riot encrypts
 * PUUIDs per key), so the games stored under any key can be found again.
 */
export default class CreateProTables extends BaseSchema {
  async up() {
    this.schema.createTable('pro_team', (table) => {
      table.uuid('id').primary()
      table.text('slug').notNullable()
      table.text('name').notNullable()
      table.text('short_name')
      table.string('region', 8)
      table.boolean('active').notNullable().defaultTo(false)
      /** Never sent to a browser: served through /cdn/team/:id. */
      table.text('logo_url')
      table.jsonb('socials').notNullable().defaultTo('{}')
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.raw('CREATE INDEX IF NOT EXISTS pro_team_slug_idx ON pro_team (slug)')
    this.schema.raw(
      'CREATE INDEX IF NOT EXISTS pro_team_name_idx ON pro_team (lower(name) text_pattern_ops)'
    )

    this.schema.createTable('pro_player', (table) => {
      table.uuid('id').primary()
      table.text('slug').notNullable()
      table.text('name').notNullable()
      table.string('country', 8)
      /** TOP, JUNGLE, MID, ADC, SUPPORT, or a staff role (COACH, ANALYST…). */
      table.string('role', 16)
      table.jsonb('socials').notNullable().defaultTo('{}')
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.raw('CREATE INDEX IF NOT EXISTS pro_player_slug_idx ON pro_player (slug)')
    this.schema.raw(
      'CREATE INDEX IF NOT EXISTS pro_player_name_idx ON pro_player (lower(name) text_pattern_ops)'
    )

    this.schema.createTable('pro_team_member', (table) => {
      table.uuid('id').primary()
      table.uuid('team_id').notNullable().references('id').inTable('pro_team').onDelete('CASCADE')
      table.uuid('player_id').references('id').inTable('pro_player').onDelete('SET NULL')
      table.text('name')
      /** player, sub or staff. */
      table.string('title', 16)
      table.string('role', 16)
      table.boolean('current').notNullable().defaultTo(false)
      table.timestamp('joined_at', { useTz: true })
      table.timestamp('left_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.raw(
      'CREATE INDEX IF NOT EXISTS pro_team_member_team_idx ON pro_team_member (team_id)'
    )
    this.schema.raw(
      'CREATE INDEX IF NOT EXISTS pro_team_member_player_idx ON pro_team_member (player_id)'
    )

    this.schema.createTable('pro_account', (table) => {
      table.uuid('id').primary()
      table
        .uuid('player_id')
        .notNullable()
        .references('id')
        .inTable('pro_player')
        .onDelete('CASCADE')
      table.string('platform', 8).notNullable()
      table.specificType('game_name', 'citext').notNullable()
      table.specificType('tag_line', 'citext').notNullable()
      table.string('tier', 16)
      table.smallint('division')
      table.integer('lp')
      table.integer('wins')
      table.integer('losses')
      table.string('peak_tier', 16)
      table.smallint('peak_division')
      table.integer('peak_lp')
      table.timestamp('rank_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.raw('CREATE INDEX IF NOT EXISTS pro_account_player_idx ON pro_account (player_id)')
    this.schema.raw(
      'CREATE INDEX IF NOT EXISTS pro_account_riot_id_idx ON pro_account (game_name, tag_line)'
    )

    this.schema.createTable('pro_account_puuid', (table) => {
      table
        .uuid('account_id')
        .notNullable()
        .references('id')
        .inTable('pro_account')
        .onDelete('CASCADE')
      /** The PUUID under one of our Riot keys; empty while the Riot ID does not resolve. */
      table.text('puuid').notNullable()
      /** Which key it belongs to (the crawler's label), when known. */
      table.string('key', 16)
      table.string('platform', 8)
      /** ok, or missing when the Riot ID no longer resolves. */
      table.string('status', 16).notNullable().defaultTo('ok')
      table.timestamp('resolved_at', { useTz: true })
      table.timestamp('crawled_at', { useTz: true })
      table.integer('games').notNullable().defaultTo(0)
      table.primary(['account_id', 'puuid'])
    })
    this.schema.raw(
      'CREATE INDEX IF NOT EXISTS pro_account_puuid_puuid_idx ON pro_account_puuid (puuid)'
    )
  }

  async down() {
    this.schema.dropTableIfExists('pro_account_puuid')
    this.schema.dropTableIfExists('pro_account')
    this.schema.dropTableIfExists('pro_team_member')
    this.schema.dropTableIfExists('pro_player')
    this.schema.dropTableIfExists('pro_team')
  }
}
