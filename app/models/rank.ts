import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Rank extends BaseModel {
  public static table = 'riot_rank'
  public static primaryKey = 'puuid'
  public static selfAssignPrimaryKey = true

  @column({ columnName: 'puuid', isPrimary: true })
  declare puuid: string

  @column({ columnName: 'queue_type' })
  declare queueType: string

  @column()
  declare tier: string | null

  @column({ columnName: 'division' })
  declare division: string | null

  @column({ columnName: 'league_points' })
  declare leaguePoints: number | null

  @column()
  declare wins: number | null

  @column()
  declare losses: number | null

  @column.dateTime({ columnName: 'fetched_at' })
  declare fetchedAt: DateTime

  /** `riot` from league-v4, `desktop` from the app (post-game LP snapshot or player snapshot). */
  @column()
  declare source: 'riot' | 'desktop'

  /** The device that reported a desktop row, kept for rollback (§1.2); never served. */
  @column({ columnName: 'device_id', serializeAs: null })
  declare deviceId: string | null
}
