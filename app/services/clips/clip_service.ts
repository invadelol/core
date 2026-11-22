import { randomBytes } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import clickhouse from 'adonisjs-clickhouse/services/main'
import env from '#start/env'
import riotAssetsService from '#services/riot/assets'
import { AccountError } from '#services/accounts/errors'
import { accountOrigin, type SignedIn } from '#services/accounts/session_service'
import { clipStore } from '#services/clips/storage'
import type { Clip, ClipEvent, ClipVisibility } from '../../../inertia/lib/clip_types.js'

/** Limits of one clip and of one account (docs/desktop-sync.md §11). */
export const CLIP_LIMITS = {
  bytes: (env.get('CLIPS_MAX_MB') ?? 40) * 1024 * 1024,
  poster: 512 * 1024,
  seconds: 60,
  perAccount: env.get('CLIPS_PER_ACCOUNT') ?? 20,
  title: 80,
}

const EVENTS: ClipEvent[] = ['kill', 'death', 'assist', 'objective', 'manual']
const ID = /^[A-Za-z0-9]{10}$/
const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
/** How far a game's start may be from the recording's: the loading screen, a slow client. */
const MATCH_WINDOW_MS = 15 * 60_000
/** A clip whose video never came is forgotten after this. */
const PENDING_MS = 60 * 60_000

const newId = () => Array.from(randomBytes(10), (b) => BASE62[b % BASE62.length]).join('')

export const videoKey = (id: string) => `clips/${id}/video.mp4`
export const posterKey = (id: string) => `clips/${id}/poster.jpg`

export interface ClipInput {
  /** When the game's recording started, epoch ms: the game is found from it. */
  started: number
  /** Where the clip starts in the game, seconds. */
  gameTime: number
  durationMs: number
  title: string
  event: string
  visibility: string
  /** The recording's champion as Data Dragon names it (`MonkeyKing`), to tell two games apart. */
  championKey?: string | null
  bytes: number
  width?: number | null
  height?: number | null
}

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

/** A JPEG, PNG or WebP picture. */
export function isPicture(bytes: Buffer) {
  if (bytes.length < 12) return false
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return true
  if (bytes.toString('latin1', 1, 4) === 'PNG') return true
  return bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP'
}

interface Row {
  id: string
  user_id: string
  puuid: string
  match_id: string
  platform: string
  champion_id: number
  game_time: number
  duration_ms: number
  title: string
  event: string
  visibility: string
  status: string
  bytes: number
  width: number | null
  height: number | null
  has_poster: boolean
  views: number
  created_at: Date
  game_name?: string
  tag_line?: string
  profile_icon_id?: number | null
}

function view(row: Row, viewer: SignedIn | null): Clip {
  return {
    id: row.id,
    url: `${accountOrigin()}/clip/${row.id}`,
    video: `/clips/${row.id}.mp4`,
    poster: row.has_poster ? `/clips/${row.id}.jpg` : null,
    matchId: row.match_id,
    platform: row.platform,
    championId: row.champion_id,
    gameTime: row.game_time,
    durationMs: row.duration_ms,
    title: row.title,
    event: row.event as ClipEvent,
    visibility: row.visibility as ClipVisibility,
    width: row.width,
    height: row.height,
    views: row.views,
    bytes: row.bytes,
    createdAt: new Date(row.created_at).toISOString(),
    player: {
      puuid: row.puuid,
      gameName: row.game_name ?? '',
      tagLine: row.tag_line ?? '',
      profileIconId: row.profile_icon_id ?? null,
    },
    mine: Boolean(viewer && viewer.id === row.user_id),
  }
}

const SELECT = `c.*, p.game_name, p.tag_line, p.profile_icon_id`
const FROM = `invade_clip c JOIN riot_player p ON p.puuid = c.puuid`

/**
 * Clips (docs/desktop-sync.md §11): posted from the desktop app by a signed-in person, for a game
 * one of their own League accounts played, then shown on their page, the match page and the
 * player's profile. Everything else about a clip (the video, its poster) is in the clip storage.
 */
class ClipService {
  /** A new clip waiting for its video: the game is found among the person's own games. */
  async create(user: SignedIn, input: ClipInput) {
    const title = cleanTitle(input?.title)
    if (
      !title ||
      !isInt(input.started, 1_600_000_000_000, Date.now() + 86_400_000) ||
      !isInt(input.gameTime, 0, 4 * 3600) ||
      !isInt(input.durationMs, 1000, CLIP_LIMITS.seconds * 1000 + 999) ||
      !EVENTS.includes(input.event as ClipEvent) ||
      !['everyone', 'link'].includes(input.visibility)
    ) {
      throw new AccountError(
        `A clip needs a title of 1 to ${CLIP_LIMITS.title} characters and lasts ${CLIP_LIMITS.seconds} seconds at most.`,
        422,
        'E_CLIP_INVALID'
      )
    }
    if (!isInt(input.bytes, 1, CLIP_LIMITS.bytes)) {
      throw new AccountError(
        `A clip is ${Math.round(CLIP_LIMITS.bytes / 1024 / 1024)} MB at most.`,
        413,
        'E_CLIP_TOO_LARGE'
      )
    }

    await db
      .from('invade_clip')
      .where('status', 'pending')
      .where('created_at', '<', new Date(Date.now() - PENDING_MS))
      .delete()
    const [{ total }] = await db.from('invade_clip').where('user_id', user.id).count('* as total')
    if (Number(total) >= CLIP_LIMITS.perAccount) {
      throw new AccountError(
        `You can keep ${CLIP_LIMITS.perAccount} clips online. Delete one to post another.`,
        422,
        'E_CLIP_QUOTA'
      )
    }

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
      owned.map((o) => o.puuid),
      input.started,
      input.championKey ?? null
    )
    if (!game) {
      throw new AccountError(
        'This game is not on invade.lol yet. Try again in a few minutes.',
        404,
        'E_CLIP_NO_GAME'
      )
    }

    const id = newId()
    await db.table('invade_clip').insert({
      id,
      user_id: user.id,
      puuid: game.puuid,
      match_id: game.matchId,
      platform: game.platform,
      champion_id: game.championId,
      game_time: input.gameTime,
      duration_ms: input.durationMs,
      title,
      event: input.event,
      visibility: input.visibility,
      width: isInt(input.width, 1, 8192) ? input.width : null,
      height: isInt(input.height, 1, 8192) ? input.height : null,
    })
    return { id, url: `${accountOrigin()}/clip/${id}`, matchId: game.matchId }
  }

  /**
   * The game a recording is of: one of these accounts' stored games starting within a quarter
   * of an hour of the recording, the nearest one, its champion first when it is known.
   */
  async findGame(puuids: string[], started: number, championKey: string | null) {
    const result = await clickhouse.query({
      query: `SELECT match_id, puuid, champion_id, game_start_ms, platform
              FROM participants
              PREWHERE puuid IN {puuids:Array(String)}
              WHERE game_start_ms BETWEEN {from:UInt64} AND {to:UInt64}
              LIMIT 20`,
      query_params: {
        puuids,
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
    let championId: number | null = null
    if (championKey) {
      const keys = await riotAssetsService
        .championKeys()
        .catch(() => ({}) as Record<string, string>)
      const id = Number(keys[championKey.toLowerCase()])
      championId = Number.isInteger(id) && id > 0 ? id : null
    }
    const distance = (r: (typeof rows)[number]) => Math.abs(Number(r.game_start_ms) - started)
    const pick = [...rows].sort(
      (a, b) =>
        Number(championId !== null && Number(b.champion_id) === championId) -
          Number(championId !== null && Number(a.champion_id) === championId) ||
        distance(a) - distance(b)
    )[0]
    return {
      matchId: pick.match_id,
      puuid: pick.puuid,
      championId: Number(pick.champion_id),
      platform: pick.platform,
    }
  }

  private async own(user: SignedIn, id: unknown) {
    if (typeof id !== 'string' || !ID.test(id))
      throw AccountError.notFound('This clip does not exist.')
    const row = await db.from('invade_clip').where({ id, user_id: user.id }).first()
    if (!row) throw AccountError.notFound('This clip does not exist.')
    return row as Row
  }

  /** The clip's video: an H.264 MP4 within the limits; the clip is then on its page. */
  async putVideo(user: SignedIn, id: unknown, bytes: Buffer) {
    const clip = await this.own(user, id)
    const problem = bytes.length > CLIP_LIMITS.bytes ? 'large' : videoProblem(bytes)
    // A refused video takes its clip with it: it never counts against the person's clips.
    if (problem && clip.status === 'pending') await this.purge([clip.id])
    if (problem === 'large') {
      throw new AccountError('This clip is too large.', 413, 'E_CLIP_TOO_LARGE')
    }
    if (problem === 'hevc') {
      throw new AccountError(
        'This clip was recorded in HEVC, which browsers cannot all play. Record in H.264 to post it.',
        422,
        'E_CLIP_HEVC'
      )
    }
    if (problem) throw new AccountError('This is not a recorded clip.', 422, 'E_CLIP_INVALID')
    await clipStore().put(videoKey(clip.id), bytes, 'video/mp4')
    await db
      .from('invade_clip')
      .where('id', clip.id)
      .update({ status: 'ready', bytes: bytes.length, ready_at: new Date() })
    return this.find(clip.id, user)
  }

  /** Its picture, for the page before it plays and for link previews. */
  async putPoster(user: SignedIn, id: unknown, bytes: Buffer) {
    const clip = await this.own(user, id)
    if (bytes.length > CLIP_LIMITS.poster || !isPicture(bytes)) {
      throw new AccountError('This picture cannot be used.', 422, 'E_CLIP_INVALID')
    }
    await clipStore().put(posterKey(clip.id), bytes, 'image/jpeg')
    await db.from('invade_clip').where('id', clip.id).update({ has_poster: true })
    return this.find(clip.id, user)
  }

  /** Deletes the clip and its files, for its owner. */
  async remove(user: SignedIn, id: unknown) {
    const clip = await this.own(user, id)
    await this.purge([clip.id])
  }

  /** Files first, then rows: a failed file deletion leaves the row to try again. */
  async purge(ids: string[]) {
    for (const id of ids) {
      for (const key of [videoKey(id), posterKey(id)]) {
        await clipStore()
          .delete(key)
          .catch((error) => logger.warn({ err: error, clip: id }, 'clip file not deleted'))
      }
    }
    if (ids.length) await db.from('invade_clip').whereIn('id', ids).delete()
  }

  /** Every clip of a person, for deleting their account. */
  async idsOf(userId: string) {
    const rows = await db.from('invade_clip').where('user_id', userId).select('id')
    return rows.map((r) => r.id as string)
  }

  /** A posted clip (any visibility: whoever has the link sees it). */
  async find(id: unknown, viewer: SignedIn | null): Promise<Clip | null> {
    if (typeof id !== 'string' || !ID.test(id)) return null
    const result = await db.rawQuery(
      `SELECT ${SELECT} FROM ${FROM} WHERE c.id = ? AND c.status = 'ready'`,
      [id]
    )
    return result.rows[0] ? view(result.rows[0], viewer) : null
  }

  /** The public clips of a game, in game order. */
  async ofMatch(matchId: string, viewer: SignedIn | null): Promise<Clip[]> {
    const result = await db.rawQuery(
      `SELECT ${SELECT} FROM ${FROM}
       WHERE c.match_id = ? AND c.status = 'ready' AND c.visibility = 'everyone'
       ORDER BY c.game_time LIMIT 50`,
      [matchId]
    )
    return result.rows.map((r: Row) => view(r, viewer))
  }

  /** A player's public clips, newest first. */
  async ofPlayer(puuid: string, viewer: SignedIn | null, limit = 12): Promise<Clip[]> {
    const result = await db.rawQuery(
      `SELECT ${SELECT} FROM ${FROM}
       WHERE c.puuid = ? AND c.status = 'ready' AND c.visibility = 'everyone'
       ORDER BY c.created_at DESC LIMIT ?`,
      [puuid, limit]
    )
    return result.rows.map((r: Row) => view(r, viewer))
  }

  /** The person's own clips, every visibility, newest first (the app's posted state). */
  async ofUser(user: SignedIn): Promise<Clip[]> {
    const result = await db.rawQuery(
      `SELECT ${SELECT} FROM ${FROM} WHERE c.user_id = ? AND c.status = 'ready'
       ORDER BY c.created_at DESC`,
      [user.id]
    )
    return result.rows.map((r: Row) => view(r, user))
  }

  async viewed(id: string) {
    await db.from('invade_clip').where('id', id).increment('views', 1)
  }
}

export default new ClipService()
