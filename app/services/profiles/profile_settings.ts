import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'
import { AccountError } from '#services/accounts/errors'
import {
  ACCENTS,
  DEFAULT_SHOWCASES,
  FREE_ACCENT,
  LINK_HANDLE,
  LINK_KINDS,
  PLUS_SHOWCASES,
  PROFILE_LIMITS,
  SHOWCASES,
  type Accent,
  type AvatarSource,
  type LinkKind,
  type ProfileSettings,
  type Showcase,
  type ShowcaseKey,
} from '../../../inertia/lib/invade_profile.js'
import { SKIN_LIMITS } from '../../../inertia/lib/skin_types.js'

/** An `invade_profile` row as stored. */
export interface ProfileRow {
  bio: string
  links: unknown
  backdrop_skin: number | null
  avatar: string
  accent: string
  frame: boolean
  showcases: unknown
  favorite_skins: number[]
}

const isAccent = (value: unknown): value is Accent => ACCENTS.includes(value as Accent)
const isShowcase = (value: unknown): value is ShowcaseKey =>
  SHOWCASES.includes(value as ShowcaseKey)
const isLinkKind = (value: unknown): value is LinkKind => LINK_KINDS.includes(value as LinkKind)

/**
 * Every showcase once, in the owner's order: keys the site no longer knows are dropped, and
 * showcases added since the owner last saved come after theirs, off.
 */
export function orderedShowcases(stored: unknown): Showcase[] {
  const out: Showcase[] = []
  for (const entry of Array.isArray(stored) ? stored : []) {
    if (isShowcase(entry?.key) && !out.some((s) => s.key === entry.key)) {
      out.push({ key: entry.key, on: entry.on === true })
    }
  }
  if (!out.length) return DEFAULT_SHOWCASES.map((s) => ({ ...s }))
  for (const key of SHOWCASES) if (!out.some((s) => s.key === key)) out.push({ key, on: false })
  return out
}

/** The owner's choices as stored, or the defaults for a person who never customised. */
export function settingsFromRow(row: ProfileRow | null): ProfileSettings {
  const links = (Array.isArray(row?.links) ? row.links : []).flatMap(
    (link: { kind?: unknown; handle?: unknown }) => {
      const { kind, handle } = link ?? {}
      return isLinkKind(kind) && typeof handle === 'string' && LINK_HANDLE[kind].test(handle)
        ? [{ kind, handle }]
        : []
    }
  )
  return {
    bio: row?.bio ?? '',
    links,
    backdrop: row?.backdrop_skin ?? null,
    avatar: row?.avatar === 'icon' ? 'icon' : 'backdrop',
    accent: isAccent(row?.accent) ? row.accent : FREE_ACCENT,
    frame: row?.frame === true,
    showcases: orderedShowcases(row?.showcases),
    favorites: (row?.favorite_skins ?? []).slice(0, SKIN_LIMITS.favorites),
  }
}

/**
 * What the page shows: an account without Invade+ (a lapsed one included) keeps its choices
 * stored, but shows the free ones (violet, no frame, the Invade+ showcases off).
 */
export function effectiveSettings(settings: ProfileSettings, premium: boolean): ProfileSettings {
  if (premium) return settings
  return {
    ...settings,
    accent: FREE_ACCENT,
    frame: false,
    showcases: settings.showcases.map((s) => (PLUS_SHOWCASES.has(s.key) ? { ...s, on: false } : s)),
  }
}

const settingsSchema = vine.compile(
  vine.object({
    bio: vine.string().maxLength(PROFILE_LIMITS.bio * 2),
    links: vine
      .array(
        vine.object({ kind: vine.enum(LINK_KINDS), handle: vine.string().trim().maxLength(40) })
      )
      .maxLength(LINK_KINDS.length),
    backdrop: vine.number().withoutDecimals().positive().nullable(),
    avatar: vine.enum(['backdrop', 'icon'] as const),
    accent: vine.enum(ACCENTS),
    frame: vine.boolean(),
    showcases: vine
      .array(vine.object({ key: vine.enum(SHOWCASES), on: vine.boolean() }))
      .maxLength(SHOWCASES.length),
    favorites: vine
      .array(vine.number().withoutDecimals().positive())
      .maxLength(SKIN_LIMITS.favorites),
  })
)

/** What a choice may be checked against: the account's grants and the skins it may use. */
export interface SettingsContext {
  premium: boolean
  owned: ReadonlySet<number>
  known: (skinId: number) => boolean
}

/**
 * The owner's new choices, checked: the shape, each network's handle rule, a backdrop among the
 * skins they own, favourites that exist, and Invade+ for anything beyond the free choices.
 * Refusals are `AccountError`s, in words for the page.
 */
export async function parseSettings(
  input: unknown,
  context: SettingsContext
): Promise<ProfileSettings> {
  let data: Awaited<ReturnType<typeof settingsSchema.validate>>
  try {
    data = await settingsSchema.validate(input)
  } catch (error) {
    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      throw AccountError.invalid('These profile settings could not be read.')
    }
    throw error
  }

  const bio = data.bio.replace(/\s+/g, ' ').trim()
  if (bio.length > PROFILE_LIMITS.bio) {
    throw AccountError.invalid(`Keep your bio to ${PROFILE_LIMITS.bio} characters.`)
  }

  const links: ProfileSettings['links'] = []
  for (const link of data.links) {
    const handle = link.handle.replace(/^@/, '')
    if (!handle) continue
    if (!LINK_HANDLE[link.kind].test(handle)) {
      throw AccountError.invalid(`That is not a ${link.kind === 'x' ? 'X' : link.kind} name.`)
    }
    if (links.some((l) => l.kind === link.kind)) {
      throw AccountError.invalid('One link per network.')
    }
    links.push({ kind: link.kind, handle })
  }

  if (data.backdrop !== null && !context.owned.has(data.backdrop)) {
    throw AccountError.invalid('Pick a backdrop from the skins you own.')
  }

  const favorites = [...new Set(data.favorites)]
  if (favorites.length !== data.favorites.length || !favorites.every(context.known)) {
    throw AccountError.invalid('Pick four different skins.')
  }

  const keys = data.showcases.map((s) => s.key)
  if (new Set(keys).size !== keys.length) throw AccountError.invalid('Each showcase once.')
  const showcases = orderedShowcases(data.showcases)

  if (!context.premium) {
    const plus =
      data.accent !== FREE_ACCENT ||
      data.frame ||
      showcases.some((s) => s.on && PLUS_SHOWCASES.has(s.key))
    if (plus) throw AccountError.invalid('Accents, frames and these showcases come with Invade+.')
  }

  return {
    bio,
    links,
    backdrop: data.backdrop,
    avatar: data.avatar as AvatarSource,
    accent: data.accent,
    frame: data.frame,
    showcases,
    favorites,
  }
}
