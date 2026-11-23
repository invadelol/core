import vine from '@vinejs/vine'
import { SKIN_LIMITS } from '../../inertia/lib/skin_types.js'

/** A skin id in an address (`/skins/103086`): a champion's skin, never a base or a tier. */
export const skinIdValidator = vine.compile(
  vine.object({ id: vine.number().withoutDecimals().min(1000).max(999_999) })
)

/** Half stars, 1 to 10; null takes the rating back. */
export const ratingValidator = vine.compile(
  vine.object({ rating: vine.number().withoutDecimals().min(1).max(10).nullable() })
)

/** A like, a wish, a list's skin: on or off. */
export const toggleValidator = vine.compile(vine.object({ on: vine.boolean() }))

/** A review's text; empty takes it back. Its length is checked with the text cleaned. */
export const reviewValidator = vine.compile(
  vine.object({ body: vine.string().maxLength(SKIN_LIMITS.review * 2) })
)

export const listValidator = vine.compile(
  vine.object({
    title: vine.string().maxLength(SKIN_LIMITS.listTitle * 2),
    body: vine
      .string()
      .maxLength(SKIN_LIMITS.listBody * 2)
      .optional(),
  })
)

export const skinSearchValidator = vine.compile(
  vine.object({ q: vine.string().trim().minLength(1).maxLength(60) })
)
