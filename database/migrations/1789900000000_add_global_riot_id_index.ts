import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddGlobalRiotIdIndex extends BaseSchema {
  async up() {
    // Existing index starts with platform; regionless profile reads need this one.
    // The identity columns are citext, so this also supports case-insensitive lookups.
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS riot_player_global_riot_id_idx
      ON riot_player (game_name, tag_line)
    `)
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS riot_player_global_riot_id_idx')
  }
}
