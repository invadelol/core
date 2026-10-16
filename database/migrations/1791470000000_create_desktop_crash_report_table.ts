import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Anonymous crash reports from the desktop app (docs/desktop-sync.md §7).
 * Deliberately without the device, the account or the address: a report says
 * which version crashed where, never who it happened to. Kept 90 days.
 */
export default class CreateDesktopCrashReportTable extends BaseSchema {
  protected tableName = 'desktop_crash_report'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.string('kind', 16).notNullable()
      table.string('process', 16).notNullable()
      table.string('app', 32).notNullable()
      table.string('os', 16).notNullable()
      table.string('os_version', 32).notNullable().defaultTo('')
      table.string('message', 300).notNullable()
      table.string('location', 160).notNullable().defaultTo('')
      table.timestamp('occurred_at', { useTz: true }).notNullable()
      table.timestamp('received_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.index(['received_at'])
      table.index(['app', 'kind'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
