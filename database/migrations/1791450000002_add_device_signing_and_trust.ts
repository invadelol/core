import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Request signing and the slower trust model (docs/desktop-sync.md §1.1, §1.2).
 *
 * - `secret_encrypted`: the device's signing secret, encrypted with the app
 *   key. Devices registered before signing have none and must register again.
 * - `verified_days` / `last_verified_on`: on how many different (UTC) days
 *   Riot confirmed one of the device's games. Verifications arrive in time
 *   order, so counting day changes counts distinct days.
 * - `riot_rank.device_id`: which device wrote a desktop rank, so a device
 *   caught lying can have its rows deleted.
 */
export default class AddDeviceSigningAndTrust extends BaseSchema {
  async up() {
    this.schema.alterTable('desktop_device', (table) => {
      table.text('secret_encrypted')
      table.integer('verified_days').notNullable().defaultTo(0)
      table.date('last_verified_on')
    })

    this.schema.alterTable('riot_rank', (table) => {
      table.uuid('device_id').references('id').inTable('desktop_device').onDelete('SET NULL')
    })
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS riot_rank_device_idx
      ON riot_rank (device_id) WHERE device_id IS NOT NULL
    `)
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS riot_rank_device_idx')
    this.schema.alterTable('riot_rank', (table) => {
      table.dropColumn('device_id')
    })
    this.schema.alterTable('desktop_device', (table) => {
      table.dropColumn('last_verified_on')
      table.dropColumn('verified_days')
      table.dropColumn('secret_encrypted')
    })
  }
}
