import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'riot_match'

  async up() {
    this.schema.dropTable(this.tableName)
  }

  async down() {
    this.schema.createTable(this.tableName, (table) => {
      table.text('match_id').primary()
      table.string('routing_region', 16).notNullable()
      table.string('platform', 8).notNullable()
      table.text('s3_key').notNullable()
      table.timestamp('fetched_at', { useTz: true })
    })
  }
}
