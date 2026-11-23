import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Reports: a signed-in person tells the team that a clip or a comment breaks the rules. One
 * report per person and target. The team reads them in its dashboard and keeps its decisions in
 * its own schema; core never changes a report once sent.
 *
 * A report keeps the reported content's author and an excerpt (the clip's title, the comment's
 * text) so it still says what was reported once the content is deleted: the target has no
 * foreign key for that reason. The reporter's and the author's accounts take their reports with
 * them when deleted.
 *
 * Additive and safe on a live database: a new table only.
 */
export default class CreateInvadeReports extends BaseSchema {
  async up() {
    this.schema.createTable('invade_report', (t) => {
      t.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      t.uuid('reporter_id')
        .notNullable()
        .references('id')
        .inTable('invade_user')
        .onDelete('CASCADE')
      t.string('target_kind', 8).notNullable()
      // The clip's id, or the comment's.
      t.text('target_id').notNullable()
      // The clip itself, or the comment's clip.
      t.string('clip_id', 16).notNullable()
      t.uuid('author_id').notNullable().references('id').inTable('invade_user').onDelete('CASCADE')
      t.string('excerpt', 500).notNullable()
      t.string('reason', 12).notNullable()
      t.string('note', 280).nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.unique(['reporter_id', 'target_kind', 'target_id'])
      // The reports on one target, and those about one person, newest first.
      t.index(['target_kind', 'target_id'])
      t.index(['author_id', 'created_at'])
      t.index(['created_at'])
      t.check(`target_kind IN ('clip', 'comment')`, [], 'invade_report_target_kind')
      t.check(
        `reason IN ('spam', 'harassment', 'cheating', 'explicit', 'other')`,
        [],
        'invade_report_reason'
      )
    })
  }

  async down() {
    this.schema.dropTableIfExists('invade_report')
  }
}
