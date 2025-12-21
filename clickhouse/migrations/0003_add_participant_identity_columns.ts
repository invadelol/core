import { BaseSchema } from 'adonisjs-clickhouse/schema'

export default class extends BaseSchema {
  async up() {
    await this.client.command({
      query: `
        ALTER TABLE participants
          ADD COLUMN IF NOT EXISTS riot_id_game_name LowCardinality(String) DEFAULT '' AFTER puuid,
          ADD COLUMN IF NOT EXISTS riot_id_tag_line  LowCardinality(String) DEFAULT '' AFTER riot_id_game_name,
          ADD COLUMN IF NOT EXISTS profile_icon_id   UInt16 DEFAULT 0 AFTER riot_id_tag_line,
          ADD COLUMN IF NOT EXISTS summoner_level    UInt16 DEFAULT 0 AFTER profile_icon_id
      `,
    })
  }

  async down() {
    await this.client.command({
      query: `
        ALTER TABLE participants
          DROP COLUMN IF EXISTS summoner_level,
          DROP COLUMN IF EXISTS profile_icon_id,
          DROP COLUMN IF EXISTS riot_id_tag_line,
          DROP COLUMN IF EXISTS riot_id_game_name
      `,
    })
  }
}
