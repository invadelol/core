import { randomBytes } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import logger from '@adonisjs/core/services/logger'
import clickhouse from 'adonisjs-clickhouse/services/main'
import env from '#start/env'
import matchRepository from '#services/analytics/match_repository'
import riotAssets from '#services/riot/assets'
import { AccountError } from '#services/accounts/errors'
import { accountOrigin, type SignedIn } from '#services/accounts/session_service'
import savedService from '#services/social/saved'
import { SHOWN_MAIN_COLUMNS, SHOWN_MAIN_JOIN, avatarOf, iso } from '#services/social/cards'
import { cleanEvents, keyEvent, momentOf, type GamePlayer } from '#services/clips/events'
import { fillRecap } from '#services/clips/recap'
import { CLIP_FILES, clipKey, clipStore, type ClipFileKind } from '#services/clips/storage'
import type {
  Clip,
  ClipCommentRule,
  ClipEvent,
  ClipVisibility,
  KillRecap,
  MyClip,
} from '../../../inertia/lib/clip_types.js'

/** Limits of one clip (docs/desktop-sync.md §11). One clip per game is the only quota. */
export const CLIP_LIMITS = {
  bytes: (env.get('CLIPS_MAX_MB') ?? 40) * 1024 * 1024,
  poster: 512 * 1024,
  seconds: 60,
  title: 80,
}

export const CLIP_ID = /^[A-Za-z0-9]{10}$/
const MATCH_ID = /^[A-Z0-9]{2,6}_\d{1,15}$/
const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
/** How far a game's start may be from the recording's: the loading screen, a slow client. */
const MATCH_WINDOW_MS = 15 * 60_000
/** A clip whose files never came is forgotten after this. */
const UPLOAD_MS = 2 * 60 * 60_000
const VISIBILITIES: ClipVisibility[] = ['everyone', 'link', 'private']
const COMMENT_RULES: ClipCommentRule[] = ['everyone', 'game', 'off']

const newId = () => Array.from(randomBytes(10), (b) => BASE62[b % BASE62.length]).join('')
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

function cleanTitle(value: unknown) {
  if (typeof value !== 'string') return null
  const title = value.replace(/\s+/g, ' ').trim()
  return title.length >= 1 && title.length <= CLIP_LIMITS.title ? title : null
}

/** A recorded MP4: `ftyp` box first, an H.264 stream (browsers do not all play HEVC). */
export function videoProblem(bytes: Buffer): 'format' | 'hevc' | null {
  if (bytes.length < 12 || bytes.toString('latin1', 4, 8) !== 'ftyp') return 'format'
  if (bytes.includes('hvc1', 0, 'latin1') || bytes.includes('hev1', 0, 'latin1')) return 'hevc'
  return null
}

/** A JPEG or WebP picture. */
export function isPicture(bytes: Buffer) {
  if (bytes.length < 12) return false
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return true
  return bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP'
}

/** What the app sends for a new clip (§11). */
export interface ClipInput {
  matchId?: string | null
  /** When the game started, epoch ms: the game is found from it when `matchId` is not known. */
  gameStartedAt: number
  championId: number
  title: string
  visibility?: string
  comments?: string
  /** Where the clip starts in the game, and how long it lasts (ms). */
  clipStartMs: number
  durationMs: number
  replace?: boolean
  events?: unknown
}

/** The clip a game already has online from this account, as the app's Replace sheet shows it. */
export interface ExistingClip {
  id: string
  title: string
  url: string
  views: number
  comments: number
  postedAt: string
}

export type CreateResult =
  | {
      clip: { id: string; url: string; status: 'uploading' }
      upload: Record<ClipFileKind, string>
    }
  | { existing: ExistingClip }

/** An `invade_clip` row. */
type ClipRow = {
  id: string
  user_id: string
  puuid: string
  match_id: string
  platform: string
  champion_id: number
  start_ms: number
  duration_ms: number
  title: string
  visibility: ClipVisibility
  comments: ClipCommentRule
  status: 'uploading' | 'ready'
  events: ClipEvent[] | null
  recap: KillRecap[] | null
  views: number
  pinned_at: Date | null
  created_at: Date
  ready_at: Date | null
}

/** A clip as `CLIP_SQL` reads it: its author, their shown main account, the counts. */
type ClipViewRow = ClipRow & {
  display_name: string
  handle: string
  sm_puuid: string | null
  sm_icon: number | null
  game_name: string | null
  tag_line: string | null
  profile_icon_id: number | null
  comment_count: number
  gg: number
  gg_by_viewer: boolean
}

/** A clip of the person's own list, with its counts. */
type MyClipRow = ClipRow & { comment_count: number; gg: number }

/** A clip with its author, counts and the visitor's GG. `?` is the visitor's id (or null). */
const CLIP_SQL = `
  SELECT c.*, u.display_name, u.handle, ${SHOWN_MAIN_COLUMNS},
    CASE WHEN oa.shown THEN p.game_name END AS game_name,
    CASE WHEN oa.shown THEN p.tag_line END AS tag_line,
    CASE WHEN oa.shown THEN p.profile_icon_id END AS profile_icon_id,
    (SELECT count(*) FROM invade_clip_comment cc WHERE cc.clip_id = c.id)::int AS comment_count,
    (SELECT count(*) FROM invade_gg g
      WHERE g.target_kind = 'clip' AND g.target_id = c.id)::int AS gg,
    EXISTS (SELECT 1 FROM invade_gg g WHERE g.target_kind = 'clip' AND g.target_id = c.id
      AND g.user_id = ?::uuid) AS gg_by_viewer
  FROM invade_clip c
  JOIN invade_user u ON u.id = c.user_id
  ${SHOWN_MAIN_JOIN}
  JOIN riot_player p ON p.puuid = c.puuid
  LEFT JOIN invade_owned_account oa ON oa.puuid = c.puuid AND oa.user_id = c.user_id`

/** Who may see a clip: ready, and not someone else's private one. `?` is the visitor's id. */
const WATCHABLE = `c.status = 'ready' AND (c.visibility <> 'private' OR c.user_id = ?::uuid)`

/**
 * Clips (docs/desktop-sync.md §11): posted from the desktop app by a signed-in person, one per
 * game and account, for a game one of their own League accounts played; the app sends the video
 * and its poster straight to the clip storage on signed addresses, then says they are up. Shown
 * on their page, the match page and the profiles.
 */
class ClipService {
  private names: Record<string, string> = {}
  /** Reads a ready clip's damage recap (tests stand in for Riot). */
  recap = fillRecap

  /** Champion names, for the moment's words; loaded once, refreshed when the game data is. */
  private async championNames() {
    if (!Object.keys(this.names).length) {
      this.names = await riotAssets.names('champion').catch(() => ({}))
    }
    return this.names
  }

  private view(row: ClipViewRow, viewerId: string | null): Clip {
    const id = row.id
    const events = row.events ?? []
    return {
      id,
      url: `${accountOrigin()}/clip/${id}`,
      video: `/clips/${id}.mp4`,
      poster: `/clips/${id}.jpg`,
      matchId: row.match_id,
      platform: row.platform,
      championId: row.champion_id,
      startMs: row.start_ms,
      durationMs: row.duration_ms,
      title: row.title,
      moment: momentOf(events, row.champion_id, (c) => this.names[c] ?? 'a champion'),
      momentAt: keyEvent(events, row.champion_id)?.t ?? null,
      visibility: row.visibility,
      comments: row.comments,
      events,
      recap: row.recap ?? [],
      views: row.views,
      commentCount: row.comment_count,
      gg: row.gg,
      ggByViewer: Boolean(row.gg_by_viewer),
      postedAt: iso(row.ready_at ?? row.created_at),
      author: {
        id: row.user_id,
        name: row.display_name,
        handle: row.handle,
        avatarUrl: avatarOf(row),
        account:
          row.game_name !== null && row.tag_line !== null
            ? {
                gameName: row.game_name,
                tagLine: row.tag_line,
                profileIconId: row.profile_icon_id,
              }
            : null,
      },
      mine: viewerId === row.user_id,
      pinned: Boolean(row.pinned_at),
    }
  }

  private async rows(where: string, bindings: unknown[], viewerId: string | null, tail = '') {
    await this.championNames()
    const result = await db.rawQuery(`${CLIP_SQL} WHERE ${where} ${tail}`, [viewerId, ...bindings])
    return (result.rows as ClipViewRow[]).map((row) => this.view(row, viewerId))
  }

  /* ── Posting from the app ─────────────────────────────────────────── */

  /**
   * A new clip waiting for its files, with the signed addresses the app sends them to. A game
   * that already has a clip from this account answers it (`existing`) unless `replace` is set:
   * the old clip then goes with its files, comments and GGs.
   */
  async create(user: SignedIn, input: ClipInput): Promise<CreateResult> {
    const title = cleanTitle(input?.title)
    if (
      !title ||
      !isInt(input.gameStartedAt, 1_600_000_000_000, Date.now() + 86_400_000) ||
      !isInt(input.championId, 1, 9999) ||
      !isInt(input.clipStartMs, 0, 4 * 3600_000) ||
      !isInt(input.durationMs, 1000, CLIP_LIMITS.seconds * 1000 + 999) ||
      (input.matchId !== undefined && input.matchId !== null && !MATCH_ID.test(input.matchId)) ||
      (input.visibility !== undefined && !VISIBILITIES.includes(input.visibility as never)) ||
      (input.comments !== undefined && !COMMENT_RULES.includes(input.comments as never))
    ) {
      throw new AccountError(
        `A clip needs a title of 1 to ${CLIP_LIMITS.title} characters and lasts ${CLIP_LIMITS.seconds} seconds at most.`,
        422,
        'E_CLIP_INVALID'
      )
    }
    await this.forgetUnfinished()

    const owner = await db.from('invade_user').where('id', user.id).first()
    const owned = await db
      .from('invade_owned_account')
      .where('user_id', user.id)
      .whereNull('removed_at')
      .select('puuid')
    if (!owned.length) {
      throw new AccountError(
        'Add the League account you played on first: sign in to it in League with Invade open.',
        403,
        'E_CLIP_NO_ACCOUNT'
      )
    }
    const game = await this.findGame(
      owned.map((o) => o.puuid as string),
      input.matchId ?? null,
      input.gameStartedAt,
      input.championId
    )
    if (!game) {
      throw new AccountError(
        'This game is not on invade.lol yet. Try again in a few minutes.',
        404,
        'E_CLIP_NO_GAME'
      )
    }

    const players = await this.players(game.matchId)
    const events = cleanEvents(
      input.events,
      { startMs: input.clipStartMs, durationMs: input.durationMs },
      players,
      await this.championNames()
    )
    const id = newId()
    let replaced: string | null = null
    const conflict = await db.transaction(async (trx) => {
      await trx.from('invade_user').where('id', user.id).forUpdate().firstOrFail()
      const before = await trx
        .from('invade_clip')
        .where({ user_id: user.id, match_id: game.matchId })
        .first()
      if (before && before.status === 'ready' && input.replace !== true) return before as ClipRow
      if (before) {
        replaced = before.id as string
        await this.purgeRows(trx, [replaced])
      }
      await trx.table('invade_clip').insert({
        id,
        user_id: user.id,
        puuid: game.puuid,
        match_id: game.matchId,
        platform: game.platform,
        champion_id: game.championId,
        start_ms: input.clipStartMs,
        duration_ms: input.durationMs,
        title,
        visibility: input.visibility ?? owner.clip_visibility,
        comments: input.comments ?? owner.clip_comments,
        events: JSON.stringify(events),
      })
      return null
    })
    if (conflict) return { existing: await this.existing(conflict) }
    if (replaced) await this.deleteFiles([replaced])

    const store = clipStore()
    const [video, poster] = await Promise.all([
      store.uploadUrl(clipKey(id, 'video'), CLIP_FILES.video.type),
      store.uploadUrl(clipKey(id, 'poster'), CLIP_FILES.poster.type),
    ])
    return {
      clip: { id, url: `${accountOrigin()}/clip/${id}`, status: 'uploading' },
      upload: { video, poster },
    }
  }

  private async existing(row: ClipRow): Promise<ExistingClip> {
    const [{ total }] = await db
      .from('invade_clip_comment')
      .where('clip_id', row.id)
      .count('* as total')
    return {
      id: row.id,
      title: row.title,
      url: `${accountOrigin()}/clip/${row.id}`,
      views: row.views,
      comments: Number(total),
      postedAt: iso(row.ready_at ?? row.created_at),
    }
  }

  /** Clips whose files never arrived go, after a while. */
  private async forgetUnfinished() {
    const stale = await db
      .from('invade_clip')
      .where('status', 'uploading')
      .where('created_at', '<', new Date(Date.now() - UPLOAD_MS))
      .select('id')
    await this.purge(stale.map((r) => r.id as string))
  }

  /**
   * The game a clip is of, among the person's League accounts' stored games: the one the app
   * named, else the one starting nearest the game's start (within a quarter of an hour), its
   * champion first.
   */
  async findGame(puuids: string[], matchId: string | null, started: number, championId: number) {
    const result = await clickhouse.query({
      query: `SELECT match_id, puuid, champion_id, game_start_ms, platform
              FROM participants
              PREWHERE puuid IN {puuids:Array(String)}
              WHERE ${matchId ? 'match_id = {matchId:String}' : 'game_start_ms BETWEEN {from:UInt64} AND {to:UInt64}'}
              LIMIT 20`,
      query_params: {
        puuids,
        matchId,
        from: Math.max(0, started - MATCH_WINDOW_MS),
        to: started + MATCH_WINDOW_MS,
      },
      format: 'JSONEachRow',
    })
    const rows = ((await result.json()) ?? []) as {
      match_id: string
      puuid: string
      champion_id: number
      game_start_ms: number | string
      platform: string
    }[]
    if (!rows.length) return null
    const distance = (r: (typeof rows)[number]) => Math.abs(Number(r.game_start_ms) - started)
    const same = (r: (typeof rows)[number]) => Number(Number(r.champion_id) === championId)
    const pick = [...rows].sort((a, b) => same(b) - same(a) || distance(a) - distance(b))[0]
    return {
      matchId: pick.match_id,
      puuid: pick.puuid,
      championId: Number(pick.champion_id),
      platform: pick.platform,
    }
  }

  /** The game's players, to turn the events' Riot IDs into champions. */
  private async players(matchId: string): Promise<GamePlayer[]> {
    const match = await matchRepository.getSummaryById(matchId).catch(() => null)
    return (match?.participants ?? []).map((p: Record<string, unknown>) => ({
      gameName: String(p.gameName ?? ''),
      tagLine: String(p.tagLine ?? ''),
      championId: Number(p.championId),
    }))
  }

  private async own(user: SignedIn, id: unknown) {
    const row =
      typeof id === 'string' && CLIP_ID.test(id)
        ? await db.from('invade_clip').where({ id, user_id: user.id }).first()
        : null
    if (!row) throw AccountError.notFound('This clip does not exist.')
    return row as ClipRow
  }

  /**
   * The app sent both files: they are checked where they are (an H.264 MP4 within the limits, a
   * JPEG or WebP picture) and the clip goes online. A refused video takes its clip with it. Its
   * kills' damage recap is then read in the background.
   */
  async complete(user: SignedIn, id: unknown): Promise<Clip> {
    const clip = await this.own(user, id)
    if (clip.status === 'uploading') {
      const store = clipStore()
      const [video, poster] = await Promise.all([
        store.head(clipKey(clip.id, 'video'), 64 * 1024),
        store.head(clipKey(clip.id, 'poster'), 16),
      ])
      if (!video || !poster) {
        throw new AccountError('Send the video and its picture first.', 409, 'E_CLIP_NOT_UPLOADED')
      }
      const problem = video.size > CLIP_LIMITS.bytes ? 'large' : videoProblem(video.start)
      if (problem) {
        await this.purge([clip.id])
        if (problem === 'large') {
          throw new AccountError('This clip is too large.', 413, 'E_CLIP_TOO_LARGE')
        }
        throw problem === 'hevc'
          ? new AccountError(
              'This clip was recorded in HEVC, which browsers cannot all play. Record in H.264 to post it.',
              422,
              'E_CLIP_HEVC'
            )
          : new AccountError('This is not a recorded clip.', 422, 'E_CLIP_INVALID')
      }
      if (poster.size > CLIP_LIMITS.poster || !isPicture(poster.start)) {
        await this.purge([clip.id])
        throw new AccountError('This picture cannot be used.', 422, 'E_CLIP_INVALID')
      }
      await db
        .from('invade_clip')
        .where('id', clip.id)
        .update({ status: 'ready', bytes: video.size, ready_at: new Date() })
      void this.recap({
        id: clip.id,
        matchId: clip.match_id,
        platform: clip.platform,
        puuid: clip.puuid,
        startMs: clip.start_ms,
        durationMs: clip.duration_ms,
      })
    }
    const [view] = await this.rows('c.id = ?', [clip.id], user.id)
    return view
  }

  /** The person's clips, every visibility, newest first, with their counts (the app's list). */
  async mine(user: SignedIn): Promise<MyClip[]> {
    const result = await db.rawQuery(
      `SELECT c.*,
         (SELECT count(*) FROM invade_clip_comment cc WHERE cc.clip_id = c.id)::int AS comment_count,
         (SELECT count(*) FROM invade_gg g
           WHERE g.target_kind = 'clip' AND g.target_id = c.id)::int AS gg
       FROM invade_clip c WHERE c.user_id = ? ORDER BY c.created_at DESC`,
      [user.id]
    )
    return (result.rows as MyClipRow[]).map((row) => ({
      id: row.id,
      url: `${accountOrigin()}/clip/${row.id}`,
      matchId: row.match_id,
      title: row.title,
      championId: row.champion_id,
      startMs: row.start_ms,
      durationMs: row.duration_ms,
      visibility: row.visibility,
      comments: row.comments,
      status: row.status,
      views: row.views,
      commentCount: row.comment_count,
      gg: row.gg,
      postedAt: iso(row.ready_at ?? row.created_at),
    }))
  }

  /** Deletes a clip with its files, comments and GGs, for its owner. */
  async remove(user: SignedIn, id: unknown) {
    const clip = await this.own(user, id)
    await this.purge([clip.id])
  }

  /** Its owner changes who may watch it or comment on it. */
  async edit(user: SignedIn, id: unknown, input: { visibility?: unknown; comments?: unknown }) {
    const clip = await this.own(user, id)
    const update: Record<string, string> = {}
    if (input.visibility !== undefined) {
      if (!VISIBILITIES.includes(input.visibility as never)) {
        throw new AccountError('Choose who can watch it.', 422, 'E_CLIP_INVALID')
      }
      update.visibility = input.visibility as string
    }
    if (input.comments !== undefined) {
      if (!COMMENT_RULES.includes(input.comments as never)) {
        throw new AccountError('Choose who can comment.', 422, 'E_CLIP_INVALID')
      }
      update.comments = input.comments as string
    }
    if (Object.keys(update).length) await db.from('invade_clip').where('id', clip.id).update(update)
  }

  /** Pins a clip on its owner's profile (the one pinned before is unpinned), or unpins it. */
  async pin(user: SignedIn, id: unknown, on: boolean) {
    const clip = await this.own(user, id)
    await db.transaction(async (trx) => {
      await trx.from('invade_clip').where('user_id', user.id).update({ pinned_at: null })
      if (on) await trx.from('invade_clip').where('id', clip.id).update({ pinned_at: new Date() })
    })
  }

  /** The rows of clips and everything that points at them: their GGs and saved copies. */
  private async purgeRows(trx: TransactionClientContract, ids: string[]) {
    if (!ids.length) return
    const comments = await trx.from('invade_clip_comment').whereIn('clip_id', ids).select('id')
    await trx
      .from('invade_gg')
      .where((q) =>
        q
          .where('target_kind', 'clip')
          .whereIn('target_id', ids)
          .orWhere((c) =>
            c.where('target_kind', 'comment').whereIn(
              'target_id',
              comments.map((r) => r.id as string)
            )
          )
      )
      .delete()
    await savedService.forgetClips(trx, ids)
    await trx.from('invade_clip').whereIn('id', ids).delete()
  }

  /** Rows first (the clip is gone at once), then the files; a file left behind is logged. */
  async purge(ids: string[]) {
    if (!ids.length) return
    await db.transaction((trx) => this.purgeRows(trx, ids))
    await this.deleteFiles(ids)
  }

  private async deleteFiles(ids: string[]) {
    for (const id of ids) {
      for (const kind of ['video', 'poster'] as const) {
        await clipStore()
          .delete(clipKey(id, kind))
          .catch((error) => logger.warn({ err: error, clip: id }, 'clip file not deleted'))
      }
    }
  }

  /** Every clip of a person, for deleting their account. */
  async idsOf(userId: string) {
    const rows = await db.from('invade_clip').where('user_id', userId).select('id')
    return rows.map((r) => r.id as string)
  }

  /* ── Reading ──────────────────────────────────────────────────────── */

  /** A clip the visitor may watch (whoever has the link sees a link-only one), or null. */
  async find(id: unknown, viewerId: string | null): Promise<Clip | null> {
    if (typeof id !== 'string' || !CLIP_ID.test(id)) return null
    const [clip] = await this.rows(`c.id = ? AND ${WATCHABLE}`, [id, viewerId], viewerId)
    return clip ?? null
  }

  /** The clips of a game everyone may see, in game order, and the visitor's own. */
  async ofMatch(matchId: string, viewerId: string | null): Promise<Clip[]> {
    return this.rows(
      `c.match_id = ? AND c.status = 'ready' AND (c.visibility = 'everyone' OR c.user_id = ?::uuid)`,
      [matchId, viewerId],
      viewerId,
      'ORDER BY c.start_ms LIMIT 50'
    )
  }

  /**
   * A League account's public clips, newest first, for its profile: only from people who show
   * their clips on their League profiles.
   */
  async ofPlayer(puuid: string, viewerId: string | null, limit = 12): Promise<Clip[]> {
    return this.rows(
      `c.puuid = ? AND c.status = 'ready' AND c.visibility = 'everyone' AND u.clips_on_profile`,
      [puuid],
      viewerId,
      `ORDER BY c.created_at DESC LIMIT ${Number(limit)}`
    )
  }

  /** A person's clips the visitor may see on their Invade profile: all of them to their owner. */
  async ofUser(userId: string, viewerId: string | null): Promise<Clip[]> {
    const own = viewerId === userId
    return this.rows(
      `c.user_id = ? AND c.status = 'ready' ${own ? '' : `AND c.visibility = 'everyone'`}`,
      [userId],
      viewerId,
      'ORDER BY c.created_at DESC LIMIT 100'
    )
  }

  async viewed(id: string) {
    await db.from('invade_clip').where('id', id).increment('views', 1)
  }
}

export default new ClipService()
