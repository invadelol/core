import db from '@adonisjs/lucid/services/db'
import { accountOrigin } from '#services/accounts/session_service'
import { SHOWN_MAIN_COLUMNS, SHOWN_MAIN_JOIN, avatarOf, iso } from '#services/social/cards'
import type { ClipNotification } from '../../../inertia/lib/clip_types.js'

/** What one answer holds at most. */
const PAGE = 30

/** One item of `notificationsOf`'s union, with its actor and clip. */
type NotificationRow = {
  kind: ClipNotification['kind']
  id: string
  at: Date
  clip_id: string | null
  text: string | null
  champion_id: number | null
  display_name: string
  handle: string
  sm_puuid: string | null
  sm_icon: number | null
  clip_title: string | null
}

/** A cursor is the newest item's time and id: the next poll asks for what came after it. */
const encode = (at: string, id: string) => Buffer.from(`${at}|${id}`).toString('base64url')
function decode(cursor: unknown): [string, string] | null {
  if (typeof cursor !== 'string' || !cursor || cursor.length > 200) return null
  const [at, id] = Buffer.from(cursor, 'base64url').toString().split('|')
  return at && !Number.isNaN(Date.parse(at)) && id ? [at, id] : null
}

/**
 * What happened around a person's clips and account (docs/desktop-sync.md §12): comments on their
 * clips, replies to their comments, GGs on either, and new followers; never their own doing.
 * Newest first, thirty at most; `after` asks only for what came after an earlier answer.
 */
export async function notificationsOf(userId: string, after?: unknown) {
  const since = decode(after)
  const result = await db.rawQuery(
    `WITH items AS (
       SELECT 'comment' AS kind, cc.id::text AS id, cc.created_at AS at, cc.user_id AS actor,
              cc.clip_id, cc.body AS text, cc.champion_id
       FROM invade_clip_comment cc JOIN invade_clip c ON c.id = cc.clip_id
       WHERE c.user_id = :me AND cc.parent_id IS NULL AND cc.user_id <> :me
       UNION ALL
       SELECT 'reply', r.id::text, r.created_at, r.user_id, r.clip_id, r.body, r.champion_id
       FROM invade_clip_comment r JOIN invade_clip_comment p ON p.id = r.parent_id
       WHERE p.user_id = :me AND r.user_id <> :me
       UNION ALL
       SELECT 'gg', g.target_kind || ':' || g.target_id || ':' || g.user_id, g.created_at,
              g.user_id, COALESCE(c.id, cc.clip_id), NULL, NULL
       FROM invade_gg g
       LEFT JOIN invade_clip c ON g.target_kind = 'clip' AND c.id = g.target_id
       LEFT JOIN invade_clip_comment cc
         ON g.target_kind = 'comment' AND cc.id::text = g.target_id
       WHERE g.user_id <> :me AND (c.user_id = :me OR cc.user_id = :me)
       UNION ALL
       SELECT 'follow', f.id::text, f.created_at, f.follower_id, NULL, NULL, NULL
       FROM invade_follow f
       WHERE f.target_kind = 'user' AND f.target_id = :me::text
     )
     SELECT i.*, u.display_name, u.handle, ${SHOWN_MAIN_COLUMNS},
            clip.title AS clip_title
     FROM items i
     JOIN invade_user u ON u.id = i.actor
     ${SHOWN_MAIN_JOIN}
     LEFT JOIN invade_clip clip ON clip.id = i.clip_id
     WHERE ${since ? "(date_trunc('milliseconds', i.at), i.id) > (:at::timestamptz, :id)" : 'true'}
     ORDER BY i.at DESC, i.id DESC
     LIMIT ${PAGE}`,
    { me: userId, at: since?.[0] ?? null, id: since?.[1] ?? null }
  )
  const items: ClipNotification[] = (result.rows as NotificationRow[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    at: iso(row.at),
    actor: {
      name: row.display_name,
      handle: row.handle,
      avatarUrl: avatarOf(row),
      championId: row.champion_id,
      inGame: row.champion_id !== null,
    },
    clip: row.clip_id
      ? {
          id: row.clip_id,
          title: row.clip_title ?? '',
          url: `${accountOrigin()}/clip/${row.clip_id}`,
        }
      : null,
    text: row.text,
  }))
  const newest = items[0]
  return {
    items,
    cursor: newest
      ? encode(newest.at, newest.id)
      : typeof after === 'string' && since
        ? after
        : null,
  }
}
