import vine from '@vinejs/vine'
import { PATCH_PATTERN } from '../../inertia/lib/patches.js'
import { BRACKETS } from '#services/ranked_stats'
import { REGIONS } from '#services/champion_stats'

/** The rank bracket, patch and region of a champion's matchups and of the tier list (all ranks, newest patch, every region by default). */
export const matchupQueryValidator = vine.compile(
  vine.object({
    bracket: vine.enum(Object.keys(BRACKETS) as (keyof typeof BRACKETS)[]).optional(),
    patch: vine.string().trim().regex(PATCH_PATTERN).optional(),
    region: vine.enum(Object.keys(REGIONS)).optional(),
  })
)
