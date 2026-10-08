import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/**
 * When the newest rank of a queue was last seen unchanged, by Riot or by the
 * desktop app (docs/desktop-sync.md §6.4). Without a `riot_rank` row for the
 * queue, it says the player was seen unranked there.
 */
export default class RankConfirmation extends BaseModel {
  public static table = 'riot_rank_confirmed'
  public static primaryKey = 'puuid'
  public static selfAssignPrimaryKey = true

  @column({ isPrimary: true })
  declare puuid: string

  @column({ columnName: 'queue_type' })
  declare queueType: string

  @column.dateTime({ columnName: 'confirmed_at' })
  declare confirmedAt: DateTime

  @column({ columnName: 'device_id', serializeAs: null })
  declare deviceId: string | null
}
