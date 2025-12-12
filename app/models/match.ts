import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Match extends BaseModel {

  public static table = 'riot_match'
  public static primaryKey = 'matchId'
  public static selfAssignPrimaryKey = true

  @column({ columnName: 'match_id', isPrimary: true })
  declare matchId: string

  @column({ columnName: 'routing_region' })
  declare routingRegion: string

  @column()
  declare platform: string

  @column({ columnName: 's3_key' })
  declare s3Key: string

  @column.dateTime({ columnName: 'fetched_at' })
  declare fetchedAt: DateTime | null
}