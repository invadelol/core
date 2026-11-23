import { accountOrigin } from '#services/accounts/session_service'
import proPhotoService from '#services/pro_photo_service'
import { avatarUrl } from '#services/profiles/people'
import { profilePath } from '../../../inertia/lib/format.js'
import { SERVER } from '../../../inertia/lib/board.js'
import { rankText } from '../../../inertia/lib/account_format.js'
import type { AccountProfile } from '../../../inertia/lib/account_types.js'
import type { CardAccount } from '../../../inertia/lib/profile_types.js'

/**
 * How people, League accounts and pros are drawn in the account's lists: the SQL that reads them
 * beside a follow or a person, and what a row of it becomes. One place, so a list on the site, the
 * app's account and a profile's friends name everyone the same way.
 */

const ROLE: Record<string, string> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MID: 'mid',
  ADC: 'bot',
  SUPPORT: 'support',
}

/** An API PUUID as the site's routes carry it. */
export const PUUID = /^[A-Za-z0-9_-]{20,100}$/
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const PRO_SLUG = /^[a-z0-9][a-z0-9._-]{0,63}$/i

/** The newest Solo/Duo rank of the League account `p`, as `r`. */
export const RANK_JOIN = `
  LEFT JOIN LATERAL (
    SELECT tier, division, league_points FROM riot_rank
    WHERE puuid = p.puuid AND queue_type = 'RANKED_SOLO_5x5'
    ORDER BY fetched_at DESC LIMIT 1
  ) r ON true`

/** A League account and its rank, read with `RANK_JOIN`. */
export const PROFILE_COLUMNS = `
  p.puuid, p.game_name, p.tag_line, p.platform, p.profile_icon_id,
  r.tier, r.division, r.league_points`

/**
 * A person's main League account `m` (with its rank `mr`), only when they show it on their
 * profile; joined to a person `u`.
 */
export const SHOWN_MAIN_JOIN = `
  LEFT JOIN invade_owned_account mo
    ON mo.puuid = u.main_puuid AND mo.user_id = u.id AND mo.removed_at IS NULL AND mo.shown
  LEFT JOIN riot_player m ON m.puuid = mo.puuid
  LEFT JOIN LATERAL (
    SELECT tier, division FROM riot_rank
    WHERE puuid = m.puuid AND queue_type = 'RANKED_SOLO_5x5'
    ORDER BY fetched_at DESC LIMIT 1
  ) mr ON m.puuid IS NOT NULL
  LEFT JOIN invade_profile pav ON pav.user_id = u.id`

/** The columns `SHOWN_MAIN_JOIN` adds. */
export const SHOWN_MAIN_COLUMNS = `
  m.puuid AS sm_puuid, m.game_name AS sm_game_name, m.tag_line AS sm_tag_line,
  m.platform AS sm_platform, m.profile_icon_id AS sm_icon,
  mr.tier AS sm_tier, mr.division AS sm_division,
  pav.avatar AS sm_avatar, pav.backdrop_skin AS sm_backdrop`

type Row = Record<string, unknown>

const text = (value: unknown) => (typeof value === 'string' ? value : null)
const integer = (value: unknown) =>
  value === null || value === undefined ? null : Number(value) || 0

export const iso = (value: unknown) => new Date(value as string).toISOString()

/** An absolute address on this site, for the app. */
export const absolute = (path: string) => `${accountOrigin()}${path}`

export const profileIconUrl = (id: number | null) => absolute(`/cdn/profile-icon/${id ?? 29}.png`)

export function profileOf(row: Row): AccountProfile {
  return {
    puuid: String(row.puuid),
    gameName: String(row.game_name),
    tagLine: String(row.tag_line),
    platform: String(row.platform),
    profileIconId: integer(row.profile_icon_id),
    tier: text(row.tier),
    division: text(row.division),
    lp: integer(row.league_points),
  }
}

/** The shown main account a `SHOWN_MAIN_COLUMNS` row carries, or null. */
export function shownMainOf(row: Row): CardAccount | null {
  if (!row.sm_puuid) return null
  return {
    puuid: String(row.sm_puuid),
    gameName: String(row.sm_game_name),
    tagLine: String(row.sm_tag_line),
    platform: String(row.sm_platform),
    profileIconId: integer(row.sm_icon),
    tier: text(row.sm_tier),
    division: text(row.sm_division),
  }
}

/**
 * A person's picture, as their profile draws it: the tile of their backdrop skin, else their shown
 * main account's icon, else none.
 */
export const avatarOf = (row: Row) => {
  const url = avatarUrl({
    avatar: text(row.sm_avatar),
    backdropSkin: integer(row.sm_backdrop),
    iconId: row.sm_puuid ? integer(row.sm_icon) : null,
  })
  return url ? absolute(url) : null
}

/** A person as a list names them: their main Riot ID under their name, when they show it. */
export function personLine(row: Row) {
  return row.sm_puuid ? `${row.sm_game_name}#${row.sm_tag_line}` : null
}

export const personHref = (handle: unknown) => `/u/${String(handle)}`
export const playerHref = (gameName: unknown, tagLine: unknown) =>
  profilePath(String(gameName), String(tagLine))
export const proHref = (slug: unknown) => `/pro/${String(slug)}`

/** A League account's line in a list: its rank, else its server. */
export function playerLine(row: Row) {
  return (
    rankText(text(row.tier), text(row.division)) ??
    SERVER[String(row.platform)] ??
    String(row.platform)
  )
}

/** A pro's line: "G2 Esports, mid". */
export function proLine(team: unknown, role: unknown) {
  const parts = [text(team), ROLE[String(role)] ?? null].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

/** A pro's photo, from our own origin, when they have one. */
export function proPhotoUrl(slug: string) {
  const version = proPhotoService.of(slug)
  return version ? absolute(`/cdn/pro/${slug}?s=96&v=${version}`) : null
}
