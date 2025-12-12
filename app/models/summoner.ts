import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Summoner extends BaseModel {
  public static table = 'riot_player'
  public static primaryKey = 'puuid'
  public static selfAssignPrimaryKey = true

  @column({ isPrimary: true })
  declare puuid: string

  @column()
  declare platform: string

  @column({ columnName: 'game_name' })
  declare gameName: string

  @column({ columnName: 'tag_line' })
  declare tagLine: string

  @column({ columnName: 'profile_icon_id' })
  declare profileIconId: number | null

  @column({ columnName: 'summoner_level' })
  declare summonerLevel: number | null

  @column.dateTime({ columnName: 'last_refresh_at' })
  declare lastRefreshAt: DateTime | null

  @column({
    columnName: 'view_count',
    consume: (value) => (value === null || value === undefined ? 0n : BigInt(value)),
    prepare: (value: bigint) => value.toString(),
  })
  declare viewCount: bigint

  @column.dateTime({ columnName: 'created_at' })
  declare createdAt: DateTime
}