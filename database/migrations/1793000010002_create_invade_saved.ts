import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Saved items: the clips and matches a person keeps (the account's Favorites), the same on the
 * site and in the app. `target_id` is the clip's id or the match id; one that goes away is
 * dropped where it is read. A match is kept as one player's game (`puuid`, the player whose page
 * it was saved from), and drawn from their side. Additive and safe on a live database: one new
 * table.
 */
export default class CreateInvadeSaved extends BaseSchema {
  async up() {
    this.schema.createTable('invade_saved', (t) => {
      t.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      t.uuid('user_id').notNullable().references('id').inTable('invade_user').onDelete('CASCADE')
      t.text('kind').notNullable()
      t.text('target_id').notNullable()
      t.text('puuid').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.unique(['user_id', 'kind', 'target_id'])
      t.check(`kind IN ('clip', 'match')`, [], 'invade_saved_kind')
      t.index(['user_id', 'created_at'])
      // A clip deleted by its owner leaves every saved copy at once.
      t.index(['kind', 'target_id'])
    })
  }

  async down() {
    this.schema.dropTableIfExists('invade_saved')
  }
}
