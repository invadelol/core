import db from '@adonisjs/lucid/services/db'
import matchRepository from '#services/analytics/match_repository'
import { AccountError } from '#services/accounts/errors'
import moderation from '#services/moderation/moderation'
import { SHOWN_MAIN_COLUMNS, SHOWN_MAIN_JOIN, UUID, avatarOf, iso } from '#services/social/cards'
import type { SignedIn } from '#services/accounts/session_service'
import type { Clip, ClipComment } from '../../../inertia/lib/clip_types.js'

export const COMMENT_LIMITS = { body: 500, perClip: 2000 }

/** A comment as `list` reads it: its writer, their shown main account, its GGs. */
type CommentRow = {
  id: string
  user_id: string
  parent_id: string | null
  body: string
  at_ms: number | null
  champion_id: number | null
  created_at: Date
  display_name: string
  handle: string
  sm_puuid: string | null
  sm_icon: number | null
  gg: number
  gg_by_viewer: boolean
  clip_owner: string
}

function cleanBody(value: unknown) {
  if (typeof value !== 'string') return null
  const body = value
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return body.length >= 1 && body.length <= COMMENT_LIMITS.body ? body : null
}

/**
 * Comments on clips, with one level of replies, and GGs on clips and comments. Who may comment is
 * the clip's own rule: everyone signed in, only the game's players, or no one. A comment names the
 * champion its writer played in the game, never their League account.
 */
class CommentService {
  /** The champion a person played in a game, from their League accounts (null: not in it). */
  async championIn(userId: string, matchId: string): Promise<number | null> {
    const owned = await db
      .from('invade_owned_account')
      .where('user_id', userId)
      .whereNull('removed_at')
      .select('puuid')
    if (!owned.length) return null
    const match = await matchRepository.getSummaryById(matchId).catch(() => null)
    const mine = new Set(owned.map((o) => o.puuid as string))
    const seat = (match?.participants ?? []).find((p: { puuid: string }) => mine.has(p.puuid))
    return seat ? Number(seat.championId) : null
  }

  /**
   * The clip's comments, oldest conversation first, each with its replies. What the team took
   * down, and everything a suspended account wrote, is left out with the replies under it.
   */
  async list(clip: Clip, viewerId: string | null): Promise<ClipComment[]> {
    const visible = await moderation.visibility()
    const result = await db.rawQuery(
      `SELECT cc.*, u.display_name, u.handle, ${SHOWN_MAIN_COLUMNS},
         (SELECT count(*) FROM invade_gg g
           WHERE g.target_kind = 'comment' AND g.target_id = cc.id::text)::int AS gg,
         EXISTS (SELECT 1 FROM invade_gg g WHERE g.target_kind = 'comment'
           AND g.target_id = cc.id::text AND g.user_id = ?::uuid) AS gg_by_viewer,
         c.user_id AS clip_owner
       FROM invade_clip_comment cc
       JOIN invade_clip c ON c.id = cc.clip_id
       JOIN invade_user u ON u.id = cc.user_id
       ${SHOWN_MAIN_JOIN}
       WHERE cc.clip_id = ? AND ${visible.thread('cc')}
       ORDER BY cc.created_at
       LIMIT ${COMMENT_LIMITS.perClip}`,
      [viewerId, clip.id]
    )
    const view = (row: CommentRow): ClipComment => ({
      id: row.id,
      body: row.body,
      atMs: row.at_ms,
      createdAt: iso(row.created_at),
      author: { name: row.display_name, handle: row.handle, avatarUrl: avatarOf(row) },
      championId: row.champion_id,
      byAuthor: row.user_id === row.clip_owner,
      mine: viewerId === row.user_id,
      gg: row.gg,
      ggByViewer: Boolean(row.gg_by_viewer),
      replies: [],
    })
    const top: ClipComment[] = []
    const byId = new Map<string, ClipComment>()
    for (const row of result.rows as CommentRow[]) {
      const comment = view(row)
      if (row.parent_id) byId.get(row.parent_id)?.replies.push(comment)
      else {
        top.push(comment)
        byId.set(comment.id, comment)
      }
    }
    return top
  }

  /** Adds a comment or a reply to a top-level comment, as the clip's rule allows. */
  async add(
    user: SignedIn,
    clip: Clip,
    input: { body?: unknown; parentId?: unknown; atMs?: unknown }
  ): Promise<void> {
    const body = cleanBody(input.body)
    if (!body) {
      throw AccountError.invalid(`Write 1 to ${COMMENT_LIMITS.body} characters.`)
    }
    const atMs =
      Number.isInteger(input.atMs) && (input.atMs as number) >= 0
        ? Math.min(input.atMs as number, clip.durationMs)
        : null
    const champion = await this.championIn(user.id, clip.matchId)
    if (!clip.mine && clip.comments === 'off') {
      throw new AccountError('Comments are off on this clip.', 403, 'E_COMMENTS_OFF')
    }
    if (!clip.mine && clip.comments === 'game' && champion === null) {
      throw new AccountError(
        'Only the players of this game can comment on this clip.',
        403,
        'E_COMMENTS_GAME'
      )
    }
    let parentId: string | null = null
    if (input.parentId !== undefined && input.parentId !== null) {
      const parent =
        typeof input.parentId === 'string' ? await this.find(clip.id, input.parentId) : null
      // Replies answer a conversation, never another reply.
      if (!parent || parent.parentId) throw AccountError.notFound('This comment is gone.')
      parentId = parent.id
    }
    const [{ total }] = await db
      .from('invade_clip_comment')
      .where('clip_id', clip.id)
      .count('* as total')
    if (Number(total) >= COMMENT_LIMITS.perClip) {
      throw AccountError.limit('This clip cannot take more comments.')
    }
    await db.table('invade_clip_comment').insert({
      clip_id: clip.id,
      user_id: user.id,
      parent_id: parentId,
      body,
      at_ms: atMs,
      champion_id: champion,
    })
  }

  /** A comment of the clip as its thread shows it, or null (unknown, taken down, hidden). */
  async find(clipId: string, id: string) {
    if (!UUID.test(id)) return null
    const visible = await moderation.visibility()
    const row = await db
      .from('invade_clip_comment as cc')
      .where({ 'cc.id': id, 'cc.clip_id': clipId })
      .whereRaw(visible.thread('cc'))
      .select('cc.id', 'cc.user_id', 'cc.parent_id', 'cc.body')
      .first()
    return row
      ? {
          id: String(row.id),
          userId: String(row.user_id),
          parentId: (row.parent_id as string | null) ?? null,
          body: String(row.body),
        }
      : null
  }

  /** Deletes a comment (and its replies): its writer or the clip's owner may. */
  async remove(user: SignedIn, clip: Clip, id: unknown) {
    const comment =
      typeof id === 'string' && UUID.test(id)
        ? await db.from('invade_clip_comment').where({ id, clip_id: clip.id }).first()
        : null
    if (!comment) throw AccountError.notFound('This comment is gone.')
    if (comment.user_id !== user.id && !clip.mine) {
      throw new AccountError(
        'Only its writer or the clip’s owner can delete it.',
        403,
        'E_NOT_YOURS'
      )
    }
    await this.purge([comment.id as string])
  }

  /** Deletes comments for good, with their replies and the GGs on all of them. */
  async purge(ids: string[]) {
    if (!ids.length) return
    const replies = await db.from('invade_clip_comment').whereIn('parent_id', ids).select('id')
    const all = [...ids, ...replies.map((r) => r.id as string)]
    await db.transaction(async (trx) => {
      await trx.from('invade_gg').where('target_kind', 'comment').whereIn('target_id', all).delete()
      // Replies go with the comment they answer (on delete cascade).
      await trx.from('invade_clip_comment').whereIn('id', ids).delete()
    })
  }

  /**
   * Gives or takes back a GG on a clip or one of its comments; answers how many it now has. A
   * GG on one's own clip or comment is not one.
   */
  async gg(
    user: SignedIn,
    clip: Clip,
    target: { kind: 'clip' | 'comment'; id: string },
    on: boolean
  ) {
    if (target.kind === 'comment') {
      const comment = await this.find(clip.id, target.id)
      if (!comment) throw AccountError.notFound('This comment is gone.')
      if (comment.userId === user.id) throw AccountError.invalid('This is your own comment.')
    } else if (clip.mine) {
      throw AccountError.invalid('This is your own clip.')
    }
    const key = { user_id: user.id, target_kind: target.kind, target_id: target.id }
    if (on) {
      await db
        .knexQuery()
        .table('invade_gg')
        .insert(key)
        .onConflict(['user_id', 'target_kind', 'target_id'])
        .ignore()
    } else {
      await db.from('invade_gg').where(key).delete()
    }
    const [{ total }] = await db
      .from('invade_gg')
      .where({ target_kind: target.kind, target_id: target.id })
      .count('* as total')
    return { gg: Number(total), ggByViewer: on }
  }
}

export default new CommentService()
