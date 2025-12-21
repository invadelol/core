import vine from '@vinejs/vine'

export const summonerParamsValidator = vine.compile(
  vine.object({
    summoner: vine
      .string()
      .trim()
      .regex(/^[^-]+-[^-]+$/),
  })
)

export const syncSummonerValidator = vine.compile(
  vine.object({
    summoner: vine
      .string()
      .trim()
      .regex(/^[^-]+-[^-]+$/),
    platform: vine.string().trim().toUpperCase(),
  })
)
