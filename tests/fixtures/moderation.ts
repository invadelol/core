import db from '@adonisjs/lucid/services/db'
import moderation from '#services/moderation/moderation'

/**
 * The admin dashboard owns the `admin` schema and migrates it itself (invadelol/admin,
 * migrations/005_moderation.sql). These are the moderation tables and the views core reads, made
 * here as they are there when the test database lacks them.
 */
export async function moderationSchema() {
  await db.rawQuery(`CREATE SCHEMA IF NOT EXISTS admin`)
  await db.rawQuery(`CREATE TABLE IF NOT EXISTS admin.account_ban (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, label text NOT NULL,
    reason text NOT NULL, banned_by uuid, banned_at timestamptz NOT NULL DEFAULT now(),
    lifted_at timestamptz, lifted_by uuid, lift_note text NOT NULL DEFAULT '')`)
  await db.rawQuery(`CREATE UNIQUE INDEX IF NOT EXISTS account_ban_live_uq
    ON admin.account_ban (user_id) WHERE lifted_at IS NULL`)
  await db.rawQuery(`CREATE OR REPLACE VIEW admin.active_ban AS
    SELECT user_id, banned_at FROM admin.account_ban WHERE lifted_at IS NULL`)
  await db.rawQuery(`CREATE TABLE IF NOT EXISTS admin.account_tag (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, tag text NOT NULL,
    label text NOT NULL, added_by uuid, added_at timestamptz NOT NULL DEFAULT now(),
    removed_at timestamptz, removed_by uuid)`)
  await db.rawQuery(`CREATE UNIQUE INDEX IF NOT EXISTS account_tag_live_uq
    ON admin.account_tag (user_id, tag) WHERE removed_at IS NULL`)
  await db.rawQuery(`CREATE OR REPLACE VIEW admin.active_tag AS
    SELECT user_id, tag, added_at FROM admin.account_tag WHERE removed_at IS NULL`)
  await db.rawQuery(`CREATE TABLE IF NOT EXISTS admin.content_removal (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, target_id text NOT NULL,
    clip_id text NOT NULL, author_id uuid NOT NULL, excerpt text NOT NULL DEFAULT '',
    reason text NOT NULL, removed_by uuid, removed_at timestamptz NOT NULL DEFAULT now(),
    restored_at timestamptz, restored_by uuid)`)
  await db.rawQuery(`CREATE UNIQUE INDEX IF NOT EXISTS content_removal_live_uq
    ON admin.content_removal (kind, target_id) WHERE restored_at IS NULL`)
  await db.rawQuery(`CREATE OR REPLACE VIEW admin.removed_content AS
    SELECT kind, target_id, removed_at FROM admin.content_removal WHERE restored_at IS NULL`)
  // Core reads whether the views are there once a minute: these were just made.
  moderation.refresh()
}

/**
 * What the team decides in its dashboard, written as the dashboard writes it, and taken back
 * after each test: every row is about a person the test created.
 */
export class TeamDecisions {
  private people = new Set<string>()

  async ban(userId: string, reason = 'Spam in comments') {
    this.people.add(userId)
    await db.table('admin.account_ban').insert({ user_id: userId, label: 'test', reason })
  }

  async lift(userId: string) {
    await db
      .from('admin.account_ban')
      .where('user_id', userId)
      .whereNull('lifted_at')
      .update({ lifted_at: new Date() })
  }

  async tag(userId: string, tag: 'founder' | 'team') {
    this.people.add(userId)
    await db.table('admin.account_tag').insert({ user_id: userId, tag, label: 'test' })
  }

  /** Takes a clip or a comment down, `daysAgo` days ago. */
  async remove(
    target: { kind: 'clip' | 'comment'; id: string; clipId: string; authorId: string },
    daysAgo = 0
  ) {
    this.people.add(target.authorId)
    await db.table('admin.content_removal').insert({
      kind: target.kind,
      target_id: target.id,
      clip_id: target.clipId,
      author_id: target.authorId,
      reason: 'Harassment or hate',
      removed_at: new Date(Date.now() - daysAgo * 86_400_000),
    })
  }

  async restore(kind: 'clip' | 'comment', id: string) {
    await db
      .from('admin.content_removal')
      .where({ kind, target_id: id })
      .whereNull('restored_at')
      .update({ restored_at: new Date() })
  }

  async cleanup() {
    const people = [...this.people]
    if (!people.length) return
    await db.from('admin.account_ban').whereIn('user_id', people).delete()
    await db.from('admin.account_tag').whereIn('user_id', people).delete()
    await db.from('admin.content_removal').whereIn('author_id', people).delete()
    this.people.clear()
  }
}
