import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/** An installed desktop app that may upload games (docs/desktop-sync.md §2.2). */
export default class DesktopDevice extends BaseModel {
  public static table = 'desktop_device'

  @column({ isPrimary: true })
  declare id: string

  /** SHA-256 of the bearer token; the token itself is never stored. */
  @column({ columnName: 'token_hash', serializeAs: null })
  declare tokenHash: string

  @column()
  declare app: string

  @column()
  declare os: string

  @column.dateTime({ columnName: 'created_at', autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ columnName: 'last_seen_at' })
  declare lastSeenAt: DateTime | null

  @column.dateTime({ columnName: 'revoked_at' })
  declare revokedAt: DateTime | null

  @column({ columnName: 'revoked_reason' })
  declare revokedReason: string | null

  @column({ columnName: 'verified_uploads' })
  declare verifiedUploads: number

  @column()
  declare mismatches: number

  /** The signing secret (§1.1), encrypted with the app key; null for devices from before signing. */
  @column({ columnName: 'secret_encrypted', serializeAs: null })
  declare secretEncrypted: string | null

  /** Distinct UTC days on which Riot confirmed one of this device's games. */
  @column({ columnName: 'verified_days' })
  declare verifiedDays: number

  @column.date({ columnName: 'last_verified_on' })
  declare lastVerifiedOn: DateTime | null
}
