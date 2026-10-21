import { BaseSchema } from 'adonisjs-clickhouse/schema'

/**
 * The PUUIDs of professional players' accounts under each of our Riot keys (Riot encrypts PUUIDs
 * per key), written by the crawler as it resolves them: how a champion's page finds the games
 * pros played on it.
 */
export default class extends BaseSchema {
  async up() {
    await this.client.command({
      query: `
        CREATE TABLE IF NOT EXISTS pro_puuids (
          puuid       String,
          platform    LowCardinality(String),
          account_id  UUID,
          player_id   UUID,
          updated_at  DateTime DEFAULT now()
        )
        ENGINE = ReplacingMergeTree(updated_at)
        ORDER BY (platform, puuid)
      `,
    })
  }

  async down() {
    await this.client.command({ query: 'DROP TABLE IF EXISTS pro_puuids' })
  }
}
