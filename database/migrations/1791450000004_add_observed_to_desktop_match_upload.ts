import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Observed games (docs/desktop-sync.md §2.5, contract v1.3): a game the app
 * read from the client without the uploader having played it. It is
 * published like any upload, but it is not the uploader's game, so it never
 * moves the uploader's `lastDesktopSyncAt` and never carries an LP change.
 */
export default class AddObservedToDesktopMatchUpload extends BaseSchema {
  protected tableName = 'desktop_match_upload'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('observed').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('observed')
    })
  }
}
