import vine from '@vinejs/vine'
import { BRACKETS, MAX_PICK_BRACKETS, ROLES } from '#services/ranked_stats'

/**
 * A champion (numeric id) in a role: the rune page, build and summoner spell statistics of our
 * own ranked games all take it.
 */
export const runeParamsValidator = vine.compile(
  vine.object({
    champion: vine.number().withoutDecimals().min(1).max(9999),
    role: vine.enum(Object.keys(ROLES) as (keyof typeof ROLES)[]),
  })
)

/** The rank bracket and patch to read (latest patch with enough games by default). */
export const runeQueryValidator = vine.compile(
  vine.object({
    bracket: vine.enum(Object.keys(BRACKETS) as (keyof typeof BRACKETS)[]).optional(),
    patch: vine
      .string()
      .trim()
      .regex(/^\d{1,2}\.\d{1,2}$/)
      .optional(),
  })
)

const BRACKET = `(${Object.keys(BRACKETS).join('|')})`

/** Several brackets, comma-separated (`emerald_plus,emerald,all`), and the patch to read. */
export const pickQueryValidator = vine.compile(
  vine.object({
    brackets: vine
      .string()
      .trim()
      .regex(new RegExp(`^${BRACKET}(,${BRACKET}){0,${MAX_PICK_BRACKETS - 1}}$`))
      .optional(),
    patch: vine
      .string()
      .trim()
      .regex(/^\d{1,2}\.\d{1,2}$/)
      .optional(),
  })
)
