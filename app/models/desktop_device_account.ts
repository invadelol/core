import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/** An account a device uploads for (§2.3). */
export default class DesktopDeviceAccount extends BaseModel {
  public static table = 'desktop_device_account'

  @column({ columnName: 'device_id', isPrimary: true })
  declare deviceId: string

  @column({ isPrimary: true })
  declare puuid: string

  @column()
  declare platform: string

  @column({ columnName: 'raw_puuid' })
  declare rawPuuid: string | null

  @column()
  declare source: 'lcu' | 'riot_id'

  @column.dateTime({ columnName: 'created_at', autoCreate: true })
  declare createdAt: DateTime
}
