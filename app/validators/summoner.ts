import vine from '@vinejs/vine'

export const summonerParamsValidator = vine.compile(
  vine.object({
    summoner: vine
      .string()
      .trim()
      .regex(/^[^-]+-[^-]+$/),
  })
)

