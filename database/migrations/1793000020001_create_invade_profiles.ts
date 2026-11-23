import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Invade profiles (`/u/<handle>`): how a person dresses their page, the pro an administrator
 * verified them as, the skins the desktop app read from their League client, and what they say
 * about skins (ratings, reviews, likes, wishlist, lists).
 *
 * Additive and safe on a live database: new tables, and three guarded statements for what the
 * account branch creates too (a person's handle, whether a League account shows on their profile,
 * the follows), so either migration may run first.
 */
export default class CreateInvadeProfiles extends BaseSchema {
  async up() {
    this.schema.raw('ALTER TABLE invade_user ADD COLUMN IF NOT EXISTS handle varchar(24)')
    this.schema.raw(
      'CREATE UNIQUE INDEX IF NOT EXISTS invade_user_handle_unique ON invade_user (handle)'
    )
    this.schema.raw(
      'ALTER TABLE invade_owned_account ADD COLUMN IF NOT EXISTS shown boolean NOT NULL DEFAULT false'
    )
    this.schema.raw(`
      CREATE TABLE IF NOT EXISTS invade_follow (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        follower_id uuid NOT NULL REFERENCES invade_user (id) ON DELETE CASCADE,
        target_kind text NOT NULL CHECK (target_kind IN ('user', 'player', 'pro')),
        target_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (follower_id, target_kind, target_id)
      )
    `)

    /** How the person dresses their profile. No row: the defaults (violet, nothing chosen). */
    this.schema.createTable('invade_profile', (t) => {
      t.uuid('user_id').primary().references('id').inTable('invade_user').onDelete('CASCADE')
      t.string('bio', 160).notNullable().defaultTo('')
      // [{ kind: 'twitch' | 'x' | 'youtube' | …, handle }], in the person's order.
      t.jsonb('links').notNullable().defaultTo('[]')
      // A skin the person owns (its catalogue id), behind the head; null: their main champion.
      t.integer('backdrop_skin').nullable()
      // The square picture: cut from the backdrop's art, or the main League account's icon.
      t.string('avatar', 8).notNullable().defaultTo('backdrop')
      t.string('accent', 8).notNullable().defaultTo('violet')
      t.boolean('frame').notNullable().defaultTo(false)
      // [{ key, on }] in the person's order; keys the site does not know are dropped on read.
      t.jsonb('showcases').notNullable().defaultTo('[]')
      // The favourite four, in order.
      t.specificType('favorite_skins', 'integer[]').notNullable().defaultTo('{}')
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.raw(
      `ALTER TABLE invade_profile ADD CONSTRAINT invade_profile_avatar_check CHECK (avatar IN ('backdrop', 'icon'))`
    )

    /** A pro's own Invade account, as an administrator verified it: the badge and their accounts. */
    this.schema.createTable('invade_verified_pro', (t) => {
      t.uuid('user_id').primary().references('id').inTable('invade_user').onDelete('CASCADE')
      t.uuid('player_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('pro_player')
        .onDelete('CASCADE')
      t.timestamp('verified_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    /**
     * The skins a League account owns, as the desktop app last read them from the League client
     * (docs/desktop-sync.md §13): one read per League account, the person whose app sent it, and
     * its skins. A person's collection is the union over the League accounts they own; a newer
     * read replaces an account's whole set; deleting the person deletes what their app sent.
     */
    this.schema.createTable('invade_collection_read', (t) => {
      t.text('puuid').primary().references('puuid').inTable('riot_player').onDelete('CASCADE')
      t.uuid('user_id')
        .notNullable()
        .references('id')
        .inTable('invade_user')
        .onDelete('CASCADE')
        .index()
      t.uuid('device_id').nullable().references('id').inTable('desktop_device').onDelete('SET NULL')
      // When the app read the client, and when core received it.
      t.timestamp('read_at', { useTz: true }).notNullable()
      t.timestamp('received_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.createTable('invade_owned_skin', (t) => {
      t.text('puuid')
        .notNullable()
        .references('puuid')
        .inTable('invade_collection_read')
        .onDelete('CASCADE')
      t.integer('skin_id').notNullable()
      t.timestamp('purchased_at', { useTz: true }).nullable()
      t.primary(['puuid', 'skin_id'])
    })

    /** Half-star ratings: 1 is half a star, 10 is five stars. */
    this.schema.createTable('invade_skin_rating', (t) => {
      t.uuid('user_id').notNullable().references('id').inTable('invade_user').onDelete('CASCADE')
      t.integer('skin_id').notNullable()
      t.smallint('rating').notNullable()
      t.timestamp('rated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.primary(['user_id', 'skin_id'])
      t.index(['skin_id'])
      t.index(['rated_at'])
    })
    this.schema.raw(
      'ALTER TABLE invade_skin_rating ADD CONSTRAINT invade_skin_rating_range CHECK (rating BETWEEN 1 AND 10)'
    )

    /** One review per person and skin; its stars are the person's rating of that skin. */
    this.schema.createTable('invade_skin_review', (t) => {
      t.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      t.uuid('user_id').notNullable().references('id').inTable('invade_user').onDelete('CASCADE')
      t.integer('skin_id').notNullable()
      t.string('body', 1000).notNullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.unique(['user_id', 'skin_id'])
      t.index(['skin_id', 'created_at'])
      t.index(['created_at'])
    })
    this.schema.createTable('invade_skin_review_like', (t) => {
      t.uuid('review_id')
        .notNullable()
        .references('id')
        .inTable('invade_skin_review')
        .onDelete('CASCADE')
      t.uuid('user_id').notNullable().references('id').inTable('invade_user').onDelete('CASCADE')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.primary(['review_id', 'user_id'])
    })

    for (const table of ['invade_skin_like', 'invade_skin_wish']) {
      this.schema.createTable(table, (t) => {
        t.uuid('user_id').notNullable().references('id').inTable('invade_user').onDelete('CASCADE')
        t.integer('skin_id').notNullable()
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
        t.primary(['user_id', 'skin_id'])
        t.index(['skin_id'])
      })
    }

    /** A person's lists of skins ("Every Ezreal skin, ranked"), in their order. */
    this.schema.createTable('invade_skin_list', (t) => {
      t.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      t.uuid('user_id')
        .notNullable()
        .references('id')
        .inTable('invade_user')
        .onDelete('CASCADE')
        .index()
      t.string('title', 80).notNullable()
      t.string('body', 500).notNullable().defaultTo('')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.createTable('invade_skin_list_item', (t) => {
      t.uuid('list_id')
        .notNullable()
        .references('id')
        .inTable('invade_skin_list')
        .onDelete('CASCADE')
      t.integer('skin_id').notNullable()
      t.smallint('position').notNullable()
      t.primary(['list_id', 'skin_id'])
      t.index(['skin_id'])
    })
    this.schema.createTable('invade_skin_list_like', (t) => {
      t.uuid('list_id')
        .notNullable()
        .references('id')
        .inTable('invade_skin_list')
        .onDelete('CASCADE')
      t.uuid('user_id').notNullable().references('id').inTable('invade_user').onDelete('CASCADE')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.primary(['list_id', 'user_id'])
    })
  }

  async down() {
    for (const table of [
      'invade_skin_list_like',
      'invade_skin_list_item',
      'invade_skin_list',
      'invade_skin_wish',
      'invade_skin_like',
      'invade_skin_review_like',
      'invade_skin_review',
      'invade_skin_rating',
      'invade_owned_skin',
      'invade_collection_read',
      'invade_verified_pro',
      'invade_profile',
    ]) {
      this.schema.dropTableIfExists(table)
    }
  }
}
