import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Builds a person keeps on their account: the ones they made in the desktop app (synced as a
 * whole set, each known to the app by its own id), and the ones they saved from someone else's
 * shared page. A shared build has its own page (`/build/<id>`), which counts how often it was
 * opened; how often it was imported is how many people saved it.
 *
 * Additive and safe on a live database: new tables only.
 */
export default class CreateInvadeBuilds extends BaseSchema {
  async up() {
    this.schema.createTable('invade_build', (t) => {
      // Short and random: the page's address, never guessable from another one.
      t.string('id', 12).primary()
      t.uuid('user_id').notNullable().references('id').inTable('invade_user').onDelete('CASCADE')
      // The app's own id for the build: a sync matches its builds by it.
      t.uuid('local_id').notNullable()
      t.integer('champion_id').notNullable()
      t.string('lane', 8).notNullable()
      t.string('name', 40).notNullable().defaultTo('')
      // The build's items and max order, as a version 2 build link writes them (build_link.ts).
      t.text('code').notNullable()
      t.boolean('shared').notNullable().defaultTo(false)
      t.integer('opens').notNullable().defaultTo(0)
      t.timestamp('updated_at', { useTz: true }).notNullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.unique(['user_id', 'local_id'])
      t.check(`lane IN ('top', 'jungle', 'mid', 'bottom', 'support')`, [], 'invade_build_lane')
    })

    this.schema.createTable('invade_build_saved', (t) => {
      t.uuid('user_id').notNullable().references('id').inTable('invade_user').onDelete('CASCADE')
      t.string('build_id', 12)
        .notNullable()
        .references('id')
        .inTable('invade_build')
        .onDelete('CASCADE')
        .index()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.primary(['user_id', 'build_id'])
    })
  }

  async down() {
    this.schema.dropTableIfExists('invade_build_saved')
    this.schema.dropTableIfExists('invade_build')
  }
}
