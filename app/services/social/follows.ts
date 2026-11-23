import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { AccountError } from '#services/accounts/errors'
import moderation from '#services/moderation/moderation'
import {
  PRO_SLUG,
  PUUID,
  RANK_JOIN,
  SHOWN_MAIN_COLUMNS,
  SHOWN_MAIN_JOIN,
  UUID,
  avatarOf,
  iso,
  personHref,
  personLine,
  playerHref,
  playerLine,
  proHref,
  proLine,
  proPhotoUrl,
  profileIconUrl,
} from '#services/social/cards'
import {
  ACCOUNT_LIMITS,
  FOLLOW_KINDS,
  type FollowCard,
  type FollowKind,
  type FollowRow,
  type FollowState,
} from '../../../inertia/lib/account_types.js'

/** A page of a list: its rows, and where the next page starts (null: the end). */
export interface Page<T> {
  items: T[]
  cursor: string | null
}

export const isFollowKind = (value: unknown): value is FollowKind =>
  FOLLOW_KINDS.includes(value as FollowKind)

/** Whether `id` has the shape of a `kind` target: a person's id, an API PUUID, a pro's slug. */
function wellFormed(kind: FollowKind, id: unknown): id is string {
  if (typeof id !== 'string') return false
  if (kind === 'user') return UUID.test(id)
  if (kind === 'player') return PUUID.test(id)
  return PRO_SLUG.test(id)
}

/**
 * Everything a follow can point at, joined once: a person (with their shown main account), a
 * League account (with its rank), a pro (with their current team). `f` is the follow.
 */
const TARGET_JOINS = `
  LEFT JOIN invade_user u
    ON u.id = CASE WHEN f.target_kind = 'user' THEN f.target_id::uuid END
  ${SHOWN_MAIN_JOIN}
  LEFT JOIN riot_player p ON f.target_kind = 'player' AND p.puuid = f.target_id
  ${RANK_JOIN}
  LEFT JOIN LATERAL (
    SELECT pp.slug, pp.name, pp.role, team.name AS team_name
    FROM pro_player pp
    LEFT JOIN LATERAL (
      SELECT t.name FROM pro_team_member tm JOIN pro_team t ON t.id = tm.team_id
      WHERE tm.player_id = pp.id AND tm.current
      ORDER BY tm.joined_at DESC NULLS LAST LIMIT 1
    ) team ON true
    WHERE f.target_kind = 'pro' AND pp.slug = f.target_id
    LIMIT 1
  ) pro ON true`

const TARGET_COLUMNS = `
  f.target_kind, f.target_id, f.created_at,
  u.id AS user_id, u.display_name, u.handle, ${SHOWN_MAIN_COLUMNS},
  p.puuid, p.game_name, p.tag_line, p.platform, p.profile_icon_id, r.tier, r.division,
  pro.slug AS pro_slug, pro.name AS pro_name, pro.role AS pro_role, pro.team_name`

/** A target that still exists: a follow of something gone is left out. */
const TARGET_EXISTS = '(u.id IS NOT NULL OR p.puuid IS NOT NULL OR pro.slug IS NOT NULL)'

/** The person a follow `alias` points at, when it points at a person (null otherwise). */
const followedPerson = (alias: string) =>
  `CASE WHEN ${alias}.target_kind = 'user' THEN ${alias}.target_id::uuid END`

type Row = Record<string, unknown>

function cardOf(row: Row): FollowCard {
  const since = iso(row.created_at)
  if (row.target_kind === 'user') {
    return {
      kind: 'user',
      id: String(row.user_id),
      name: String(row.display_name),
      subtitle: personLine(row),
      imageUrl: avatarOf(row),
      href: personHref(row.handle),
      since,
    }
  }
  if (row.target_kind === 'player') {
    return {
      kind: 'player',
      id: String(row.puuid),
      name: String(row.game_name),
      subtitle: playerLine(row),
      imageUrl: profileIconUrl(row.profile_icon_id === null ? null : Number(row.profile_icon_id)),
      href: playerHref(row.game_name, row.tag_line),
      since,
    }
  }
  return {
    kind: 'pro',
    id: String(row.pro_slug),
    name: String(row.pro_name),
    subtitle: proLine(row.team_name, row.pro_role),
    imageUrl: proPhotoUrl(String(row.pro_slug)),
    href: proHref(row.pro_slug),
    since,
  }
}

/** A cursor is the last row's follow time and id: stable while follows come and go. */
const encodeCursor = (row: Row) =>
  Buffer.from(`${iso(row.created_at)}|${row.follow_id}`).toString('base64url')
function decodeCursor(cursor: unknown): [string, string] | null {
  if (typeof cursor !== 'string' || cursor.length > 200) return null
  const [at, id] = Buffer.from(cursor, 'base64url').toString().split('|')
  return at && !Number.isNaN(Date.parse(at)) && UUID.test(id ?? '') ? [at, id] : null
}

/**
 * Follows (docs/desktop-sync.md §10): a person follows another person, a League account or a pro.
 * Friends are two people who follow each other. The site and the app write through `follow` and
 * `unfollow`; profiles, the account and the app read the lists and counts here.
 */
class FollowService {
  /** Starts following; following again is already done. */
  async follow(trx: QueryClientContract, userId: string, kind: unknown, id: unknown) {
    if (!isFollowKind(kind) || !wellFormed(kind, id)) {
      throw AccountError.invalid('Unknown person or player to follow.')
    }
    if (kind === 'user' && id === userId) throw AccountError.invalid('You cannot follow yourself.')
    const existing = await trx
      .from('invade_follow')
      .where({ follower_id: userId, target_kind: kind, target_id: id })
      .first()
    if (existing) return
    if (!(await this.exists(trx, kind, id))) {
      throw AccountError.notFound('This person or player is not on Invade.')
    }
    const [{ total }] = await trx
      .from('invade_follow')
      .where('follower_id', userId)
      .count('* as total')
    if (Number(total) >= ACCOUNT_LIMITS.follows) {
      throw AccountError.limit(
        `You can follow up to ${ACCOUNT_LIMITS.follows.toLocaleString('en-US')}.`
      )
    }
    await trx
      .knexQuery()
      .table('invade_follow')
      .insert({ follower_id: userId, target_kind: kind, target_id: id })
      .onConflict(['follower_id', 'target_kind', 'target_id'])
      .ignore()
  }

  /** Stops following; a follow that is not there is already gone. */
  async unfollow(trx: QueryClientContract, userId: string, kind: unknown, id: unknown) {
    if (!isFollowKind(kind) || !wellFormed(kind, id)) {
      throw AccountError.invalid('Unknown person or player to unfollow.')
    }
    await trx
      .from('invade_follow')
      .where({ follower_id: userId, target_kind: kind, target_id: id })
      .delete()
  }

  private async exists(trx: QueryClientContract, kind: FollowKind, id: string) {
    const table = { user: 'invade_user', player: 'riot_player', pro: 'pro_player' }[kind]
    const column = { user: 'id', player: 'puuid', pro: 'slug' }[kind]
    return Boolean(await trx.from(table).where(column, id).first())
  }

  /** Whether `userId` follows the target. */
  async isFollowing(userId: string, kind: FollowKind, id: string) {
    return Boolean(
      await db
        .from('invade_follow')
        .where({ follower_id: userId, target_kind: kind, target_id: id })
        .first()
    )
  }

  /** What a Follow button shows: whether the visitor follows the target, and how many do. */
  async state(viewerId: string | null, kind: FollowKind, id: string): Promise<FollowState> {
    const [following, followers] = await Promise.all([
      viewerId ? this.isFollowing(viewerId, kind, id) : false,
      this.followerCount(kind, id),
    ])
    return { following, followers }
  }

  /** How many people follow a target. */
  async followerCount(kind: FollowKind, id: string) {
    const [{ total }] = await db
      .from('invade_follow')
      .where({ target_kind: kind, target_id: id })
      .count('* as total')
    return Number(total)
  }

  /** A person's followers, following and friends; suspended accounts are not counted. */
  async counts(userId: string) {
    const visible = await moderation.visibility()
    const result = await db.rawQuery(
      `SELECT
         (SELECT count(*) FROM invade_follow f
           WHERE f.target_kind = 'user' AND f.target_id = ?
             AND ${visible.person('f.follower_id')})::int AS followers,
         (SELECT count(*) FROM invade_follow f
           WHERE f.follower_id = ? AND ${visible.person(followedPerson('f'))})::int AS following,
         (SELECT count(*) FROM invade_follow a
           WHERE a.follower_id = ? AND a.target_kind = 'user'
             AND ${visible.person(followedPerson('a'))}
             AND EXISTS (SELECT 1 FROM invade_follow b
               WHERE b.follower_id = ${followedPerson('a')}
                 AND b.target_kind = 'user' AND b.target_id = ?))::int AS friends`,
      [userId, userId, userId, userId]
    )
    const row = result.rows[0]
    return { followers: row.followers, following: row.following, friends: row.friends }
  }

  /**
   * What a person follows, newest first, a page at a time (the whole list for the app); a
   * suspended account is left out.
   */
  async following(userId: string, options: { limit: number; cursor?: unknown }) {
    const after = decodeCursor(options.cursor)
    const visible = await moderation.visibility()
    const rows = await db.rawQuery(
      `SELECT f.id AS follow_id, ${TARGET_COLUMNS}
       FROM invade_follow f ${TARGET_JOINS}
       WHERE f.follower_id = ? AND ${TARGET_EXISTS} AND ${visible.person(followedPerson('f'))}
         ${after ? 'AND (f.created_at, f.id) < (?::timestamptz, ?::uuid)' : ''}
       ORDER BY f.created_at DESC, f.id DESC
       LIMIT ?`,
      [userId, ...(after ?? []), options.limit + 1]
    )
    return this.page(rows.rows, options.limit, cardOf)
  }

  /**
   * The people who follow a target, newest first, a page at a time, each marked when the
   * signed-in visitor (`viewerId`) follows them. Suspended accounts are left out.
   */
  async followers(
    kind: FollowKind,
    id: string,
    viewerId: string | null,
    options: { limit: number; cursor?: unknown }
  ): Promise<Page<FollowRow>> {
    const after = decodeCursor(options.cursor)
    const visible = await moderation.visibility()
    const rows = await db.rawQuery(
      `SELECT f.id AS follow_id, f.created_at, 'user' AS target_kind,
         u.id AS user_id, u.display_name, u.handle, ${SHOWN_MAIN_COLUMNS},
         EXISTS (SELECT 1 FROM invade_follow v
           WHERE v.follower_id = ?::uuid AND v.target_kind = 'user'
             AND v.target_id = u.id::text) AS viewer_follows
       FROM invade_follow f
       JOIN invade_user u ON u.id = f.follower_id
       ${SHOWN_MAIN_JOIN}
       WHERE f.target_kind = ? AND f.target_id = ? AND ${visible.person('u.id')}
         ${after ? 'AND (f.created_at, f.id) < (?::timestamptz, ?::uuid)' : ''}
       ORDER BY f.created_at DESC, f.id DESC
       LIMIT ?`,
      [viewerId, kind, id, ...(after ?? []), options.limit + 1]
    )
    return this.page(rows.rows, options.limit, (row) => ({
      ...cardOf(row),
      viewerFollows: Boolean(row.viewer_follows),
    }))
  }

  private page<T>(rows: Row[], limit: number, map: (row: Row) => T): Page<T> {
    const more = rows.length > limit
    const shown = more ? rows.slice(0, limit) : rows
    return { items: shown.map(map), cursor: more ? encodeCursor(shown[shown.length - 1]) : null }
  }

  /**
   * Everyone a person is friends with (they follow each other): ids, newest friendship first.
   * A suspended account is nobody's friend while it is.
   */
  async friendIds(userId: string): Promise<string[]> {
    const visible = await moderation.visibility()
    const rows = await db.rawQuery(
      `SELECT a.target_id FROM invade_follow a
       JOIN invade_follow b
         ON b.follower_id = ${followedPerson('a')}
        AND b.target_kind = 'user' AND b.target_id = ?
       WHERE a.follower_id = ? AND a.target_kind = 'user' AND ${visible.person('b.follower_id')}
       ORDER BY GREATEST(a.created_at, b.created_at) DESC`,
      [userId, userId]
    )
    return rows.rows.map((row: { target_id: string }) => row.target_id)
  }

  /** The follows that point at a person, gone with their account. */
  async forget(trx: QueryClientContract, userId: string) {
    await trx.from('invade_follow').where({ target_kind: 'user', target_id: userId }).delete()
  }
}

export default new FollowService()
