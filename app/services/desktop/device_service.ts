import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import encryption from '@adonisjs/core/services/encryption'
import DesktopDevice from '#models/desktop_device'
import DesktopDeviceAccount from '#models/desktop_device_account'
import Summoner from '#models/summoner'
import summonerService from '#services/summoner_service'
import identityService from '#services/desktop/identity_service'
import { invalidateResponseCache } from '#services/http_response_cache'
import { normalizePlatform } from '#services/riot/routing'
import { generateToken, hashToken } from '#services/desktop/tokens'
import { generateSecret, isSecret } from '#services/desktop/signing'
import { riotErrorStatus } from '#utils/riot_errors'
import { DesktopException } from '#exceptions/desktop_exception'
import { SITE_ORIGIN } from '#services/sitemap'

/**
 * Trust is slow to earn (docs/desktop-sync.md §1.2): this many games Riot
 * confirmed, on this many different days, from a device at least this old,
 * and never a single game Riot contradicted.
 */
export const TRUST = { verifiedUploads: 5, verifiedDays: 3, minAgeDays: 3 } as const

export function profileUrl(gameName: string, tagLine: string) {
  return `${SITE_ORIGIN}/${encodeURIComponent(`${gameName}-${tagLine}`)}`
}

export function isTrusted(
  device: Pick<
    DesktopDevice,
    'verifiedUploads' | 'mismatches' | 'verifiedDays' | 'createdAt' | 'revokedAt'
  >,
  now: DateTime = DateTime.now()
) {
  return (
    !device.revokedAt &&
    device.mismatches === 0 &&
    device.verifiedUploads >= TRUST.verifiedUploads &&
    (device.verifiedDays ?? 0) >= TRUST.verifiedDays &&
    Boolean(device.createdAt) &&
    device.createdAt <= now.minus({ days: TRUST.minAgeDays })
  )
}

/** The matches and players a rolled-back device's data touched; their caches are dropped. */
export interface Rollback {
  matches: string[]
  players: string[]
}

/**
 * Devices, their tokens, the accounts they upload for, and how far they are
 * trusted (docs/desktop-sync.md §2.2, §2.3, §4.2).
 */
class DeviceService {
  async register(app: string, os: string) {
    const token = generateToken()
    const secret = generateSecret()
    const device = await DesktopDevice.create({
      tokenHash: hashToken(token),
      secretEncrypted: encryption.encrypt(secret),
      app,
      os,
      lastSeenAt: DateTime.now(),
      verifiedUploads: 0,
      verifiedDays: 0,
      mismatches: 0,
    })
    // The only time the token and the secret exist outside the app.
    return { deviceId: device.id, token, secret }
  }

  /**
   * The device's signing secret, decrypted with the app key. Null for a
   * device registered before signing existed, or one whose secret no longer
   * decrypts (a rotated app key): both must register again.
   */
  secretOf(device: Pick<DesktopDevice, 'secretEncrypted'>): string | null {
    if (!device.secretEncrypted) return null
    const secret = encryption.decrypt<string>(device.secretEncrypted)
    return isSecret(secret) ? secret : null
  }

  /** The unrevoked device a bearer token belongs to. */
  async authenticate(token: string): Promise<DesktopDevice | null> {
    return DesktopDevice.query()
      .where('token_hash', hashToken(token))
      .whereNull('revoked_at')
      .first()
  }

  /**
   * `last_seen_at` is for spotting abandoned devices, not an audit log: one
   * write a minute per device is plenty, and the condition makes the other
   * requests of that minute a no-op on the database side too.
   */
  async touch(device: DesktopDevice) {
    if (device.lastSeenAt && device.lastSeenAt > DateTime.now().minus({ minutes: 1 })) return
    await db
      .from('desktop_device')
      .where('id', device.id)
      .where((query) =>
        query.whereNull('last_seen_at').orWhereRaw(`last_seen_at < now() - interval '1 minute'`)
      )
      .update({ last_seen_at: new Date() })
  }

  async revoke(deviceId: string, reason: string) {
    await db
      .from('desktop_device')
      .where('id', deviceId)
      .whereNull('revoked_at')
      .update({ revoked_at: new Date(), revoked_reason: reason })
  }

  /** Makes an account one of the device's uploaders (§2.3). */
  async link(
    device: DesktopDevice,
    input: {
      gameName: string
      tagLine: string
      platform: string
      rawPuuid?: string | null
      source: 'lcu' | 'riot_id'
    }
  ) {
    const platform = normalizePlatform(input.platform)
    let player: Summoner
    try {
      // The stored row first; account-v1 and platform discovery only for a stranger.
      player = await summonerService.resolveAndUpsert(
        `${input.gameName}-${input.tagLine}`,
        platform
      )
    } catch (error) {
      if (riotErrorStatus(error) === 404) throw DesktopException.notFound()
      throw error
    }

    if (input.rawPuuid) {
      await identityService.assertFromLink(
        input.rawPuuid,
        player.puuid,
        player.gameName,
        player.tagLine
      )
    }

    await db
      .knexQuery()
      .table('desktop_device_account')
      .insert({
        device_id: device.id,
        puuid: player.puuid,
        platform: player.platform,
        raw_puuid: input.rawPuuid?.toLowerCase() ?? null,
        source: input.source,
        created_at: new Date(),
      })
      .onConflict(['device_id', 'puuid'])
      .merge(
        input.rawPuuid
          ? ['platform', 'raw_puuid', 'source']
          : // A Riot ID link must not forget the raw PUUID an earlier client link proved.
            ['platform', 'source']
      )

    return { puuid: player.puuid, profileUrl: profileUrl(player.gameName, player.tagLine) }
  }

  async unlink(deviceId: string, puuid: string) {
    await DesktopDeviceAccount.query().where('device_id', deviceId).where('puuid', puuid).delete()
  }

  /**
   * The link that lets this device upload for the uploader: by the raw PUUID
   * the client proved at link time, else by the account the uploader maps to.
   */
  async uploaderLink(deviceId: string, rawPuuid: string, mappedPuuid?: string | null) {
    const query = DesktopDeviceAccount.query()
      .where('device_id', deviceId)
      .where((where) => {
        where.where('raw_puuid', rawPuuid.toLowerCase())
        if (mappedPuuid) where.orWhere('puuid', mappedPuuid)
      })
    return query.first()
  }

  /** When the newest game of this player arrived from the app; the web shows it as freshness. */
  async lastSyncAt(puuid: string): Promise<DateTime | null> {
    const row = await db
      .from('desktop_match_upload')
      .where('uploader_puuid', puuid)
      .whereIn('status', ['stored', 'verified', 'duplicate', 'deferred'])
      .max('received_at as at')
      .first()
    return row?.at ? DateTime.fromJSDate(new Date(row.at)) : null
  }

  /**
   * Riot confirmed one of the device's games. The day count moves when the
   * (UTC) day differs from the last confirmation's: confirmations arrive in
   * time order, so that counts distinct days without keeping each one.
   */
  async verified(deviceId: string) {
    await db.rawQuery(
      `UPDATE desktop_device
       SET verified_uploads = verified_uploads + 1,
           verified_days = verified_days
             + CASE WHEN last_verified_on IS DISTINCT FROM (now() AT TIME ZONE 'UTC')::date
                    THEN 1 ELSE 0 END,
           last_verified_on = (now() AT TIME ZONE 'UTC')::date
       WHERE id = ?`,
      [deviceId]
    )
  }

  /**
   * Riot contradicted this device (a game, or a sampled player snapshot).
   * A lie costs it everything (§1.2): it is revoked, every game only it
   * vouched for is marked `conflict` with its LP hidden, its player reports
   * are marked `conflict`, and the ranks, confirmations and mastery it wrote
   * are deleted, so the profiles fall back to Riot's own data (and the next
   * read past the freshness windows asks Riot again). Games stay in
   * ClickHouse until they are re-ingested from Riot.
   */
  async mismatch(deviceId: string, reference: string, differences: string[]): Promise<Rollback> {
    logger.warn({ deviceId, reference, differences }, 'desktop data contradicted by Riot')
    await db.from('desktop_device').where('id', deviceId).increment('mismatches', 1)
    await this.revoke(deviceId, 'mismatch')
    const rollback = await this.rollback(deviceId)

    await invalidateResponseCache([
      ...rollback.matches.map((id) => `match:${id}`),
      ...rollback.players.map((puuid) => `summoner:${puuid}`),
    ]).catch((error) => logger.warn({ err: error, deviceId }, 'cache invalidation failed'))
    return rollback
  }

  /** Undoes what a device wrote; returns the matches and players it touched. */
  async rollback(deviceId: string): Promise<Rollback> {
    const players = new Set<string>()
    const puuidsOf = (rows: Array<{ puuid: string | null }>) => {
      for (const row of rows) if (row.puuid) players.add(row.puuid)
    }

    const matches: string[] = await db
      .from('match_source')
      .where('first_device_id', deviceId)
      .where('verification', 'unverified')
      .update({ verification: 'conflict' })
      .returning('match_id')
      .then((rows: Array<{ match_id: string }>) => rows.map((row) => row.match_id))

    if (matches.length) {
      puuidsOf(
        await db
          .from('lp_change')
          .whereIn('match_id', matches)
          .where('status', 'accepted')
          .update({ status: 'conflict' })
          .returning(['puuid'])
      )
    }

    puuidsOf(
      await db
        .from('player_observation')
        .where('device_id', deviceId)
        .whereNot('status', 'conflict')
        .update({ status: 'conflict' })
        .returning(['puuid'])
    )
    for (const table of ['riot_rank', 'riot_rank_confirmed', 'player_mastery']) {
      puuidsOf(await db.from(table).where('device_id', deviceId).delete().returning(['puuid']))
    }

    return { matches, players: [...players] }
  }
}

export default new DeviceService()
