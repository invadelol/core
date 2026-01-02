import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddSummonerSearchVector extends BaseSchema {
  async up() {
    this.schema.alterTable('riot_player', (table) => {
      table.specificType('search_vector', 'tsvector')
    })

    // GIN index for fast full-text search
    this.schema.raw(`
      CREATE INDEX IF NOT EXISTS riot_player_search_vector_idx
      ON riot_player USING GIN (search_vector)
    `)

    // Trigger to auto-update search_vector on insert/update
    this.schema.raw(`
      CREATE OR REPLACE FUNCTION update_riot_player_search_vector()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.search_vector := to_tsvector('simple', coalesce(NEW.game_name, '') || ' ' || coalesce(NEW.tag_line, ''));
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `)

    this.schema.raw(`
      CREATE TRIGGER riot_player_search_vector_trigger
      BEFORE INSERT OR UPDATE ON riot_player
      FOR EACH ROW
      EXECUTE FUNCTION update_riot_player_search_vector()
    `)

    // Backfill existing rows
    this.schema.raw(`
      UPDATE riot_player
      SET search_vector = to_tsvector('simple', coalesce(game_name, '') || ' ' || coalesce(tag_line, ''))
      WHERE search_vector IS NULL
    `)
  }

  async down() {
    this.schema.raw('DROP TRIGGER IF EXISTS riot_player_search_vector_trigger ON riot_player')
    this.schema.raw('DROP FUNCTION IF EXISTS update_riot_player_search_vector')
    this.schema.raw('DROP INDEX IF EXISTS riot_player_search_vector_idx')
    this.schema.alterTable('riot_player', (table) => {
      table.dropColumn('search_vector')
    })
  }
}
