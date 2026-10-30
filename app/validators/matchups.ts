import vine from '@vinejs/vine'
import { BRACKETS } from '#services/ranked_stats'
import { REGIONS } from '#services/champion_stats'

/** The rank bracket, patch and region of a champion's matchups (all ranks, newest patch, every region by default). */
export const matchupQueryValidator = vine.compile(
  vine.object({
    bracket: vine.enum(Object.keys(BRACKETS) as (keyof typeof BRACKETS)[]).optional(),
    patch: vine
      .string()
      .trim()
      .regex(/^\d{1,2}\.\d{1,2}$/)
      .optional(),
    region: vine.enum(Object.keys(REGIONS)).optional(),
  })
)
