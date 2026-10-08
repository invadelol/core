import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type MatchOrigin = 'riot' | 'desktop'
export type Verification = 'verified' | 'unverified' | 'corroborated' | 'conflict'

/**
 * What the stored rows of a match are missing. Desktop games lack what the
 * League client never reports; readers hide those stats instead of showing 0.
 */
export interface Completeness {
  pings: boolean
  summonerLevel: boolean
  statPerks: boolean
  timeline: boolean
  position: 'riot' | 'inferred' | 'absent'
}

/** Provenance of a match in ClickHouse, and its single-writer lock (§4.2). */
export default class MatchSource extends BaseModel {
  public static table = 'match_source'
  public static primaryKey = 'matchId'
  public static selfAssignPrimaryKey = true

  @column({ columnName: 'match_id', isPrimary: true })
  declare matchId: string

  @column()
  declare source: MatchOrigin

  @column()
  declare verification: Verification

  @column()
  declare completeness: Completeness | null

  @column({ columnName: 'first_device_id' })
  declare firstDeviceId: string | null

  @column.dateTime({ columnName: 'created_at', autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ columnName: 'verified_at' })
  declare verifiedAt: DateTime | null
}
