import db from '@adonisjs/lucid/services/db'
import type { PersonRef } from '../../../inertia/lib/skin_types.js'

/** What a person's avatar is drawn from: their choice, their backdrop skin, their main's icon. */
export interface AvatarParts {
  avatar: string | null
  backdropSkin: number | null
  iconId: number | null
}

/**
 * A person's square picture: the tile of their backdrop skin (the crop the League client's
 * collection shows), or their main League account's icon; null when they have neither.
 */
export function avatarUrl(parts: AvatarParts): string | null {
  if (parts.avatar !== 'icon' && parts.backdropSkin) {
    return `/cdn/tile/${Math.floor(parts.backdropSkin / 1000)}-${parts.backdropSkin % 1000}.jpg`
  }
  return parts.iconId !== null ? `/cdn/profile-icon/${parts.iconId}.png` : null
}

/**
 * The columns `personOf` reads, for a query joining `invade_user u`: the profile's picture
 * choice, and the main account's icon and tag only when the owner shows that account.
 */
export const PERSON_COLUMNS = `
  u.id AS person_id, u.display_name AS person_name, u.handle AS person_handle,
  pr.avatar AS person_avatar, pr.backdrop_skin AS person_backdrop,
  CASE WHEN mo.shown THEN mp.profile_icon_id END AS person_icon,
  CASE WHEN mo.shown THEN mp.tag_line END AS person_tag
`
export const PERSON_JOINS = `
  LEFT JOIN invade_profile pr ON pr.user_id = u.id
  LEFT JOIN riot_player mp ON mp.puuid = u.main_puuid
  LEFT JOIN invade_owned_account mo
    ON mo.puuid = u.main_puuid AND mo.user_id = u.id AND mo.removed_at IS NULL
`

export function personOf(row: Record<string, any>): PersonRef {
  return {
    id: row.person_id,
    name: row.person_name,
    handle: row.person_handle ?? '',
    avatarUrl: avatarUrl({
      avatar: row.person_avatar ?? null,
      backdropSkin: row.person_backdrop ?? null,
      iconId: row.person_icon ?? null,
    }),
    tag: row.person_tag ?? null,
  }
}

/** Several people by id, for rows that only hold their ids. */
export async function loadPeople(ids: Iterable<string>): Promise<Map<string, PersonRef>> {
  const list = [...new Set(ids)]
  if (!list.length) return new Map()
  const result = await db.rawQuery(
    `SELECT ${PERSON_COLUMNS} FROM invade_user u ${PERSON_JOINS} WHERE u.id = ANY(?)`,
    [list]
  )
  return new Map(result.rows.map((row: Record<string, any>) => [row.person_id, personOf(row)]))
}

/** The Invade accounts that follow `userId` and that `userId` follows back. */
export async function friendIds(userId: string): Promise<string[]> {
  const result = await db.rawQuery(
    `SELECT f.target_id AS id FROM invade_follow f
     JOIN invade_follow b
       ON b.follower_id::text = f.target_id AND b.target_kind = 'user'
      AND b.target_id = f.follower_id::text
     WHERE f.follower_id = ? AND f.target_kind = 'user'`,
    [userId]
  )
  return result.rows.map((row: { id: string }) => row.id)
}
