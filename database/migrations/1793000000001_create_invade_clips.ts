import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Clips: a moment of a game, recorded and posted from the desktop app by a signed-in person, on
 * its own page and beside its match. The video and its poster live in the clip storage
 * (app/services/clips/storage.ts), keyed by the clip's id; this table holds what the pages show.
 *
 * Additive and safe on a live database: one new table.
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
      // Where in the game the clip starts, seconds, and how long it lasts.
      t.integer('game_time').notNullable()
      t.integer('duration_ms').notNullable()
      t.string('title', 80).notNullable()
      // What the recorder caught: kill, death, assist, objective, manual.
      t.string('event', 16).notNullable()
      // everyone: on the match page and the profile; link: only who has the link.
      t.string('visibility', 8).notNullable().defaultTo('everyone')
      // pending until its video arrived.
      t.string('status', 8).notNullable().defaultTo('pending')
      t.integer('bytes').notNullable().defaultTo(0)
      t.integer('width').nullable()
      t.integer('height').nullable()
      t.boolean('has_poster').notNullable().defaultTo(false)
      t.integer('views').notNullable().defaultTo(0)
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('ready_at', { useTz: true }).nullable()
      t.index(['match_id'])
      t.index(['puuid', 'created_at'])
      t.index(['user_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTableIfExists('invade_clip')
  }
}
