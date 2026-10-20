import vine from '@vinejs/vine'
import { RUNE_BRACKETS, RUNE_ROLES } from '#services/rune_stats_service'

/** A champion (numeric id) in a role. */
export const runeParamsValidator = vine.compile(
  vine.object({
    champion: vine.number().withoutDecimals().min(1).max(9999),
    role: vine.enum(Object.keys(RUNE_ROLES) as (keyof typeof RUNE_ROLES)[]),
  })
)

/** The rank bracket and patch to read (latest patch with enough games by default). */
export const runeQueryValidator = vine.compile(
  vine.object({
    bracket: vine.enum(Object.keys(RUNE_BRACKETS) as (keyof typeof RUNE_BRACKETS)[]).optional(),
    patch: vine
      .string()
      .trim()
      .regex(/^\d{1,2}\.\d{1,2}$/)
      .optional(),
  })
)
