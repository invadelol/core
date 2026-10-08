import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Ranks now also arrive from the desktop app's LP snapshots, which are
 * fresher than league-v4 right after a game. Every existing row came from Riot.
 */
export default class AddSourceToRiotRank extends BaseSchema {
  protected tableName = 'riot_rank'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('source', 8).notNullable().defaultTo('riot')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('source')
    })
  }
}
