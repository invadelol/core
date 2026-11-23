import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Invade accounts: a person who signs in on the site with Discord, the browser sessions of that
 * person, the desktop apps they connected, and the League accounts the desktop app proved they
 * play on.
 *
 * Additive and safe on a live database: new tables only, nothing existing is altered. An Invade
 * account is not a League account and not a desktop device: the three are joined here, never
 * merged. Only the provider's subject identifies a person (no e-mail address is asked for or
 * stored).
 */
export default class CreateInvadeAccounts extends BaseSchema {
  async up() {
    this.schema.createTable('invade_user', (t) => {
      t.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      t.string('display_name', 64).notNullable()
      // The person's address on the site (`/u/<handle>`): made from their Discord name at the
      // first sign-in, a number added when it is taken.
      t.string('handle', 24).notNullable().unique()
      // The League account opened first on the site and in the app. One the user owns (below).
      t.text('main_puuid')
        .nullable()
        .references('puuid')
        .inTable('riot_player')
        .onDelete('SET NULL')
      // Privacy: who may watch a new clip and comment on it by default, whether the person's
      // clips show on the profiles of their League accounts, whether others may tag them in
      // their clips, and whether League's Hide My Name keeps them off other people's clips.
      t.string('clip_visibility', 8).notNullable().defaultTo('everyone')
      t.string('clip_comments', 8).notNullable().defaultTo('everyone')
      t.boolean('clips_on_profile').notNullable().defaultTo(true)
      t.boolean('allow_tags').notNullable().defaultTo(true)
      t.boolean('streamer_mode').notNullable().defaultTo(true)
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('last_seen_at', { useTz: true }).nullable()
      t.check(`handle ~ '^[a-z0-9_]{2,24}$'`, [], 'invade_user_handle_format')
      t.check(
        `clip_visibility IN ('everyone', 'link', 'private')`,
        [],
        'invade_user_clip_visibility'
      )
      t.check(`clip_comments IN ('everyone', 'game', 'off')`, [], 'invade_user_clip_comments')
    })

    /** A sign-in method: the provider's own stable id for the person (the Discord user id). */
    this.schema.createTable('invade_identity', (t) => {
      t.string('provider', 16).notNullable()
      t.string('subject', 255).notNullable()
      t.uuid('user_id').notNullable().references('id').inTable('invade_user').onDelete('CASCADE')
      t.string('display_name', 100).nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.primary(['provider', 'subject'])
      // One identity per provider and account.
      t.unique(['user_id', 'provider'])
      t.check(`provider IN ('discord')`, [], 'invade_identity_provider')
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
      t.uuid('device_id').primary().references('id').inTable('desktop_device').onDelete('CASCADE')
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
     * own, only when asked. `shown`: the owner lets their Invade profile show it; hidden until they
     * do.
     */
    this.schema.createTable('invade_owned_account', (t) => {
      t.text('puuid').primary().references('puuid').inTable('riot_player').onDelete('CASCADE')
      t.uuid('user_id')
        .notNullable()
        .references('id')
        .inTable('invade_user')
        .onDelete('CASCADE')
        .index()
      t.uuid('device_id').nullable().references('id').inTable('desktop_device').onDelete('SET NULL')
      t.boolean('shown').notNullable().defaultTo(false)
      t.timestamp('verified_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('removed_at', { useTz: true }).nullable()
    })
  }

  async down() {
    for (const table of [
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
