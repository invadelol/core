import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import DesktopDevice from '#models/desktop_device'
import DesktopDeviceAccount from '#models/desktop_device_account'
import Summoner from '#models/summoner'
import summonerService from '#services/summoner_service'
import identityService from '#services/desktop/identity_service'
import { invalidateResponseCache } from '#services/http_response_cache'
import { normalizePlatform } from '#services/riot/routing'
import { generateToken, hashToken } from '#services/desktop/tokens'
import { riotErrorStatus } from '#utils/riot_errors'
import { DesktopException } from '#exceptions/desktop_exception'
import { SITE_ORIGIN } from '#services/sitemap'

/** A device earns the free publication path after this many games Riot confirmed (§4.2). */
export const TRUSTED_AFTER = 5

export function profileUrl(gameName: string, tagLine: string) {
  return `${SITE_ORIGIN}/${encodeURIComponent(`${gameName}-${tagLine}`)}`
}

export function isTrusted(device: Pick<DesktopDevice, 'verifiedUploads' | 'mismatches'>) {
  return device.verifiedUploads >= TRUSTED_AFTER && device.mismatches === 0
}

/**
 * Devices, their tokens, the accounts they upload for, and how far they are
 * trusted (docs/desktop-sync.md §2.2, §2.3, §4.2).
 */
class DeviceService {
  async register(app: string, os: string) {
    const token = generateToken()
    const device = await DesktopDevice.create({
      tokenHash: hashToken(token),
      app,
      os,
      lastSeenAt: DateTime.now(),
      verifiedUploads: 0,
      mismatches: 0,
    })
    // The only time the token exists outside the app.
    return { deviceId: device.id, token }
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

  async verified(deviceId: string) {
    await db.from('desktop_device').where('id', deviceId).increment('verified_uploads', 1)
  }

  /**
   * Riot contradicted this device. It is revoked, and every game only it
   * vouched for loses its credibility: marked `conflict`, its LP hidden.
   * The rows stay in ClickHouse until the game is re-ingested from Riot.
   */
  async mismatch(deviceId: string, matchId: string, differences: string[]) {
    logger.warn({ deviceId, matchId, differences }, 'desktop upload contradicted by Riot')
    await db.from('desktop_device').where('id', deviceId).increment('mismatches', 1)
    await this.revoke(deviceId, 'mismatch')

    const matches: string[] = await db
      .from('match_source')
      .where('first_device_id', deviceId)
      .where('verification', 'unverified')
      .update({ verification: 'conflict' })
      .returning('match_id')
      .then((rows: Array<{ match_id: string }>) => rows.map((row) => row.match_id))

    const hidden: Array<{ match_id: string; puuid: string }> = matches.length
      ? await db
          .from('lp_change')
          .whereIn('match_id', matches)
          .where('status', 'accepted')
          .update({ status: 'conflict' })
          .returning(['match_id', 'puuid'])
      : []

    await invalidateResponseCache([
      ...matches.map((id) => `match:${id}`),
      ...hidden.map((row) => `summoner:${row.puuid}`),
    ]).catch((error) => logger.warn({ err: error, deviceId }, 'cache invalidation failed'))
  }
}

export default new DeviceService()
