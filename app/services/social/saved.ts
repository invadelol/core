import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import matchRepository from '#services/analytics/match_repository'
import { AccountError } from '#services/accounts/errors'
import {
  PUUID,
  SHOWN_MAIN_COLUMNS,
  SHOWN_MAIN_JOIN,
  avatarOf,
  iso,
} from '#services/social/cards'
import { ACCOUNT_LIMITS, SAVED_KINDS, type SavedKind } from '../../../inertia/lib/account_types.js'
import type { ClipCard, ClipCardVisibility } from '../../../inertia/lib/profile_types.js'
import type {
  SavedClip,
  SavedItems,
  SavedKeys,
  SavedMatch,
} from '../../../inertia/lib/saved_types.js'
import type { Match } from '../../../inertia/lib/types.js'

const CLIP_ID = /^[A-Za-z0-9]{6,16}$/
export const MATCH_ID = /^[A-Z0-9]{2,6}_\d{1,15}$/
/** The newest saved items of each kind a page lists; the counts say how many there are. */
const PAGE = 60

export const isSavedKind = (value: unknown): value is SavedKind =>
  SAVED_KINDS.includes(value as SavedKind)

/** The number in a match id, as the shared rows key a game. */
export const gameIdOf = (matchId: string) => matchId.slice(matchId.indexOf('_') + 1)

/**
 * A clip someone may keep: ready, and watchable by them (anyone's public or link-only clip, or
 * their own private one).
 */
const VISIBLE_CLIP = `c.status = 'ready' AND (c.visibility <> 'private' OR c.user_id = ?)`

type Row = Record<string, unknown>

function clipCard(row: Row): ClipCard {
  const id = String(row.id)
  return {
    id,
    url: `/clip/${id}`,
    poster: `/clips/${id}.jpg`,
    title: String(row.title),
    championId: Number(row.champion_id),
    matchId: row.match_id ? String(row.match_id) : null,
    startMs: Number(row.start_ms),
    durationMs: Number(row.duration_ms),
    moment: null,
    visibility: row.visibility as ClipCardVisibility,
    views: Number(row.views),
    comments: Number(row.comment_count),
    gg: Number(row.gg),
    postedAt: iso(row.created_at),
  }
}

/**
 * Saved items, the account's Favorites (docs/desktop-sync.md §10.4): the clips and matches a
 * person keeps, the same on the site and in the app. People are followed, never saved.
 */
class SavedService {
  /**
   * Keeps a clip or a match; keeping it again is already done (a match saved from another
   * player's page is then drawn from that player's side). `puuid`: whose game a match is.
   */
  async save(
    trx: QueryClientContract,
    userId: string,
    kind: unknown,
    id: unknown,
    puuid?: unknown
  ) {
    if (!isSavedKind(kind) || typeof id !== 'string') throw AccountError.invalid('Unknown item.')
    const side = typeof puuid === 'string' && PUUID.test(puuid) ? puuid : null
    if (kind === 'clip') await this.checkClip(trx, userId, id)
    else await this.checkMatch(id)
    const existing = await trx
      .from('invade_saved')
      .where({ user_id: userId, kind, target_id: id })
      .first()
    if (existing) {
      if (side && existing.puuid !== side) {
        await trx.from('invade_saved').where('id', existing.id).update({ puuid: side })
      }
      return
    }
    const [{ total }] = await trx.from('invade_saved').where('user_id', userId).count('* as total')
    if (Number(total) >= ACCOUNT_LIMITS.saved) {
      throw AccountError.limit(
        `You can keep up to ${ACCOUNT_LIMITS.saved.toLocaleString('en-US')} clips and matches.`
      )
    }
    await trx
      .knexQuery()
      .table('invade_saved')
      .insert({ user_id: userId, kind, target_id: id, puuid: side })
      .onConflict(['user_id', 'kind', 'target_id'])
      .ignore()
  }

  /** Lets an item go; one that is not kept is already gone. */
  async unsave(trx: QueryClientContract, userId: string, kind: unknown, id: unknown) {
    if (!isSavedKind(kind) || typeof id !== 'string') throw AccountError.invalid('Unknown item.')
    await trx.from('invade_saved').where({ user_id: userId, kind, target_id: id }).delete()
  }

  private async checkClip(trx: QueryClientContract, userId: string, id: string) {
    const clip = CLIP_ID.test(id)
      ? await trx
          .from('invade_clip as c')
          .where('c.id', id)
          .whereRaw(VISIBLE_CLIP, [userId])
          .first()
      : null
    if (!clip) throw AccountError.notFound('This clip is not available.')
  }

  private async checkMatch(id: string) {
    const known = MATCH_ID.test(id) ? await matchRepository.getExistingIds([id]) : new Set()
    if (!known.has(id)) throw AccountError.notFound('This match is not on Invade.')
  }

  /** How many items a person keeps. */
  async count(userId: string) {
    const [{ total }] = await db.from('invade_saved').where('user_id', userId).count('* as total')
    return Number(total)
  }

  /** What the stars need: which clips and games the person keeps. */
  async keys(userId: string): Promise<SavedKeys> {
    const rows = await db
      .from('invade_saved')
      .where('user_id', userId)
      .select('kind', 'target_id')
      .limit(ACCOUNT_LIMITS.saved)
    return {
      clips: rows.filter((r) => r.kind === 'clip').map((r) => r.target_id),
      games: rows.filter((r) => r.kind === 'match').map((r) => gameIdOf(r.target_id)),
    }
  }

  /** Whether the person keeps this item. */
  async has(userId: string, kind: SavedKind, id: string) {
    return Boolean(
      await db.from('invade_saved').where({ user_id: userId, kind, target_id: id }).first()
    )
  }

  /** The Favorites page: the newest clips and matches kept, and how many of each. */
  async list(userId: string): Promise<SavedItems> {
    const [clips, matches, counts] = await Promise.all([
      this.clips(userId),
      this.matches(userId),
      db
        .from('invade_saved')
        .where('user_id', userId)
        .groupBy('kind')
        .select('kind')
        .count('* as total'),
    ])
    const total = (kind: SavedKind) => Number(counts.find((c) => c.kind === kind)?.total ?? 0)
    return { clips, matches, counts: { clips: total('clip'), matches: total('match') } }
  }

  private async clips(userId: string): Promise<SavedClip[]> {
    const rows = await db.rawQuery(
      `SELECT c.*, s.created_at AS saved_at, u.display_name, u.handle, ${SHOWN_MAIN_COLUMNS},
         (SELECT count(*) FROM invade_clip_comment cc WHERE cc.clip_id = c.id)::int
           AS comment_count,
         (SELECT count(*) FROM invade_gg g
           WHERE g.target_kind = 'clip' AND g.target_id = c.id)::int AS gg
       FROM invade_saved s
       JOIN invade_clip c ON c.id = s.target_id
       JOIN invade_user u ON u.id = c.user_id
       ${SHOWN_MAIN_JOIN}
       WHERE s.user_id = ? AND s.kind = 'clip' AND ${VISIBLE_CLIP}
       ORDER BY s.created_at DESC
       LIMIT ${PAGE}`,
      [userId, userId]
    )
    return rows.rows.map((row: Row) => ({
      clip: clipCard(row),
      by: {
        name: String(row.display_name),
        avatar: avatarOf(row),
        href: row.handle ? `/u/${row.handle}` : null,
      },
      savedAt: iso(row.saved_at),
    }))
  }

  /**
   * Saved matches from the stored games, each from its saved player's side: the person's own
   * League account in it when no player was named, else the first player of the game.
   */
  private async matches(userId: string): Promise<SavedMatch[]> {
    const saved = await db
      .from('invade_saved as s')
      .where({ 's.user_id': userId, 's.kind': 'match' })
      .orderBy('s.created_at', 'desc')
      .limit(PAGE)
      .select('s.target_id', 's.puuid', 's.created_at')
    if (!saved.length) return []
    const [games, owned] = await Promise.all([
      matchRepository.getByIds(saved.map((s) => s.target_id)) as Promise<Match[]>,
      db
        .from('invade_owned_account')
        .where('user_id', userId)
        .whereNull('removed_at')
        .select('puuid'),
    ])
    const own = new Set(owned.map((o) => o.puuid as string))
    const byId = new Map(games.map((g) => [g.matchId, g]))
    const out: SavedMatch[] = []
    for (const s of saved) {
      const match = byId.get(s.target_id)
      if (!match?.participants.length) continue
      const player =
        match.participants.find((p) => p.puuid === s.puuid) ??
        match.participants.find((p) => own.has(p.puuid)) ??
        match.participants[0]
      out.push({
        match,
        puuid: player.puuid,
        gameName: player.gameName,
        tagLine: player.tagLine,
        savedAt: iso(s.created_at),
      })
    }
    return out
  }

  /** A clip that goes leaves every Favorites it was in. */
  async forgetClips(trx: QueryClientContract, clipIds: string[]) {
    if (!clipIds.length) return
    await trx.from('invade_saved').where('kind', 'clip').whereIn('target_id', clipIds).delete()
  }
}

export default new SavedService()
