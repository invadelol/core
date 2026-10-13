import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The home page's climbs read the last day of rank snapshots across every player. The rank
 * history index starts with the player, so that read needs one by time.
 */
export default class AddRiotRankFetchedAtIndex extends BaseSchema {
  async up() {
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS riot_rank_fetched_at_idx
      ON riot_rank (fetched_at)
    `)
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS riot_rank_fetched_at_idx')
  }
}
