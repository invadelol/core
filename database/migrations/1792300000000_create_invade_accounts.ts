import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('invade_user', (t) => {
      t.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      t.string('provider', 16).notNullable()
      t.string('subject', 255).notNullable()
      t.string('display_name', 100).notNullable()
      t.text('main_puuid')
        .nullable()
        .references('puuid')
        .inTable('riot_player')
        .onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.unique(['provider', 'subject'])
    })
    this.schema.createTable('invade_session', (t) => {
      t.string('token_hash', 64).primary()
      t.uuid('user_id').notNullable().references('id').inTable('invade_user').onDelete('CASCADE')
      t.timestamp('expires_at', { useTz: true }).notNullable().index()
    })
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
    this.schema.createTable('invade_pairing', (t) => {
      t.string('code_hash', 64).primary()
      t.uuid('device_id')
        .notNullable()
        .references('id')
        .inTable('desktop_device')
        .onDelete('CASCADE')
        .index()
      t.timestamp('expires_at', { useTz: true }).notNullable()
      t.timestamp('approved_at', { useTz: true }).nullable()
    })
    this.schema.createTable('invade_owned_account', (t) => {
      t.uuid('user_id').notNullable().references('id').inTable('invade_user').onDelete('CASCADE')
      t.text('puuid').notNullable().references('puuid').inTable('riot_player').onDelete('CASCADE')
      t.uuid('device_id').nullable().references('id').inTable('desktop_device').onDelete('SET NULL')
      t.timestamp('verified_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.primary(['user_id', 'puuid'])
    })
    this.schema.createTable('invade_favorite_folder', (t) => {
      t.uuid('id').primary()
      t.uuid('user_id')
        .notNullable()
        .references('id')
        .inTable('invade_user')
        .onDelete('CASCADE')
        .index()
      t.string('name', 40).notNullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.unique(['user_id', 'name'])
    })
    this.schema.createTable('invade_profile_favorite', (t) => {
      t.uuid('user_id').notNullable().references('id').inTable('invade_user').onDelete('CASCADE')
      t.text('puuid').notNullable().references('puuid').inTable('riot_player').onDelete('CASCADE')
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
      'invade_user',
    ])
      this.schema.dropTable(table)
  }
}
