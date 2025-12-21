import { BaseSchema } from 'adonisjs-clickhouse/schema'

/**
 * Adds skip indexes to speed up queries filtering by match_id.
 * This is important for endpoints that load "all participants of N matches".
 */
export default class extends BaseSchema {
  async up() {
    await this.client.command({
      query: `
        ALTER TABLE participants
        ADD INDEX IF NOT EXISTS idx_match_id_bf match_id TYPE bloom_filter(0.01) GRANULARITY 1
      `,
    })

    await this.client.command({
      query: `
        ALTER TABLE matches
        ADD INDEX IF NOT EXISTS idx_match_id_bf match_id TYPE bloom_filter(0.01) GRANULARITY 1
      `,
    })
  }

  async down() {
    await this.client.command({
      query: `
        ALTER TABLE participants
        DROP INDEX IF EXISTS idx_match_id_bf
      `,
    })

    await this.client.command({
      query: `
        ALTER TABLE matches
        DROP INDEX IF EXISTS idx_match_id_bf
      `,
    })
  }
}
