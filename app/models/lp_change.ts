import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/** An accepted LP change for the uploader of a game (§4.4). */
export default class LpChange extends BaseModel {
  public static table = 'lp_change'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'match_id' })
  declare matchId: string

  @column()
  declare puuid: string

  @column()
  declare queue: string

  @column({ columnName: 'before_tier' })
  declare beforeTier: string

  @column({ columnName: 'before_division' })
  declare beforeDivision: string | null

  @column({ columnName: 'before_lp' })
  declare beforeLp: number

  @column({ columnName: 'before_wins' })
  declare beforeWins: number

  @column({ columnName: 'before_losses' })
  declare beforeLosses: number

  @column.dateTime({ columnName: 'before_at' })
  declare beforeAt: DateTime

  @column({ columnName: 'after_tier' })
  declare afterTier: string

  @column({ columnName: 'after_division' })
  declare afterDivision: string | null

  @column({ columnName: 'after_lp' })
  declare afterLp: number

  @column({ columnName: 'after_wins' })
  declare afterWins: number

  @column({ columnName: 'after_losses' })
  declare afterLosses: number

  @column.dateTime({ columnName: 'after_at' })
  declare afterAt: DateTime

  @column()
  declare delta: number

  @column()
  declare source: string

  @column({ columnName: 'device_id' })
  declare deviceId: string | null

  /** `conflict` once the device behind it was caught misreporting a game. */
  @column()
  declare status: 'accepted' | 'conflict'

  @column.dateTime({ columnName: 'created_at', autoCreate: true })
  declare createdAt: DateTime
}
