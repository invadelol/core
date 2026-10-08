import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { ObservedMastery } from '#types/desktop'

/**
 * The newest top-10 champion mastery of a player, from Riot or from the
 * desktop app (docs/desktop-sync.md §6.4). Newest wins.
 */
export default class PlayerMastery extends BaseModel {
  public static table = 'player_mastery'
  public static primaryKey = 'puuid'
  public static selfAssignPrimaryKey = true

  @column({ isPrimary: true })
  declare puuid: string

  @column()
  declare entries: ObservedMastery[]

  @column.dateTime({ columnName: 'observed_at' })
  declare observedAt: DateTime

  @column()
  declare source: 'riot' | 'desktop'

  @column({ columnName: 'device_id', serializeAs: null })
  declare deviceId: string | null
}
