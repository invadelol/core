import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Invade accounts: a person who signs in on the site with Discord or Google, the browser sessions
 * of that person, the desktop apps they connected, the League accounts the desktop app proved they
 * play on, and their favorite players sorted into folders.
 *
 * Additive and safe on a live database: new tables only, nothing existing is altered. An Invade
 * account is not a League account and not a desktop device: the three are joined here, never
 * merged. Only provider subjects identify a person (no e-mail address is asked for or stored).
 */
export default class CreateInvadeAccounts extends BaseSchema {
  async up() {
    this.schema.createTable('invade_user', (t) => {
      t.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      t.string('display_name', 64).notNullable()
      // The League account opened first on the site and in the app. One the user owns (below).
      t.text('main_puuid')
        .nullable()
        .references('puuid')
        .inTable('riot_player')
        .onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('last_seen_at', { useTz: true }).nullable()
    })

    /** A sign-in method: the provider's own stable id for the person (Discord user id, Google `sub`). */
    this.schema.createTable('invade_identity', (t) => {
      t.string('provider', 16).notNullable()
      t.string('subject', 255).notNullable()
      t.uuid('user_id')
        .notNullable()
        .references('id')
        .inTable('invade_user')
        .onDelete('CASCADE')
      t.string('display_name', 100).nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.primary(['provider', 'subject'])
      // One Discord and one Google per Invade account.
      t.unique(['user_id', 'provider'])
    })

    /** Browser sessions. Only the SHA-256 of the cookie's token is kept. */
    this.schema.createTable('invade_session', (t) => {
      t.specificType('token_hash', 'char(64)').primary()
      t.uuid('user_id')
        .notNullable()
        .references('id')
        .inTable('invade_user')
        .onDelete('CASCADE')
        .index()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('expires_at', { useTz: true }).notNullable().index()
    })

    /** The desktop app (a registered device) a person connected to their account. */
    this.schema.createTable('invade_device_user', (t) => {
      t.uuid('device_id')
        .primary()
        .references('id')
        .inTable('desktop_device')
        .onDelete('CASCADE')
      t.uuid('user_id')
        .notNullable()
        .references('id')
        .inTable('invade_user')
        .onDelete('CASCADE')
        .index()
      t.timestamp('linked_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    /** A short-lived link the desktop app opens in the browser to connect itself. */
    this.schema.createTable('invade_pairing', (t) => {
      t.specificType('code_hash', 'char(64)').primary()
      t.uuid('device_id')
        .notNullable()
        .references('id')
        .inTable('desktop_device')
        .onDelete('CASCADE')
        .index()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('expires_at', { useTz: true }).notNullable()
      t.timestamp('approved_at', { useTz: true }).nullable()
      t.uuid('user_id').nullable().references('id').inTable('invade_user').onDelete('CASCADE')
    })

    /**
     * League accounts a person plays on, each proven by a connected desktop app that saw it signed
     * in to the League client. One owner per League account: a newer proof from another person
     * moves it. `removed_at`: the owner said it is not theirs; the app does not add it back on its
     * own, only when asked.
     */
    this.schema.createTable('invade_owned_account', (t) => {
      t.text('puuid').primary().references('puuid').inTable('riot_player').onDelete('CASCADE')
      t.uuid('user_id')
        .notNullable()
        .references('id')
        .inTable('invade_user')
        .onDelete('CASCADE')
        .index()
      t.uuid('device_id')
        .nullable()
        .references('id')
        .inTable('desktop_device')
        .onDelete('SET NULL')
      t.timestamp('verified_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('removed_at', { useTz: true }).nullable()
    })

    this.schema.createTable('invade_favorite_folder', (t) => {
      // Made by the client, so an app can create a folder and file a player in it offline-first.
      t.uuid('id').primary()
      t.uuid('user_id')
        .notNullable()
        .references('id')
        .inTable('invade_user')
        .onDelete('CASCADE')
        .index()
      t.string('name', 40).notNullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.raw(
      'CREATE UNIQUE INDEX invade_favorite_folder_name_uq ON invade_favorite_folder (user_id, lower(name))'
    )

    this.schema.createTable('invade_profile_favorite', (t) => {
      t.uuid('user_id')
        .notNullable()
        .references('id')
        .inTable('invade_user')
        .onDelete('CASCADE')
      t.text('puuid').notNullable().references('puuid').inTable('riot_player').onDelete('CASCADE')
      // Deleting a folder keeps its players, unfiled.
      t.uuid('folder_id')
        .nullable()
        .references('id')
        .inTable('invade_favorite_folder')
        .onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.primary(['user_id', 'puuid'])
    })
  }

  async down() {
    for (const table of [
      'invade_profile_favorite',
      'invade_favorite_folder',
      'invade_owned_account',
      'invade_pairing',
      'invade_device_user',
      'invade_session',
      'invade_identity',
      'invade_user',
    ]) {
      this.schema.dropTableIfExists(table)
    }
  }
}
