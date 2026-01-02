import vine from '@vinejs/vine'

/**
 * Validates PUUID route parameter
 * PUUIDs are exactly 78 characters: base64url encoded
 */
export const puuidParamsValidator = vine.compile(
  vine.object({
    puuid: vine
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_-]{78}$/),
  })
)

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

export const getStatsValidator = vine.compile(
  vine.object({
    type: vine.enum(['normal', 'ranked', 'aram', 'flex', 'all']).optional(),
    count: vine.number().min(1).optional(),
    champion: vine.number().optional(),
    role: vine.enum(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT', 'all']).optional(),
  })
)

export const getChampionStatsValidator = vine.compile(
  vine.object({
    count: vine.number().min(1).max(100).optional(),
  })
)

export const getMatchesValidator = vine.compile(
  vine.object({
    type: vine.enum(['normal', 'ranked', 'aram', 'flex', 'all']).optional(),
    count: vine.number().min(1).max(100).optional(),
    offset: vine.number().min(0).optional(),
    champion: vine.number().optional(),
    role: vine.enum(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT', 'all']).optional(),
  })
)
