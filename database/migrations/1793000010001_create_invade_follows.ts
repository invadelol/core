import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Follows: a person (an Invade account) follows another person, a League account (any player
 * page) or a professional player. Two people who follow each other are friends.
 *
 * `target_id` is the followed person's id, the League account's API PUUID or the pro's slug, so
 * one table holds the three kinds; a target that goes away is dropped where it is read. Additive
 * and safe on a live database: one new table.
 */
export default class CreateInvadeFollows extends BaseSchema {
  async up() {
    this.schema.createTable('invade_follow', (t) => {
      t.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      t.uuid('follower_id')
        .notNullable()
        .references('id')
        .inTable('invade_user')
        .onDelete('CASCADE')
      t.text('target_kind').notNullable()
      t.text('target_id').notNullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.unique(['follower_id', 'target_kind', 'target_id'])
      t.check(`target_kind IN ('user', 'player', 'pro')`, [], 'invade_follow_target_kind')
      // Followers of one target, newest first.
      t.index(['target_kind', 'target_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTableIfExists('invade_follow')
  }
}
