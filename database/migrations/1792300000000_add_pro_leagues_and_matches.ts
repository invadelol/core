import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Leagues, the league a team plays in, the pros' photos and real names, and the pro matches around
 * now (about two weeks back and three ahead), filled daily outside the app from esports data.
 *
 * Safe on a live database: new tables, nullable columns without defaults (no table rewrite) and
 * indexes on small tables. `external_id` is the record's id in the esports data, for upserts.
 * `image_url` columns are source addresses read server-side only: `/cdn/league/:slug` and
 * `/cdn/pro/:slug` serve the images, so a browser never sees them.
 */
export default class AddProLeaguesAndMatches extends BaseSchema {
  async up() {
    this.schema.raw(`
      CREATE TABLE IF NOT EXISTS pro_league (
        slug text PRIMARY KEY,
        code text NOT NULL,
        name text NOT NULL,
        region text,
        tier smallint NOT NULL DEFAULT 1,
        priority smallint NOT NULL DEFAULT 100,
        external_id integer UNIQUE,
        image_url text,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)

    this.schema.raw(`
      ALTER TABLE pro_team
        ADD COLUMN IF NOT EXISTS league_slug text,
        ADD COLUMN IF NOT EXISTS external_id integer,
        ADD COLUMN IF NOT EXISTS location text
    `)
    this.schema.raw(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pro_team_league_slug_foreign') THEN
          ALTER TABLE pro_team ADD CONSTRAINT pro_team_league_slug_foreign
            FOREIGN KEY (league_slug) REFERENCES pro_league (slug) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pro_team_external_id_key') THEN
          ALTER TABLE pro_team ADD CONSTRAINT pro_team_external_id_key UNIQUE (external_id);
        END IF;
      END $$
    `)
    this.schema.raw('CREATE INDEX IF NOT EXISTS pro_team_league_slug_idx ON pro_team (league_slug)')

    this.schema.raw(`
      ALTER TABLE pro_player
        ADD COLUMN IF NOT EXISTS external_id integer,
        ADD COLUMN IF NOT EXISTS image_url text,
        ADD COLUMN IF NOT EXISTS first_name text,
        ADD COLUMN IF NOT EXISTS last_name text,
        ADD COLUMN IF NOT EXISTS nationality text,
        ADD COLUMN IF NOT EXISTS birthday date
    `)
    this.schema.raw(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pro_player_external_id_key') THEN
          ALTER TABLE pro_player ADD CONSTRAINT pro_player_external_id_key UNIQUE (external_id);
        END IF;
      END $$
    `)

    this.schema.raw(`
      CREATE TABLE IF NOT EXISTS pro_match (
        external_id integer PRIMARY KEY,
        league_slug text REFERENCES pro_league (slug) ON DELETE SET NULL,
        tournament text,
        name text,
        begin_at timestamptz NOT NULL,
        status text NOT NULL,
        best_of smallint,
        team1_id uuid REFERENCES pro_team (id) ON DELETE SET NULL,
        team2_id uuid REFERENCES pro_team (id) ON DELETE SET NULL,
        team1_name text,
        team1_code text,
        team2_name text,
        team2_code text,
        team1_external integer,
        team2_external integer,
        score1 smallint,
        score2 smallint,
        winner smallint,
        stream_url text,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    this.schema.raw('CREATE INDEX IF NOT EXISTS pro_match_begin_at_idx ON pro_match (begin_at)')
    this.schema.raw(
      'CREATE INDEX IF NOT EXISTS pro_match_league_begin_idx ON pro_match (league_slug, begin_at)'
    )
    this.schema.raw(
      'CREATE INDEX IF NOT EXISTS pro_match_team1_idx ON pro_match (team1_id, begin_at)'
    )
    this.schema.raw(
      'CREATE INDEX IF NOT EXISTS pro_match_team2_idx ON pro_match (team2_id, begin_at)'
    )
  }

  async down() {
    this.schema.raw('DROP TABLE IF EXISTS pro_match')
    this.schema.raw(`
      ALTER TABLE pro_player
        DROP CONSTRAINT IF EXISTS pro_player_external_id_key,
        DROP COLUMN IF EXISTS external_id,
        DROP COLUMN IF EXISTS image_url,
        DROP COLUMN IF EXISTS first_name,
        DROP COLUMN IF EXISTS last_name,
        DROP COLUMN IF EXISTS nationality,
        DROP COLUMN IF EXISTS birthday
    `)
    this.schema.raw('DROP INDEX IF EXISTS pro_team_league_slug_idx')
    this.schema.raw(`
      ALTER TABLE pro_team
        DROP CONSTRAINT IF EXISTS pro_team_league_slug_foreign,
        DROP CONSTRAINT IF EXISTS pro_team_external_id_key,
        DROP COLUMN IF EXISTS league_slug,
        DROP COLUMN IF EXISTS external_id,
        DROP COLUMN IF EXISTS location
    `)
    this.schema.raw('DROP TABLE IF EXISTS pro_league')
  }
}
