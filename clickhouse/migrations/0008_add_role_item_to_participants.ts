import { BaseSchema } from 'adonisjs-clickhouse/schema'

/**
 * Adds the role-quest slot (`roleBoundItem`): a quest token (12xx) while the quest runs, then the
 * reward. A bot laner's finished boots move there, which frees a seventh item slot.
 */
export default class extends BaseSchema {
  async up() {
    await this.client.command({
      query: `
        ALTER TABLE participants
          ADD COLUMN IF NOT EXISTS role_item UInt16 DEFAULT 0 AFTER item6
      `,
    })
  }

  async down() {
    await this.client.command({
      query: `
        ALTER TABLE participants
        DROP COLUMN IF EXISTS role_item
      `,
    })
  }
}
