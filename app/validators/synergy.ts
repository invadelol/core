import vine from '@vinejs/vine'

const PUUID = /^[a-zA-Z0-9_-]{78}$/

/** A player and one of their teammates. */
export const duoParamsValidator = vine.compile(
  vine.object({
    puuid: vine.string().trim().regex(PUUID),
    mate: vine.string().trim().regex(PUUID),
  })
)

/** A page of the games two players played together. */
export const togetherValidator = vine.compile(
  vine.object({
    count: vine.number().withoutDecimals().min(1).max(50).optional(),
    offset: vine.number().withoutDecimals().min(0).optional(),
  })
)
