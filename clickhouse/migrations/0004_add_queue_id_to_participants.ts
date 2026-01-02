import { BaseSchema } from 'adonisjs-clickhouse/schema'

/**
 * Adds queue_id to participants table to enable direct filtering
 * without joining to matches table.
 */
export default class extends BaseSchema {
  async up() {
    await this.client.command({
      query: `
        ALTER TABLE participants
          ADD COLUMN IF NOT EXISTS queue_id UInt16 DEFAULT 0 AFTER game_start_ms
      `,
    })

    // Add skip index for queue_id filtering
    await this.client.command({
      query: `
        ALTER TABLE participants
        ADD INDEX IF NOT EXISTS idx_queue_id_bf queue_id TYPE bloom_filter(0.01) GRANULARITY 1
      `,
    })
  }

  async down() {
    await this.client.command({
      query: `
        ALTER TABLE participants
        DROP INDEX IF EXISTS idx_queue_id_bf
      `,
    })

    await this.client.command({
      query: `
        ALTER TABLE participants
        DROP COLUMN IF EXISTS queue_id
      `,
    })
  }
}
