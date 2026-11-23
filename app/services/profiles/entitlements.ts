import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'

/** What an Invade account holds: Invade+ (`premium`) and the beta, granted by hand. */
export interface Entitlements {
  premium: boolean
  beta: boolean
}

const NONE: Entitlements = { premium: false, beta: false }
/** How long the answer to "is the admin schema here" is kept. */
const PROBE_MS = 60_000

/**
 * Reads `admin.active_entitlement`, the live grants the admin dashboard writes. A grant is on the
 * Invade account itself or, given before the person had one, on one of the League accounts they
 * own. The view is not in every environment and core may lack the grant to read it: either way
 * nobody holds anything, and pages render as for a free account.
 */
class EntitlementService {
  #probe: { at: number; ok: boolean } | null = null

  private async available() {
    if (this.#probe && Date.now() - this.#probe.at < PROBE_MS) return this.#probe.ok
    try {
      const result = await db.rawQuery(
        `SELECT to_regclass('admin.active_entitlement') IS NOT NULL AS ok`
      )
      this.#probe = { at: Date.now(), ok: Boolean(result.rows[0]?.ok) }
    } catch {
      this.#probe = { at: Date.now(), ok: false }
    }
    return this.#probe.ok
  }

  async of(userId: string): Promise<Entitlements> {
    if (!(await this.available())) return NONE
    try {
      const result = await db.rawQuery(
        `SELECT DISTINCT e.kind FROM admin.active_entitlement e
         WHERE e.user_id = :user
            OR e.puuid IN (
              SELECT puuid FROM invade_owned_account WHERE user_id = :user AND removed_at IS NULL
            )`,
        { user: userId }
      )
      const kinds = new Set(result.rows.map((row: { kind: string }) => row.kind))
      return { premium: kinds.has('premium'), beta: kinds.has('beta') }
    } catch (error) {
      logger.warn({ err: error }, 'entitlements unreadable')
      return NONE
    }
  }
}

export default new EntitlementService()
