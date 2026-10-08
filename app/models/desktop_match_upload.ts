import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/**
 * `processing` while a request owns the row, then what the desktop was told
 * (`stored`, `verified`, `deferred`, `duplicate`), or `expired` once core
 * gave up retrying a deferred game and left it to the web sync.
 */
export type UploadStatus =
  | 'processing'
  | 'stored'
  | 'verified'
  | 'deferred'
  | 'duplicate'
  | 'expired'

export type LpStatus = 'stored' | 'rejected' | 'none'

/** One game received from one device (§4.2). */
export default class DesktopMatchUpload extends BaseModel {
  public static table = 'desktop_match_upload'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'match_id' })
  declare matchId: string

  @column({ columnName: 'device_id' })
  declare deviceId: string

  @column({ columnName: 'uploader_puuid' })
  declare uploaderPuuid: string

  @column({ columnName: 'uploader_raw_puuid' })
  declare uploaderRawPuuid: string

  @column({ columnName: 'payload_hash' })
  declare payloadHash: string

  @column()
  declare status: UploadStatus

  @column({ columnName: 'lp_status' })
  declare lpStatus: LpStatus

  @column({ columnName: 'ip_hash', serializeAs: null })
  declare ipHash: string | null

  @column()
  declare app: string | null

  @column.dateTime({ columnName: 'received_at', autoCreate: true })
  declare receivedAt: DateTime

  @column.dateTime({ columnName: 'processed_at' })
  declare processedAt: DateTime | null
}
