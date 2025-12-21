import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateRiotPlayerHistory extends BaseSchema {
  async up() {
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS citext')

    this.schema.createTable('riot_player_history', (table) => {
      table.bigIncrements('id').primary()

      table
        .text('puuid')
        .notNullable()
        .references('puuid')
        .inTable('riot_player')
        .onDelete('CASCADE')

      table.specificType('game_name', 'citext').notNullable()
      table.specificType('tag_line', 'citext').notNullable()
      table.integer('profile_icon_id')

      table.timestamp('observed_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['puuid', 'observed_at'], 'riot_player_history_puuid_observed_at_idx')
      table.index(['puuid'], 'riot_player_history_puuid_idx')
    })
  }

  async down() {
    this.schema.dropTable('riot_player_history')
  }
}
