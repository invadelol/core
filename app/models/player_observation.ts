import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { ObservedMastery, ObservedRank } from '#types/desktop'

export type ObservationStatus = 'staged' | 'applied' | 'unchanged' | 'stale' | 'held' | 'conflict'

/**
 * The latest report of a player from the desktop app, per raw (client)
 * PUUID (docs/desktop-sync.md §6.3). An older report never replaces it.
 */
export default class PlayerObservation extends BaseModel {
  public static table = 'player_observation'
  public static primaryKey = 'rawPuuid'
  public static selfAssignPrimaryKey = true

  @column({ columnName: 'raw_puuid', isPrimary: true })
  declare rawPuuid: string

  @column({ columnName: 'game_name' })
  declare gameName: string

  @column({ columnName: 'tag_line' })
  declare tagLine: string

  @column()
  declare platform: string

  @column({ columnName: 'profile_icon_id' })
  declare profileIconId: number | null

  @column({ columnName: 'summoner_level' })
  declare summonerLevel: number | null

  @column()
  declare privacy: 'PUBLIC' | 'PRIVATE' | null

  @column()
  declare self: boolean

  @column()
  declare context: string | null

  @column()
  declare ranks: ObservedRank[] | null

  @column()
  declare mastery: ObservedMastery[] | null

  @column.dateTime({ columnName: 'observed_at' })
  declare observedAt: DateTime

  @column.dateTime({ columnName: 'received_at' })
  declare receivedAt: DateTime

  @column({ columnName: 'device_id' })
  declare deviceId: string | null

  @column({ columnName: 'ip_hash', serializeAs: null })
  declare ipHash: string | null

  @column({ columnName: 'payload_hash' })
  declare payloadHash: string

  @column()
  declare puuid: string | null

  @column.dateTime({ columnName: 'applied_at' })
  declare appliedAt: DateTime | null

  @column()
  declare status: ObservationStatus
}
