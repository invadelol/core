import vine from '@vinejs/vine'

/**
 * Validates Match ID route parameter.
 *
 * Riot match ids look like: "EUW1_1234567890"
 * (region/platform prefix, underscore, numeric id)
 */
export const matchIdParamsValidator = vine.compile(
  vine.object({
    id: vine
      .string()
      .trim()
      .regex(/^[A-Z0-9]+_[0-9]+$/),
  })
)

