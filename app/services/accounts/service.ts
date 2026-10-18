import { createHash, randomBytes } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import { Exception } from '@adonisjs/core/exceptions'
import type { InvadeAccountData } from '../../../inertia/lib/account_types.js'

export type AccountUser = { id: string; name: string; provider: string }
export const digest = (token: string) => createHash('sha256').update(token).digest('hex')
export const fail = (message: string, status = 422) => new Exception(message, { status })
const uuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[a-f\d]{8}-([a-f\d]{4}-){3}[a-f\d]{12}$/i.test(s)
const text = (s: unknown, max: number): s is string =>
  typeof s === 'string' && !!s.trim() && s.trim().length <= max
export type AccountChange = {
  type: string
  id?: string
  name?: string
  puuid?: string
  folderId?: string | null
  deviceId?: string
}

export async function authenticate(token: string | undefined): Promise<AccountUser | null> {
  if (!token || token.length > 128) return null
  const row = await db
    .from('invade_session as s')
    .join('invade_user as u', 'u.id', 's.user_id')
    .where('s.token_hash', digest(token))
    .where('s.expires_at', '>', new Date())
    .select('u.id', 'u.display_name', 'u.provider')
    .first()
  return row ? { id: row.id, name: row.display_name, provider: row.provider } : null
}
export async function session(userId: string) {
  const token = randomBytes(32).toString('base64url')
  await db
    .table('invade_session')
    .insert({
      token_hash: digest(token),
      user_id: userId,
      expires_at: new Date(Date.now() + 30 * 864e5),
    })
  return token
}
export async function deviceUser(deviceId: string): Promise<AccountUser | null> {
  const row = await db
    .from('invade_device_user as d')
    .join('invade_user as u', 'u.id', 'd.user_id')
    .where('d.device_id', deviceId)
    .select('u.id', 'u.display_name', 'u.provider')
    .first()
  return row ? { id: row.id, name: row.display_name, provider: row.provider } : null
}
export async function snapshot(user: AccountUser): Promise<InvadeAccountData> {
  const [row, owned, folders, favorites, devices] = await Promise.all([
    db.from('invade_user').where('id', user.id).first(),
    db.rawQuery(
      `SELECT p.*, o.verified_at, r.tier, r.division, r.league_points FROM invade_owned_account o JOIN riot_player p USING (puuid) LEFT JOIN LATERAL (SELECT tier, division, league_points FROM riot_rank WHERE puuid=p.puuid AND queue_type='RANKED_SOLO_5x5' ORDER BY fetched_at DESC LIMIT 1) r ON true WHERE o.user_id=? ORDER BY o.verified_at`,
      [user.id]
    ),
    db
      .from('invade_favorite_folder')
      .where('user_id', user.id)
      .orderBy('created_at')
      .select('id', 'name'),
    db
      .from('invade_profile_favorite as f')
      .join('riot_player as p', 'p.puuid', 'f.puuid')
      .where('f.user_id', user.id)
      .orderBy('f.created_at')
      .select('p.*', 'f.folder_id'),
    db
      .from('invade_device_user as u')
      .join('desktop_device as d', 'd.id', 'u.device_id')
      .where('u.user_id', user.id)
      .whereNull('d.revoked_at')
      .select('d.id', 'd.os', 'd.app', 'd.last_seen_at'),
  ])
  const profile = (p: any) => ({
    puuid: p.puuid,
    gameName: p.game_name,
    tagLine: p.tag_line,
    platform: p.platform,
    profileIconId: p.profile_icon_id,
    tier: p.tier,
    division: p.division,
    lp: p.league_points,
    ...(p.verified_at ? { verifiedAt: new Date(p.verified_at).toISOString() } : {}),
  })
  return {
    user,
    mainPuuid: row.main_puuid,
    accounts: owned.rows.map(profile),
    folders,
    favorites: favorites.map((p) => ({ ...profile(p), folderId: p.folder_id })),
    devices: devices.map((d) => ({
      id: d.id,
      os: d.os,
      app: d.app,
      lastSeenAt: d.last_seen_at ? new Date(d.last_seen_at).toISOString() : null,
    })),
  }
}
export async function change(user: AccountUser, input: AccountChange) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw fail('Invalid account change.')
  // A per-user transaction lock keeps limits, main selection and folder ownership atomic.
  await db.transaction(async (trx) => {
    await trx.from('invade_user').where('id', user.id).forUpdate().firstOrFail()
    if (input.type === 'main') {
      if (
        !text(input.puuid, 128) ||
        !(await trx
          .from('invade_owned_account')
          .where({ user_id: user.id, puuid: input.puuid })
          .first())
      )
        throw fail('Choose one of your verified League accounts.')
      await trx.from('invade_user').where('id', user.id).update({ main_puuid: input.puuid })
      return
    }
    if (input.type === 'createFolder' || input.type === 'renameFolder') {
      if (!uuid(input.id) || !text(input.name, 40))
        throw fail('Enter a folder name of 1–40 characters.')
      const duplicate = await trx
        .from('invade_favorite_folder')
        .where('user_id', user.id)
        .whereRaw('lower(name) = lower(?)', [input.name.trim()])
        .whereNot('id', input.id)
        .first()
      if (duplicate) throw fail('A folder with that name already exists.')
      if (input.type === 'renameFolder') {
        const updated = await trx
          .from('invade_favorite_folder')
          .where({ id: input.id, user_id: user.id })
          .update({ name: input.name.trim() })
        if (!updated) throw fail('Folder not found.', 404)
      } else {
        const [{ total }] = await trx
          .from('invade_favorite_folder')
          .where('user_id', user.id)
          .count('* as total')
        if (Number(total) >= 30) throw fail('You can create up to 30 folders.')
        await trx
          .table('invade_favorite_folder')
          .insert({ id: input.id, user_id: user.id, name: input.name.trim() })
      }
      return
    }
    if (input.type === 'deleteFolder') {
      if (!uuid(input.id)) throw fail('Invalid folder.')
      await trx.from('invade_favorite_folder').where({ id: input.id, user_id: user.id }).delete()
      return
    }
    if (input.type === 'unlinkDevice') {
      if (!uuid(input.deviceId)) throw fail('Invalid app.')
      await trx
        .from('invade_device_user')
        .where({ device_id: input.deviceId, user_id: user.id })
        .delete()
      return
    }
    if (!text(input.puuid, 128)) throw fail('Invalid profile.')
    if (input.type === 'removeFavorite') {
      await trx
        .from('invade_profile_favorite')
        .where({ user_id: user.id, puuid: input.puuid })
        .delete()
      return
    }
    if (input.type !== 'favorite' && input.type !== 'moveFavorite')
      throw fail('Unknown account change.')
    if (
      input.folderId !== null &&
      (!uuid(input.folderId) ||
        !(await trx
          .from('invade_favorite_folder')
          .where({ id: input.folderId, user_id: user.id })
          .first()))
    )
      throw fail('Folder not found.', 404)
    if (!(await trx.from('riot_player').where('puuid', input.puuid).first()))
      throw fail('Profile not found.', 404)
    const existing = await trx
      .from('invade_profile_favorite')
      .where({ user_id: user.id, puuid: input.puuid })
      .first()
    if (input.type === 'moveFavorite' && !existing) throw fail('Favorite not found.', 404)
    if (!existing) {
      const [{ total }] = await trx
        .from('invade_profile_favorite')
        .where('user_id', user.id)
        .count('* as total')
      if (Number(total) >= 300) throw fail('You can save up to 300 profiles.')
    }
    await trx
      .knexQuery()
      .table('invade_profile_favorite')
      .insert({ user_id: user.id, puuid: input.puuid, folder_id: input.folderId })
      .onConflict(['user_id', 'puuid'])
      .merge(['folder_id'])
  })
  return snapshot(user)
}
/** A Riot ID claim is never ownership. Only the signed desktop path can call this. */
export async function verifyDetected(deviceId: string, rawPuuid: unknown) {
  if (!uuid(rawPuuid)) throw fail('Open League and sign in to the account you want to verify.')
  const user = await deviceUser(deviceId)
  if (!user) throw fail('Connect your Invade account first.', 401)
  const link = await db
    .from('desktop_device_account')
    .where({ device_id: deviceId, raw_puuid: rawPuuid.toLowerCase(), source: 'lcu' })
    .first()
  if (!link) throw fail('This account has not been detected in the League client.', 403)
  await db.transaction(async (trx) => {
    await trx.from('invade_user').where('id', user.id).forUpdate().firstOrFail()
    await trx
      .knexQuery()
      .table('invade_owned_account')
      .insert({ user_id: user.id, puuid: link.puuid, device_id: deviceId })
      .onConflict(['user_id', 'puuid'])
      .ignore()
    await trx
      .from('invade_user')
      .where('id', user.id)
      .whereNull('main_puuid')
      .update({ main_puuid: link.puuid })
  })
  return snapshot(user)
}
