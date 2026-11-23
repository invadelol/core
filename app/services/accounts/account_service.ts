import { randomBytes } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { AccountError } from '#services/accounts/errors'
import { isHandle } from '#services/accounts/handles'
import { accountOrigin, digest, type SignedIn } from '#services/accounts/session_service'
import followService from '#services/social/follows'
import savedService from '#services/social/saved'
import {
  PROFILE_COLUMNS,
  PUUID,
  RANK_JOIN,
  SHOWN_MAIN_COLUMNS,
  SHOWN_MAIN_JOIN,
  UUID,
  avatarOf,
  iso,
  profileOf,
} from '#services/social/cards'
import {
  ACCOUNT_LIMITS,
  emptyAccount,
  type AccountProfile,
  type AccountProvider,
  type AccountSettings,
  type InvadeAccountData,
  type SiteAccountOp,
  type Viewer,
} from '../../../inertia/lib/account_types.js'

const PAIRING_MINUTES = 10
/** A link's secret: 24 random bytes, 32 characters in the URL. */
const PAIRING_CODE = /^[A-Za-z0-9_-]{32}$/

const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)
const isPuuid = (value: unknown): value is string => typeof value === 'string' && PUUID.test(value)

function cleanName(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const name = value.replace(/\s+/g, ' ').trim()
  return name.length >= 1 && name.length <= max ? name : null
}

/** Where the changes come from: the app sends §10.4's, the site those and its own. */
export type ChangeSource = 'app' | 'site'
const APP_OPS = new Set(['follow', 'unfollow', 'save', 'unsave', 'main', 'show'])

/** The settings columns, by the name the pages and the app use. */
const SETTING_COLUMNS = {
  clipVisibility: 'clip_visibility',
  clipComments: 'clip_comments',
  clipsOnProfile: 'clips_on_profile',
  allowTags: 'allow_tags',
  streamerMode: 'streamer_mode',
} as const satisfies Record<keyof AccountSettings, string>

const SETTING_VALUES: Record<keyof AccountSettings, (value: unknown) => boolean> = {
  clipVisibility: (v) => v === 'everyone' || v === 'link' || v === 'private',
  clipComments: (v) => v === 'everyone' || v === 'game' || v === 'off',
  clipsOnProfile: (v) => typeof v === 'boolean',
  allowTags: (v) => typeof v === 'boolean',
  streamerMode: (v) => typeof v === 'boolean',
}

function settingsOf(row: Record<string, unknown>): AccountSettings {
  return {
    clipVisibility: row.clip_visibility as AccountSettings['clipVisibility'],
    clipComments: row.clip_comments as AccountSettings['clipComments'],
    clipsOnProfile: Boolean(row.clips_on_profile),
    allowTags: Boolean(row.allow_tags),
    streamerMode: Boolean(row.streamer_mode),
  }
}

/** The person's row with their shown main account (their picture). */
const USER_SQL = `
  SELECT u.*, ${SHOWN_MAIN_COLUMNS}
  FROM invade_user u ${SHOWN_MAIN_JOIN}
  WHERE u.id = ?`

/**
 * Invade accounts: what a signed-in person sees and changes (docs/desktop-sync.md §10). The site
 * and the desktop app call the same methods; who is asking was settled before (a session cookie,
 * or a signed device connected to the account).
 */
class AccountService {
  /** The whole account, as the account page and the app draw it (§10.2). */
  async snapshot(user: SignedIn): Promise<InvadeAccountData> {
    const [found, identities, owned, following, counts, saved, devices, premium] =
      await Promise.all([
        db.rawQuery(USER_SQL, [user.id]),
        db
          .from('invade_identity')
          .where('user_id', user.id)
          .orderBy('created_at')
          .select('provider'),
        db.rawQuery(
          `SELECT ${PROFILE_COLUMNS}, o.verified_at, o.shown
           FROM invade_owned_account o JOIN riot_player p ON p.puuid = o.puuid ${RANK_JOIN}
           WHERE o.user_id = ? AND o.removed_at IS NULL
           ORDER BY o.verified_at`,
          [user.id]
        ),
        followService.following(user.id, { limit: ACCOUNT_LIMITS.follows }),
        followService.counts(user.id),
        savedService.count(user.id),
        db
          .from('invade_device_user as u')
          .join('desktop_device as d', 'd.id', 'u.device_id')
          .where('u.user_id', user.id)
          .whereNull('d.revoked_at')
          .orderBy('u.linked_at')
          .select('d.id', 'd.os', 'd.app', 'd.last_seen_at', 'u.linked_at'),
        this.premium(user.id),
      ])
    const row = found.rows[0]
    if (!row) return emptyAccount()
    return {
      user: {
        id: row.id,
        name: row.display_name,
        handle: row.handle,
        avatarUrl: avatarOf(row),
        providers: identities.map((i) => i.provider as AccountProvider),
        createdAt: iso(row.created_at),
        premium,
      },
      mainPuuid: row.main_puuid ?? null,
      accounts: owned.rows.map((r: Record<string, unknown>) => ({
        ...profileOf(r),
        verifiedAt: iso(r.verified_at),
        shown: Boolean(r.shown),
      })),
      following: following.items,
      counts: { ...counts, saved },
      devices: devices.map((d) => ({
        id: d.id,
        os: d.os,
        app: d.app,
        linkedAt: iso(d.linked_at),
        lastSeenAt: d.last_seen_at ? iso(d.last_seen_at) : null,
      })),
      settings: settingsOf(row),
    }
  }

  /** A person by their handle, as a page about them names them; null for an unknown handle. */
  async byHandle(handle: unknown) {
    if (!isHandle(handle)) return null
    const found = await db.rawQuery(
      `SELECT u.id, u.display_name, u.handle, ${SHOWN_MAIN_COLUMNS}
       FROM invade_user u ${SHOWN_MAIN_JOIN}
       WHERE u.handle = ?`,
      [handle]
    )
    const row = found.rows[0]
    if (!row) return null
    return {
      id: String(row.id),
      name: String(row.display_name),
      handle: String(row.handle),
      avatarUrl: avatarOf(row),
    }
  }

  /**
   * Invade+ on the account (the admin's `active_entitlement` view). Read defensively: a database
   * without the admin schema has no premium accounts.
   */
  async premium(userId: string) {
    try {
      const row = await db
        .from('admin.active_entitlement')
        .where({ user_id: userId, kind: 'premium' })
        .first()
      return Boolean(row)
    } catch {
      return false
    }
  }

  /** What every page shows of the signed-in person (the header's menu): one query, two at most. */
  async viewer(user: SignedIn): Promise<Viewer | null> {
    const counts = await db.rawQuery(
      `SELECT u.id, u.display_name, u.handle, u.main_puuid, ${SHOWN_MAIN_COLUMNS},
         (SELECT count(*) FROM invade_saved s WHERE s.user_id = u.id)::int AS saved,
         (SELECT count(*) FROM invade_follow f WHERE f.follower_id = u.id)::int AS following,
         (SELECT count(*) FROM invade_device_user du JOIN desktop_device d ON d.id = du.device_id
           WHERE du.user_id = u.id AND d.revoked_at IS NULL)::int AS apps
       FROM invade_user u ${SHOWN_MAIN_JOIN}
       WHERE u.id = ?`,
      [user.id]
    )
    const row = counts.rows[0]
    if (!row) return null
    let main: AccountProfile | null = null
    if (row.main_puuid) {
      const found = await db.rawQuery(
        `SELECT ${PROFILE_COLUMNS} FROM riot_player p ${RANK_JOIN} WHERE p.puuid = ?`,
        [row.main_puuid]
      )
      main = found.rows[0] ? profileOf(found.rows[0]) : null
    }
    return {
      id: row.id,
      name: row.display_name,
      handle: row.handle,
      avatarUrl: avatarOf(row),
      main,
      saved: row.saved,
      following: row.following,
      apps: row.apps,
    }
  }

  /**
   * Applies changes in order, all or none, and answers the account as it now is. The app may
   * send §10.4's changes; the site those and its own.
   */
  async change(user: SignedIn, ops: unknown, source: ChangeSource) {
    if (!Array.isArray(ops) || !ops.length || ops.length > ACCOUNT_LIMITS.ops) {
      throw AccountError.invalid(`Send 1 to ${ACCOUNT_LIMITS.ops} changes.`)
    }
    // The person's row is locked for the change: limits and the main account stay consistent
    // when the site and the app write at the same moment.
    await db.transaction(async (trx) => {
      await trx.from('invade_user').where('id', user.id).forUpdate().firstOrFail()
      for (const op of ops) {
        if (!op || typeof op !== 'object' || (source === 'app' && !APP_OPS.has(op.op))) {
          throw AccountError.invalid('Unknown change.')
        }
        await this.apply(trx, user, op as SiteAccountOp)
      }
    })
    return this.snapshot(user)
  }

  private async apply(trx: TransactionClientContract, user: SignedIn, op: SiteAccountOp) {
    switch (op.op) {
      case 'follow':
        return followService.follow(trx, user.id, op.kind, await this.followId(trx, op))
      case 'unfollow':
        return followService.unfollow(trx, user.id, op.kind, await this.followId(trx, op))
      case 'save':
        return savedService.save(trx, user.id, op.kind, op.id, (op as { puuid?: unknown }).puuid)
      case 'unsave':
        return savedService.unsave(trx, user.id, op.kind, op.id)
      case 'main': {
        if (!isPuuid(op.puuid) || !(await this.owns(trx, user.id, op.puuid))) {
          throw AccountError.invalid('Choose one of your own League accounts.')
        }
        await trx.from('invade_user').where('id', user.id).update({ main_puuid: op.puuid })
        return
      }
      case 'show': {
        if (!isPuuid(op.puuid) || typeof op.shown !== 'boolean') {
          throw AccountError.invalid('Unknown League account.')
        }
        const updated = await trx
          .from('invade_owned_account')
          .where({ puuid: op.puuid, user_id: user.id })
          .whereNull('removed_at')
          .update({ shown: op.shown })
        if (!updated) throw AccountError.invalid('Choose one of your own League accounts.')
        return
      }
      case 'notMine': {
        if (!isPuuid(op.puuid)) throw AccountError.invalid('Unknown League account.')
        await trx
          .from('invade_owned_account')
          .where({ puuid: op.puuid, user_id: user.id })
          .update({ removed_at: new Date() })
        await this.settleMain(trx, user.id)
        return
      }
      case 'disconnect': {
        if (!isUuid(op.deviceId)) throw AccountError.invalid('Unknown app.')
        await trx
          .from('invade_device_user')
          .where({ device_id: op.deviceId, user_id: user.id })
          .delete()
        return
      }
      case 'rename': {
        const name = cleanName(op.name, ACCOUNT_LIMITS.displayName)
        if (!name) throw AccountError.invalid('Choose a name of 1 to 32 characters.')
        await trx.from('invade_user').where('id', user.id).update({ display_name: name })
        return
      }
      case 'settings':
        return this.saveSettings(trx, user.id, op.settings)
      default:
        throw AccountError.invalid('Unknown change.')
    }
  }

  /**
   * The followed target's id as it is stored. The app may name a League account by the client's
   * raw PUUID: it is mapped to the API PUUID through a verified alias (§3), never looked up.
   */
  private async followId(
    trx: TransactionClientContract,
    op: { kind: unknown; id: unknown }
  ): Promise<unknown> {
    if (op.kind !== 'player' || !isUuid(op.id)) return op.id
    const alias = await trx
      .from('riot_puuid_alias')
      .where('raw_puuid', op.id.toLowerCase())
      .whereNot('status', 'conflict')
      .first()
    if (!alias) throw AccountError.notFound('This person or player is not on Invade.')
    return alias.puuid
  }

  private async saveSettings(trx: TransactionClientContract, userId: string, input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw AccountError.invalid('Unknown setting.')
    }
    const update: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
      if (!Object.hasOwn(SETTING_COLUMNS, key)) throw AccountError.invalid('Unknown setting.')
      const name = key as keyof AccountSettings
      if (!SETTING_VALUES[name](value)) throw AccountError.invalid('Unknown setting.')
      update[SETTING_COLUMNS[name]] = value
    }
    if (Object.keys(update).length) {
      await trx.from('invade_user').where('id', userId).update(update)
    }
  }

  private async owns(trx: TransactionClientContract, userId: string, puuid: string) {
    return Boolean(
      await trx
        .from('invade_owned_account')
        .where({ user_id: userId, puuid })
        .whereNull('removed_at')
        .first()
    )
  }

  /** The main account stays one the person owns: else their oldest owned account, or none. */
  private async settleMain(trx: TransactionClientContract, userId: string) {
    const row = await trx.from('invade_user').where('id', userId).first()
    if (row?.main_puuid && (await this.owns(trx, userId, row.main_puuid))) return
    const next = await trx
      .from('invade_owned_account')
      .where('user_id', userId)
      .whereNull('removed_at')
      .orderBy('verified_at')
      .first()
    await trx
      .from('invade_user')
      .where('id', userId)
      .update({ main_puuid: next?.puuid ?? null })
  }

  /* ── The desktop app ──────────────────────────────────────────────── */

  /** The Invade account a device is connected to, or null. */
  async deviceUser(deviceId: string): Promise<SignedIn | null> {
    const row = await db
      .from('invade_device_user as d')
      .join('invade_user as u', 'u.id', 'd.user_id')
      .where('d.device_id', deviceId)
      .select('u.id', 'u.display_name')
      .first()
    return row ? { id: row.id, name: row.display_name } : null
  }

  /**
   * A single-use browser link that connects this device to whoever approves it (§10.1). Its
   * 32 characters are the secret: there is no code to read or type. A new link replaces the
   * device's earlier one.
   */
  async pair(deviceId: string) {
    const code = randomBytes(24).toString('base64url')
    const expiresAt = new Date(Date.now() + PAIRING_MINUTES * 60_000)
    await db.transaction(async (trx) => {
      await trx.from('invade_pairing').where('device_id', deviceId).delete()
      await trx
        .table('invade_pairing')
        .insert({ code_hash: digest(code), device_id: deviceId, expires_at: expiresAt })
    })
    return { url: `${accountOrigin()}/account/link/${code}`, expiresAt: expiresAt.getTime() }
  }

  /** What the link page shows before the person says yes: which app, on which system. */
  async pairing(code: unknown, viewer: SignedIn) {
    if (typeof code !== 'string' || !PAIRING_CODE.test(code)) return null
    const row = await db
      .from('invade_pairing as p')
      .join('desktop_device as d', 'd.id', 'p.device_id')
      .leftJoin('invade_device_user as u', 'u.device_id', 'p.device_id')
      .where('p.code_hash', digest(code))
      .whereNull('d.revoked_at')
      .select('p.expires_at', 'p.approved_at', 'd.os', 'd.app', 'u.user_id as owner')
      .first()
    if (!row) return null
    return {
      os: row.os as string,
      app: row.app as string,
      expired: !row.approved_at && new Date(row.expires_at).getTime() < Date.now(),
      approved: Boolean(row.approved_at) && row.owner === viewer.id,
      linkedElsewhere: Boolean(row.owner && row.owner !== viewer.id),
    }
  }

  /** The person said yes in their browser: the device is now theirs. */
  async approve(user: SignedIn, code: unknown) {
    if (typeof code !== 'string' || !PAIRING_CODE.test(code)) throw AccountError.linkExpired()
    await db.transaction(async (trx) => {
      const pair = await trx
        .from('invade_pairing')
        .where('code_hash', digest(code))
        .forUpdate()
        .first()
      if (!pair || pair.approved_at || new Date(pair.expires_at).getTime() < Date.now()) {
        throw AccountError.linkExpired()
      }
      const device = await trx
        .from('desktop_device')
        .where('id', pair.device_id)
        .whereNull('revoked_at')
        .first()
      if (!device) throw AccountError.linkExpired()
      const owner = await trx
        .from('invade_device_user')
        .where('device_id', pair.device_id)
        .forUpdate()
        .first()
      if (owner && owner.user_id !== user.id) throw AccountError.appTaken()
      if (!owner) {
        await trx
          .table('invade_device_user')
          .insert({ device_id: pair.device_id, user_id: user.id })
      }
      await trx
        .from('invade_pairing')
        .where('code_hash', digest(code))
        .update({ approved_at: new Date(), user_id: user.id })
    })
  }

  /** The app disconnects itself; its device, games and local data are untouched. */
  async disconnect(deviceId: string) {
    await db.from('invade_device_user').where('device_id', deviceId).delete()
  }

  /**
   * Proof of a League account (§10.3): the connected app saw it signed in to the League client.
   * The device must hold a client link for that raw PUUID (`POST /link`, `source: lcu`, made when
   * the client signed in) whose mapping to the API PUUID nothing contradicts. A Riot ID alone never
   * proves anything. `auto`: the app's own call at a client sign-in, which does not bring back an
   * account the person removed.
   */
  async verify(deviceId: string, rawPuuid: unknown, options: { auto: boolean }) {
    if (!isUuid(rawPuuid)) throw AccountError.invalid('Unknown League account.')
    const user = await this.deviceUser(deviceId)
    if (!user) throw AccountError.notConnected()
    const raw = rawPuuid.toLowerCase()
    const link = await db
      .from('desktop_device_account')
      .where({ device_id: deviceId, raw_puuid: raw, source: 'lcu' })
      .first()
    if (!link) throw AccountError.notDetected()
    const alias = await db.from('riot_puuid_alias').where('raw_puuid', raw).first()
    if (alias && (alias.status === 'conflict' || alias.puuid !== link.puuid)) {
      throw AccountError.notDetected()
    }

    let added = false
    await db.transaction(async (trx) => {
      await trx.from('invade_user').where('id', user.id).forUpdate().firstOrFail()
      const current = await trx
        .from('invade_owned_account')
        .where('puuid', link.puuid)
        .forUpdate()
        .first()
      if (current?.user_id === user.id && current.removed_at && options.auto) return
      const moved = Boolean(current && current.user_id !== user.id)
      await trx
        .knexQuery()
        .table('invade_owned_account')
        .insert({
          puuid: link.puuid,
          user_id: user.id,
          device_id: deviceId,
          verified_at: new Date(),
          removed_at: null,
          shown: true,
        })
        .onConflict('puuid')
        .merge(['user_id', 'device_id', 'verified_at', 'removed_at', ...(moved ? ['shown'] : [])])
      added = !current || moved || Boolean(current.removed_at)
      if (moved) {
        // The newest proof wins: whoever plays it on their own computer now. The other person's
        // main moves on if it was this one.
        logger.info({ previous: current.user_id, user: user.id }, 'League account changed owner')
        await this.settleMain(trx, current.user_id)
      }
      await trx
        .from('invade_user')
        .where('id', user.id)
        .whereNull('main_puuid')
        .update({ main_puuid: link.puuid })
    })
    return { ...(await this.snapshot(user)), verified: added ? link.puuid : null }
  }

  /**
   * Deletes the account and everything attached to it: its clips and their files, its follows
   * (both ways), its saved items and its builds. League data and the desktop apps stay.
   */
  async remove(user: SignedIn) {
    const { default: clipService } = await import('#services/clips/clip_service')
    const clips = await clipService.idsOf(user.id)
    await clipService.purge(clips)
    await db.transaction(async (trx) => {
      await savedService.forgetClips(trx, clips)
      await followService.forget(trx, user.id)
      await trx.from('invade_user').where('id', user.id).delete()
    })
  }
}

export default new AccountService()
