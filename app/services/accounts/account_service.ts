import { createHash, randomBytes } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import summonerService from '#services/summoner_service'
import { normalizePlatform } from '#services/riot/routing'
import { riotErrorStatus } from '#utils/riot_errors'
import { AccountError } from '#services/accounts/errors'
import { accountOrigin, digest, type SignedIn } from '#services/accounts/session_service'
import {
  ACCOUNT_LIMITS,
  emptyAccount,
  type AccountChange,
  type AccountProfile,
  type AccountProvider,
  type InvadeAccountData,
  type Viewer,
} from '../../../inertia/lib/account_types.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** An API PUUID as the site's routes carry it. */
const PUUID = /^[A-Za-z0-9_-]{20,100}$/
const PAIRING_MINUTES = 10
/** The four characters both the app and the browser show while connecting, to compare. */
const CHECK_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)
const isPuuid = (value: unknown): value is string => typeof value === 'string' && PUUID.test(value)

function cleanName(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const name = value.replace(/\s+/g, ' ').trim()
  return name.length >= 1 && name.length <= max ? name : null
}

/** The latest Solo/Duo rank of each listed player, beside their stored identity. */
const PROFILE_SQL = `
  p.puuid, p.game_name, p.tag_line, p.platform, p.profile_icon_id,
  r.tier, r.division, r.league_points
`
const RANK_JOIN = `
  LEFT JOIN LATERAL (
    SELECT tier, division, league_points FROM riot_rank
    WHERE puuid = p.puuid AND queue_type = 'RANKED_SOLO_5x5'
    ORDER BY fetched_at DESC LIMIT 1
  ) r ON true
`

function profile(row: Record<string, any>): AccountProfile {
  return {
    puuid: row.puuid,
    gameName: row.game_name,
    tagLine: row.tag_line,
    platform: row.platform,
    profileIconId: row.profile_icon_id ?? null,
    tier: row.tier ?? null,
    division: row.division ?? null,
    lp: row.league_points ?? null,
  }
}

const iso = (value: unknown) => new Date(value as string).toISOString()

/** The code both sides show while an app connects (§10.1), from the link's own secret. */
export function pairingCheck(code: string) {
  const bytes = createHash('sha256').update(`check:${code}`).digest()
  return Array.from(bytes.subarray(0, 4), (b) => CHECK_ALPHABET[b % CHECK_ALPHABET.length]).join('')
}

/** A favorite as the app may name it: an API PUUID, the client's raw PUUID, or a Riot ID. */
export interface ProfileRef {
  puuid?: string | null
  gameName?: string | null
  tagLine?: string | null
  platform?: string | null
}

/**
 * Invade accounts: what a signed-in person sees and changes (docs/desktop-sync.md §10). The site
 * and the desktop app call the same methods; who is asking was settled before (a session cookie,
 * or a signed device connected to the account).
 */
class AccountService {
  /** The whole account, as the account page and the app draw it. */
  async snapshot(user: SignedIn): Promise<InvadeAccountData> {
    const [row, identities, owned, folders, favorites, devices] = await Promise.all([
      db.from('invade_user').where('id', user.id).first(),
      db.from('invade_identity').where('user_id', user.id).orderBy('created_at').select('provider'),
      db.rawQuery(
        `SELECT ${PROFILE_SQL}, o.verified_at
         FROM invade_owned_account o JOIN riot_player p ON p.puuid = o.puuid ${RANK_JOIN}
         WHERE o.user_id = ? AND o.removed_at IS NULL
         ORDER BY o.verified_at`,
        [user.id]
      ),
      db
        .from('invade_favorite_folder')
        .where('user_id', user.id)
        .orderBy('created_at')
        .select('id', 'name'),
      db.rawQuery(
        `SELECT ${PROFILE_SQL}, f.folder_id, f.created_at AS added_at
         FROM invade_profile_favorite f JOIN riot_player p ON p.puuid = f.puuid ${RANK_JOIN}
         WHERE f.user_id = ?
         ORDER BY f.created_at DESC`,
        [user.id]
      ),
      db
        .from('invade_device_user as u')
        .join('desktop_device as d', 'd.id', 'u.device_id')
        .where('u.user_id', user.id)
        .whereNull('d.revoked_at')
        .orderBy('u.linked_at')
        .select('d.id', 'd.os', 'd.app', 'd.last_seen_at', 'u.linked_at'),
    ])
    if (!row) return emptyAccount()
    return {
      user: {
        id: row.id,
        name: row.display_name,
        providers: identities.map((i) => i.provider as AccountProvider),
        createdAt: iso(row.created_at),
      },
      mainPuuid: row.main_puuid ?? null,
      accounts: owned.rows.map((r: Record<string, any>) => ({
        ...profile(r),
        verifiedAt: iso(r.verified_at),
      })),
      folders,
      favorites: favorites.rows.map((r: Record<string, any>) => ({
        ...profile(r),
        folderId: r.folder_id ?? null,
        addedAt: iso(r.added_at),
      })),
      devices: devices.map((d) => ({
        id: d.id,
        os: d.os,
        app: d.app,
        linkedAt: iso(d.linked_at),
        lastSeenAt: d.last_seen_at ? iso(d.last_seen_at) : null,
      })),
    }
  }

  /** What every page shows of the signed-in person (the header's menu): one or two small queries. */
  async viewer(user: SignedIn): Promise<Viewer | null> {
    const counts = await db.rawQuery(
      `SELECT u.display_name, u.main_puuid,
         (SELECT count(*) FROM invade_owned_account o
           WHERE o.user_id = u.id AND o.removed_at IS NULL)::int AS accounts,
         (SELECT count(*) FROM invade_profile_favorite f WHERE f.user_id = u.id)::int AS favorites,
         (SELECT count(*) FROM invade_device_user du JOIN desktop_device d ON d.id = du.device_id
           WHERE du.user_id = u.id AND d.revoked_at IS NULL)::int AS apps
       FROM invade_user u WHERE u.id = ?`,
      [user.id]
    )
    const row = counts.rows[0]
    if (!row) return null
    let main: AccountProfile | null = null
    if (row.main_puuid) {
      const found = await db.rawQuery(
        `SELECT ${PROFILE_SQL} FROM riot_player p ${RANK_JOIN} WHERE p.puuid = ?`,
        [row.main_puuid]
      )
      main = found.rows[0] ? profile(found.rows[0]) : null
    }
    return {
      name: row.display_name,
      main,
      accounts: row.accounts,
      favorites: row.favorites,
      apps: row.apps,
    }
  }

  /** Whether a player is one of the person's favorites (a profile's star). */
  async isFavorite(userId: string, puuid: string) {
    return Boolean(
      await db.from('invade_profile_favorite').where({ user_id: userId, puuid }).first()
    )
  }

  /** Applies one change and answers the account as it now is. */
  async change(user: SignedIn, input: AccountChange) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || !('type' in input)) {
      throw AccountError.invalid('Unknown change.')
    }
    // The person's row is locked for the change: limits, the main account and folder ownership
    // stay consistent when the site and the app write at the same moment.
    await db.transaction(async (trx) => {
      await trx.from('invade_user').where('id', user.id).forUpdate().firstOrFail()
      await this.apply(trx, user, input)
    })
    return this.snapshot(user)
  }

  private async apply(trx: TransactionClientContract, user: SignedIn, input: AccountChange) {
    switch (input.type) {
      case 'rename': {
        const name = cleanName(input.name, ACCOUNT_LIMITS.displayName)
        if (!name) throw AccountError.invalid('Choose a name of 1 to 32 characters.')
        await trx.from('invade_user').where('id', user.id).update({ display_name: name })
        return
      }
      case 'main': {
        if (!isPuuid(input.puuid) || !(await this.owns(trx, user.id, input.puuid))) {
          throw AccountError.invalid('Choose one of your own League accounts.')
        }
        await trx.from('invade_user').where('id', user.id).update({ main_puuid: input.puuid })
        return
      }
      case 'removeAccount': {
        if (!isPuuid(input.puuid)) throw AccountError.invalid('Unknown League account.')
        await trx
          .from('invade_owned_account')
          .where({ puuid: input.puuid, user_id: user.id })
          .update({ removed_at: new Date() })
        await this.settleMain(trx, user.id)
        return
      }
      case 'createFolder':
      case 'renameFolder': {
        const name = cleanName(input.name, ACCOUNT_LIMITS.folderName)
        if (!isUuid(input.id) || !name) {
          throw AccountError.invalid('Choose a folder name of 1 to 40 characters.')
        }
        const duplicate = await trx
          .from('invade_favorite_folder')
          .where('user_id', user.id)
          .whereRaw('lower(name) = lower(?)', [name])
          .whereNot('id', input.id)
          .first()
        if (duplicate) throw AccountError.invalid('You already have a folder with this name.')
        if (input.type === 'renameFolder') {
          const updated = await trx
            .from('invade_favorite_folder')
            .where({ id: input.id, user_id: user.id })
            .update({ name })
          if (!updated) throw AccountError.notFound('This folder no longer exists.')
          return
        }
        const taken = await trx.from('invade_favorite_folder').where('id', input.id).first()
        // The same folder sent twice (a retry) is already done.
        if (taken?.user_id === user.id) return
        if (taken) throw AccountError.invalid('Unknown folder.')
        if ((await this.count(trx, 'invade_favorite_folder', user.id)) >= ACCOUNT_LIMITS.folders) {
          throw AccountError.limit(`You can have up to ${ACCOUNT_LIMITS.folders} folders.`)
        }
        await trx.table('invade_favorite_folder').insert({ id: input.id, user_id: user.id, name })
        return
      }
      case 'deleteFolder': {
        if (!isUuid(input.id)) throw AccountError.invalid('Unknown folder.')
        await trx.from('invade_favorite_folder').where({ id: input.id, user_id: user.id }).delete()
        return
      }
      case 'unlinkDevice': {
        if (!isUuid(input.deviceId)) throw AccountError.invalid('Unknown app.')
        await trx
          .from('invade_device_user')
          .where({ device_id: input.deviceId, user_id: user.id })
          .delete()
        return
      }
      case 'removeFavorite': {
        if (!isPuuid(input.puuid)) throw AccountError.invalid('Unknown player.')
        await trx
          .from('invade_profile_favorite')
          .where({ user_id: user.id, puuid: input.puuid })
          .delete()
        return
      }
      case 'favorite':
      case 'moveFavorite': {
        if (!isPuuid(input.puuid)) throw AccountError.invalid('Unknown player.')
        const folderId = input.folderId ?? null
        if (folderId !== null) {
          const folder = isUuid(folderId)
            ? await trx
                .from('invade_favorite_folder')
                .where({ id: folderId, user_id: user.id })
                .first()
            : null
          if (!folder) throw AccountError.notFound('This folder no longer exists.')
        }
        const existing = await trx
          .from('invade_profile_favorite')
          .where({ user_id: user.id, puuid: input.puuid })
          .first()
        if (input.type === 'moveFavorite') {
          if (!existing) throw AccountError.notFound('This player is not in your favorites.')
          await trx
            .from('invade_profile_favorite')
            .where({ user_id: user.id, puuid: input.puuid })
            .update({ folder_id: folderId })
          return
        }
        if (existing) {
          // Starred again from a folder view: it moves there; from anywhere else it stays put.
          if (input.folderId !== undefined && existing.folder_id !== folderId) {
            await trx
              .from('invade_profile_favorite')
              .where({ user_id: user.id, puuid: input.puuid })
              .update({ folder_id: folderId })
          }
          return
        }
        if (!(await trx.from('riot_player').where('puuid', input.puuid).first())) {
          throw AccountError.notFound('This player is not on Invade yet.')
        }
        const total = await this.count(trx, 'invade_profile_favorite', user.id)
        if (total >= ACCOUNT_LIMITS.favorites) {
          throw AccountError.limit(
            `You can keep up to ${ACCOUNT_LIMITS.favorites} favorite players.`
          )
        }
        await trx
          .table('invade_profile_favorite')
          .insert({ user_id: user.id, puuid: input.puuid, folder_id: folderId })
        return
      }
      default:
        throw AccountError.invalid('Unknown change.')
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

  private async count(trx: TransactionClientContract, table: string, userId: string) {
    const [{ total }] = await trx.from(table).where('user_id', userId).count('* as total')
    return Number(total)
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

  /** A single-use browser link that connects this device to whoever approves it (§10.1). */
  async pair(deviceId: string) {
    const code = randomBytes(24).toString('base64url')
    const expiresAt = new Date(Date.now() + PAIRING_MINUTES * 60_000)
    await db.transaction(async (trx) => {
      await trx.from('invade_pairing').where('device_id', deviceId).delete()
      await trx
        .table('invade_pairing')
        .insert({ code_hash: digest(code), device_id: deviceId, expires_at: expiresAt })
    })
    return {
      url: `${accountOrigin()}/account/link/${code}`,
      check: pairingCheck(code),
      expiresAt: expiresAt.getTime(),
    }
  }

  /** What the link page shows before the person approves: which app, and its check code. */
  async pairing(code: unknown, viewer: SignedIn | null) {
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(code)) return null
    const row = await db
      .from('invade_pairing as p')
      .join('desktop_device as d', 'd.id', 'p.device_id')
      .leftJoin('invade_device_user as u', 'u.device_id', 'p.device_id')
      .where('p.code_hash', digest(code))
      .whereNull('d.revoked_at')
      .select('p.expires_at', 'p.approved_at', 'p.user_id', 'd.os', 'd.app', 'u.user_id as owner')
      .first()
    if (!row) return null
    const linkedHere = Boolean(viewer && row.owner === viewer.id)
    return {
      os: row.os as string,
      app: row.app as string,
      check: pairingCheck(code),
      expired: !row.approved_at && new Date(row.expires_at).getTime() < Date.now(),
      approved: Boolean(row.approved_at) && linkedHere,
      linkedElsewhere: Boolean(row.owner && (!viewer || row.owner !== viewer.id)),
    }
  }

  /** The person approved the link in their browser: the device is now theirs. */
  async approve(user: SignedIn, code: unknown) {
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(code)) {
      throw AccountError.linkExpired()
    }
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
    return this.snapshot(user)
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
      await trx
        .knexQuery()
        .table('invade_owned_account')
        .insert({
          puuid: link.puuid,
          user_id: user.id,
          device_id: deviceId,
          verified_at: new Date(),
          removed_at: null,
        })
        .onConflict('puuid')
        .merge(['user_id', 'device_id', 'verified_at', 'removed_at'])
      added = !current || current.user_id !== user.id || Boolean(current.removed_at)
      if (current && current.user_id !== user.id) {
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
   * The stored player a desktop favorite names, as the app may know it only by the client's raw
   * PUUID or by Riot ID. A player Invade never saw is looked up once (account-v1).
   */
  async resolveProfile(ref: ProfileRef, options: { lookup: boolean }): Promise<string> {
    if (isPuuid(ref.puuid) && (await db.from('riot_player').where('puuid', ref.puuid).first())) {
      return ref.puuid
    }
    if (isUuid(ref.puuid)) {
      const alias = await db
        .from('riot_puuid_alias')
        .where('raw_puuid', ref.puuid.toLowerCase())
        .whereNot('status', 'conflict')
        .first()
      if (alias) return alias.puuid
    }
    const gameName = cleanName(ref.gameName, 32)
    const tagLine = cleanName(ref.tagLine, 8)
    if (!gameName || !tagLine) throw AccountError.notFound('This player is not on Invade yet.')
    let platform: string | undefined
    try {
      platform = ref.platform ? normalizePlatform(ref.platform) : undefined
    } catch {
      platform = undefined
    }
    const stored = await db
      .from('riot_player')
      .whereRaw('game_name = ? AND tag_line = ?', [gameName, tagLine])
      .orderByRaw('platform = ? DESC', [platform ?? ''])
      .first()
    if (stored) return stored.puuid
    if (!options.lookup) throw AccountError.notFound('This player is not on Invade yet.')
    try {
      const player = await summonerService.resolveAndUpsert(`${gameName}-${tagLine}`, platform)
      return player.puuid
    } catch (error) {
      if (riotErrorStatus(error) === 404) {
        throw AccountError.notFound('No League account has this Riot ID.')
      }
      throw error
    }
  }

  /** Deletes the account and everything attached to it. League data and the apps stay. */
  async remove(user: SignedIn) {
    await db.from('invade_user').where('id', user.id).delete()
  }
}

export default new AccountService()
