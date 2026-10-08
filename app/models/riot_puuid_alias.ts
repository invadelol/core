import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type AliasStatus = 'verified' | 'asserted' | 'conflict'

/** The League client's raw PUUID mapped to this API key's PUUID (§3). */
export default class RiotPuuidAlias extends BaseModel {
  public static table = 'riot_puuid_alias'
  public static primaryKey = 'rawPuuid'
  public static selfAssignPrimaryKey = true

  @column({ columnName: 'raw_puuid', isPrimary: true })
  declare rawPuuid: string

  @column()
  declare puuid: string

  @column({ columnName: 'game_name' })
  declare gameName: string | null

  @column({ columnName: 'tag_line' })
  declare tagLine: string | null

  @column()
  declare status: AliasStatus

  @column.dateTime({ columnName: 'observed_at' })
  declare observedAt: DateTime
}
