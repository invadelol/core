import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class SummonerHistory extends BaseModel {
  public static table = 'riot_player_history'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare puuid: string

  @column({ columnName: 'game_name' })
  declare gameName: string

  @column({ columnName: 'tag_line' })
  declare tagLine: string

  @column({ columnName: 'profile_icon_id' })
  declare profileIconId: number | null

  @column.dateTime({ columnName: 'observed_at' })
  declare observedAt: DateTime
}