import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { ACCOUNT_TAGS, type AccountTag } from '../../../inertia/lib/invade_profile.js'

/**
 * The views the admin dashboard keeps for core in its own schema (invadelol/admin,
 * migrations/005_moderation.sql): suspended Invade accounts, their Founder and Team tags, and the
 * clips and comments taken down. Core only reads them.
 */
const VIEWS = {
  bans: 'admin.active_ban',
  tags: 'admin.active_tag',
  removals: 'admin.removed_content',
} as const

type ViewName = keyof typeof VIEWS
type Present = Record<ViewName, boolean>

const NONE: Present = { bans: false, tags: false, removals: false }
/** How long the answer to "are the views here, and may core read them" is kept. */
const PROBE_MS = 60_000

/**
 * Whether a view can be read: the schema exists and core may use it, then the view exists and
 * core may select from it. Each step only runs once the one before it holds (a privilege check
 * on a missing schema or view is an error, not a no).
 */
const readable = (view: string) => `
  CASE
    WHEN to_regnamespace('admin') IS NULL THEN false
    WHEN NOT has_schema_privilege('admin', 'USAGE') THEN false
    WHEN to_regclass('${view}') IS NULL THEN false
    ELSE has_table_privilege('${view}', 'SELECT')
  END`

/**
 * SQL conditions that leave out what moderation hides, for the queries that show people and what
 * they posted. Each takes a column expression of the query it goes in (never a value) and is
 * `true` when the admin's views are not on this database.
 */
export class Visibility {
  constructor(private readonly present: Present) {}

  /** Whether anything can be hidden at all: no condition is needed otherwise. */
  get active() {
    return this.present.bans || this.present.removals
  }

  /** True when the Invade account `id` (a uuid) is not suspended. */
  person(id: string) {
    return this.present.bans
      ? `NOT EXISTS (SELECT 1 FROM admin.active_ban mod_ban WHERE mod_ban.user_id = ${id})`
      : 'true'
  }

  /** True when the clip `id` was not taken down. */
  clip(id: string) {
    return this.removed('clip', id)
  }

  /** True when the comment `id` (as text) was not taken down. */
  comment(id: string) {
    return this.removed('comment', id)
  }

  /**
   * True when the comment `alias` (a row of `invade_clip_comment`) shows in its thread: its writer
   * is not suspended, it was not taken down, and neither was the comment it answers (nor is that
   * comment's writer suspended). A reply never outlives the conversation it belongs to.
   */
  thread(alias: string) {
    if (!this.active) return 'true'
    return `(${this.person(`${alias}.user_id`)} AND ${this.comment(`${alias}.id::text`)}
      AND (${alias}.parent_id IS NULL OR EXISTS (
        SELECT 1 FROM invade_clip_comment mod_parent
        WHERE mod_parent.id = ${alias}.parent_id
          AND ${this.person('mod_parent.user_id')} AND ${this.comment('mod_parent.id::text')})))`
  }

  private removed(kind: 'clip' | 'comment', id: string) {
    return this.present.removals
      ? `NOT EXISTS (SELECT 1 FROM admin.removed_content mod_rm
          WHERE mod_rm.kind = '${kind}' AND mod_rm.target_id = ${id})`
      : 'true'
  }
}

/**
 * What the team decided about Invade accounts and their posts, as core reads it: who is
 * suspended, who carries the Founder or Team tag, which clips and comments were taken down. A
 * database without the admin's views (or a core role without the grant to read them) has no bans,
 * tags or removals, and every page works as before.
 */
class ModerationService {
  #probe: { at: number; present: Present } | null = null

  private async present(): Promise<Present> {
    if (this.#probe && Date.now() - this.#probe.at < PROBE_MS) return this.#probe.present
    let present = NONE
    try {
      const columns = Object.entries(VIEWS).map(([name, view]) => `${readable(view)} AS ${name}`)
      const result = await db.rawQuery(`SELECT ${columns.join(', ')}`)
      const row = result.rows[0] ?? {}
      present = { bans: !!row.bans, tags: !!row.tags, removals: !!row.removals }
    } catch (error) {
      logger.warn({ err: error }, 'moderation views unreadable')
    }
    this.#probe = { at: Date.now(), present }
    return present
  }

  /** Reads the views' presence again on the next call (after the admin migrated, in tests). */
  refresh() {
    this.#probe = null
  }

  /** The conditions that hide suspended people and removed content in a query. */
  async visibility(): Promise<Visibility> {
    return new Visibility(await this.present())
  }

  /** Whether the Invade account is suspended. */
  async suspended(userId: string): Promise<boolean> {
    const present = await this.present()
    if (!present.bans) return false
    const result = await db.rawQuery(`SELECT 1 FROM admin.active_ban WHERE user_id = ? LIMIT 1`, [
      userId,
    ])
    return result.rows.length > 0
  }

  /** The tags the team put on an Invade account, Founder first. */
  async tags(userId: string): Promise<AccountTag[]> {
    const present = await this.present()
    if (!present.tags) return []
    try {
      const result = await db.rawQuery(`SELECT tag FROM admin.active_tag WHERE user_id = ?`, [
        userId,
      ])
      const on = new Set(result.rows.map((row: { tag: string }) => row.tag))
      return ACCOUNT_TAGS.filter((tag) => on.has(tag))
    } catch (error) {
      logger.warn({ err: error }, 'account tags unreadable')
      return []
    }
  }

  /**
   * The clips and comments taken down before `before` that are still stored: what the sweep
   * deletes for good.
   */
  async removedBefore(before: Date): Promise<{ clips: string[]; comments: string[] }> {
    const present = await this.present()
    if (!present.removals) return { clips: [], comments: [] }
    const [clips, comments] = await Promise.all([
      db.rawQuery(
        `SELECT c.id FROM admin.removed_content r JOIN invade_clip c ON c.id = r.target_id
         WHERE r.kind = 'clip' AND r.removed_at < ?`,
        [before]
      ),
      db.rawQuery(
        `SELECT cc.id FROM admin.removed_content r
         JOIN invade_clip_comment cc ON cc.id::text = r.target_id
         WHERE r.kind = 'comment' AND r.removed_at < ?`,
        [before]
      ),
    ])
    return {
      clips: clips.rows.map((row: { id: string }) => row.id),
      comments: comments.rows.map((row: { id: string }) => row.id),
    }
  }
}

export default new ModerationService()
