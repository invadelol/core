import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Clips: a moment of a game, recorded and posted from the desktop app by a signed-in person, on
 * its own page and beside its match; the comments on it (one level of replies) and the GGs on
 * clips and comments. The video and its poster live in the clip storage
 * (app/services/clips/storage.ts), keyed by the clip's id; these tables hold what the pages show.
 *
 * Additive and safe on a live database: new tables only.
 */
export default class CreateInvadeClips extends BaseSchema {
  async up() {
    this.schema.createTable('invade_clip', (t) => {
      // Short and random: the clip's address (`/clip/<id>`), never guessable from another one.
      t.string('id', 16).primary()
      t.uuid('user_id').notNullable().references('id').inTable('invade_user').onDelete('CASCADE')
      // The poster's League account in that game: one the person owns.
      t.text('puuid').notNullable().references('puuid').inTable('riot_player').onDelete('CASCADE')
      t.text('match_id').notNullable()
      t.string('platform', 8).notNullable()
      t.integer('champion_id').notNullable()
      // Where in the game the clip starts, and how long it lasts (ms).
      t.integer('start_ms').notNullable()
      t.integer('duration_ms').notNullable()
      t.string('title', 80).notNullable()
      // everyone: on the match page and the profiles; link: whoever has the link; private: its
      // owner only.
      t.string('visibility', 8).notNullable()
      // Who may comment: everyone, the game's players, no one.
      t.string('comments', 8).notNullable()
      // uploading until the app said both files are up and they checked out.
      t.string('status', 10).notNullable().defaultTo('uploading')
      t.bigInteger('bytes').notNullable().defaultTo(0)
      // What happened in it at game times (the app's Live Client events, champions only), and
      // each kill's damage recap from Riot's match timeline once it was read.
      t.jsonb('events').notNullable().defaultTo('[]')
      t.jsonb('recap').nullable()
      t.integer('views').notNullable().defaultTo(0)
      // Pinned on its owner's profile.
      t.timestamp('pinned_at', { useTz: true }).nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('ready_at', { useTz: true }).nullable()
      // One clip of a game per account: posting another replaces it.
      t.unique(['user_id', 'match_id'])
      t.index(['match_id'])
      t.index(['puuid', 'created_at'])
      t.check(`visibility IN ('everyone', 'link', 'private')`, [], 'invade_clip_visibility')
      t.check(`comments IN ('everyone', 'game', 'off')`, [], 'invade_clip_comments')
      t.check(`status IN ('uploading', 'ready')`, [], 'invade_clip_status')
    })

    this.schema.createTable('invade_clip_comment', (t) => {
      t.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      t.string('clip_id', 16)
        .notNullable()
        .references('id')
        .inTable('invade_clip')
        .onDelete('CASCADE')
      t.uuid('user_id').notNullable().references('id').inTable('invade_user').onDelete('CASCADE')
      // A reply answers a comment; replies are never answered themselves (one level).
      t.uuid('parent_id')
        .nullable()
        .references('id')
        .inTable('invade_clip_comment')
        .onDelete('CASCADE')
      t.string('body', 500).notNullable()
      // The moment of the clip the comment is about (ms from its start), when it names one.
      t.integer('at_ms').nullable()
      // The champion the commenter played in the clip's game, when they played in it.
      t.integer('champion_id').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.index(['clip_id', 'created_at'])
      t.index(['parent_id'])
    })

    /** A GG: one person's nod to a clip or a comment. */
    this.schema.createTable('invade_gg', (t) => {
      t.uuid('user_id').notNullable().references('id').inTable('invade_user').onDelete('CASCADE')
      t.string('target_kind', 8).notNullable()
      t.text('target_id').notNullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.primary(['user_id', 'target_kind', 'target_id'])
      t.index(['target_kind', 'target_id'])
      t.check(`target_kind IN ('clip', 'comment')`, [], 'invade_gg_target_kind')
    })
  }

  async down() {
    this.schema.dropTableIfExists('invade_gg')
    this.schema.dropTableIfExists('invade_clip_comment')
    this.schema.dropTableIfExists('invade_clip')
  }
}
