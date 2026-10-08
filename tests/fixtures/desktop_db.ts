import db from '@adonisjs/lucid/services/db'
import DesktopDevice from '#models/desktop_device'
import deviceService from '#services/desktop/device_service'
import type { MatchUpload } from '#types/desktop'

/**
 * Rows the desktop tests create in the (isolated) Postgres database, tracked
 * so every test removes exactly what it added.
 */
export class DesktopSeed {
  devices: string[] = []
  puuids: string[] = []
  raws: string[] = []
  matchIds: string[] = []

  /** `riot_player` rows for the given participants (raw PUUID → API PUUID). */
  async players(upload: MatchUpload, puuids: ReadonlyMap<string, string>, only?: number[]) {
    const rows = upload.game.participantIdentities
      .filter((identity) => !only || only.includes(identity.participantId))
      .map((identity) => ({
        puuid: puuids.get(identity.player.puuid.toLowerCase())!,
        platform: upload.game.platformId,
        game_name: identity.player.gameName,
        tag_line: identity.player.tagLine,
        profile_icon_id: identity.player.profileIcon ?? null,
        summoner_level: 100,
        last_refresh_at: new Date(),
      }))
    this.puuids.push(...rows.map((row) => row.puuid))
    if (rows.length) await db.table('riot_player').insert(rows)
    this.raws.push(...upload.game.participantIdentities.map((i) => i.player.puuid.toLowerCase()))
    this.matchIds.push(upload.matchId)
  }

  /** Verified aliases for every participant: what a device needs for the free path. */
  async aliases(upload: MatchUpload, puuids: ReadonlyMap<string, string>) {
    await db.table('riot_puuid_alias').insert(
      upload.game.participantIdentities.map((identity) => ({
        raw_puuid: identity.player.puuid.toLowerCase(),
        puuid: puuids.get(identity.player.puuid.toLowerCase())!,
        game_name: identity.player.gameName,
        tag_line: identity.player.tagLine,
        status: 'verified',
      }))
    )
  }

  async device(counters: { verifiedUploads?: number; mismatches?: number } = {}) {
    const { deviceId, token } = await deviceService.register('0.2.7', 'macos')
    this.devices.push(deviceId)
    await db
      .from('desktop_device')
      .where('id', deviceId)
      .update({
        verified_uploads: counters.verifiedUploads ?? 0,
        mismatches: counters.mismatches ?? 0,
      })
    return { device: (await DesktopDevice.findOrFail(deviceId))!, token }
  }

  async link(deviceId: string, puuid: string, rawPuuid: string | null, platform = 'EUW1') {
    await db.table('desktop_device_account').insert({
      device_id: deviceId,
      puuid,
      platform,
      raw_puuid: rawPuuid?.toLowerCase() ?? null,
      source: rawPuuid ? 'lcu' : 'riot_id',
    })
  }

  async cleanup() {
    if (this.matchIds.length) {
      await db.from('lp_change').whereIn('match_id', this.matchIds).delete()
      await db.from('match_source').whereIn('match_id', this.matchIds).delete()
    }
    if (this.devices.length) await db.from('desktop_device').whereIn('id', this.devices).delete()
    if (this.raws.length) await db.from('riot_puuid_alias').whereIn('raw_puuid', this.raws).delete()
    if (this.puuids.length) {
      await db.from('riot_puuid_alias').whereIn('puuid', this.puuids).delete()
      await db.from('riot_player').whereIn('puuid', this.puuids).delete()
    }
  }
}
