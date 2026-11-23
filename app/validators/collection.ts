import vine from '@vinejs/vine'
import { MAX_COLLECTION } from '#services/skins/collection_service'

/** `PUT /api/desktop/collection` (docs/desktop-sync.md §13). Dates are checked by the service. */
export const collectionValidator = vine.compile(
  vine.object({
    puuid: vine.string().regex(/^[A-Za-z0-9_-]{20,100}$/),
    skins: vine
      .array(
        vine.object({
          id: vine.number().withoutDecimals().min(1000).max(999_999),
          purchasedAt: vine.string().maxLength(40).nullable(),
        })
      )
      .maxLength(MAX_COLLECTION),
    readAt: vine.string().maxLength(40),
  })
)
