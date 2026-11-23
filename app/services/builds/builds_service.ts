import { createHash, randomBytes } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import logger from '@adonisjs/core/services/logger'
import riotAssets from '#services/riot/assets'
import { AccountError } from '#services/accounts/errors'
import { accountOrigin } from '#services/accounts/session_service'
import moderation from '#services/moderation/moderation'
import { cleanName, parseBuildLink, routeOf, type BuildLane } from '#services/build_link'
import { resolveBuild, type SharedBuild } from '#services/build_share'
import { SHOWN_MAIN_COLUMNS, SHOWN_MAIN_JOIN, UUID, avatarOf, iso } from '#services/social/cards'
import type { ProfileBuild, ProfileBuildLane } from '../../../inertia/lib/profile_types.js'

/** Builds an account keeps from the app at most, and builds saved from others. */
export const BUILD_LIMITS = { own: 200, saved: 200 }
const ID = /^[A-Za-z0-9]{10}$/
const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
/** A visitor opening a build again within this time is counted once. */
const OPEN_WINDOW_SECONDS = 86_400

const newId = () => Array.from(randomBytes(10), (b) => BASE62[b % BASE62.length]).join('')

const LANE_OF: Record<ProfileBuildLane, BuildLane> = {
  top: 'TOP',
  jungle: 'JUNGLE',
  mid: 'MID',
  bottom: 'ADC',
  support: 'SUPPORT',
}
const isLane = (value: unknown): value is ProfileBuildLane =>
  typeof value === 'string' && Object.hasOwn(LANE_OF, value)

export const buildUrl = (id: string) => `${accountOrigin()}/build/${id}`

/** A build as the app sends it (§14). */
interface BuildInput {
  localId: string
  championId: number
  lane: ProfileBuildLane
  name: string
  code: string
  updatedAt: Date
  shared: boolean
}

/** What the app gets back for each of its builds. */
export interface SyncedBuild {
  localId: string
  id: string
  url: string
  opens: number
  imports: number
}

/** A build of the account as the app lists it: its own, or saved from someone else's page. */
export interface AccountBuild extends SyncedBuild {
  localId: string
  championId: number
  lane: ProfileBuildLane
  name: string
  code: string
  updatedAt: string
  shared: boolean
  savedFrom: { name: string; handle: string } | null
}

/** A build's page: the build, who made it, its counts, and the visitor's own relation to it. */
export interface BuildPage {
  id: string
  build: SharedBuild
  author: { name: string; handle: string; avatarUrl: string | null }
  opens: number
  imports: number
  shared: boolean
  mine: boolean
  saved: boolean
}

type Row = Record<string, unknown>

/** How many people saved each build, beside it. */
const IMPORTS = `(SELECT count(*) FROM invade_build_saved s WHERE s.build_id = b.id)::int AS imports`

/**
 * Builds on Invade accounts (docs/desktop-sync.md §14): the app sends its whole set of builds,
 * each with the items and max order a version 2 build link writes; a shared one gets a page of its
 * own, where others open it in the app or save it to their account.
 */
class BuildsService {
  private async championKeyOf(championId: number) {
    const keys = await riotAssets.championKeys()
    return Object.entries(keys).find(([, id]) => Number(id) === championId)?.[0] ?? null
  }

  /** A build's link checked against the live game data: null for anything unknown. */
  private async resolve(row: {
    champion_id: number
    lane: string
    name: string
    code: string
  }): Promise<SharedBuild | null> {
    const key = await this.championKeyOf(row.champion_id)
    if (!key || !isLane(row.lane)) return null
    return resolveBuild(parseBuildLink('2', key, row.lane, row.code, row.name)).catch(() => null)
  }

  /** Checks the app's builds: their shape, then each one against the live game data. */
  private async check(input: unknown): Promise<BuildInput[]> {
    const list = (input as { builds?: unknown } | null)?.builds
    if (!Array.isArray(list) || list.length > BUILD_LIMITS.own) {
      throw AccountError.invalid(`Send up to ${BUILD_LIMITS.own} builds.`)
    }
    const seen = new Set<string>()
    const builds: BuildInput[] = []
    for (const raw of list as Row[]) {
      const updatedAt = new Date(String(raw?.updatedAt))
      if (
        typeof raw?.localId !== 'string' ||
        !UUID.test(raw.localId) ||
        seen.has(raw.localId.toLowerCase()) ||
        !Number.isInteger(raw.championId) ||
        !isLane(raw.lane) ||
        typeof raw.code !== 'string' ||
        typeof raw.shared !== 'boolean' ||
        Number.isNaN(updatedAt.getTime())
      ) {
        throw AccountError.invalid('A build is not one the app makes.')
      }
      const build: BuildInput = {
        localId: raw.localId.toLowerCase(),
        championId: raw.championId as number,
        lane: raw.lane,
        name: cleanName(raw.name),
        code: raw.code,
        updatedAt,
        shared: raw.shared,
      }
      const resolved = await this.resolve({
        champion_id: build.championId,
        lane: build.lane,
        name: build.name,
        code: build.code,
      })
      if (!resolved) throw AccountError.invalid(`The build "${build.name}" names unknown items.`)
      seen.add(build.localId)
      builds.push(build)
    }
    return builds
  }

  /**
   * Replaces the account's builds with the app's set (§14): new ones are added, known ones (by the
   * app's own id) updated, the others removed. Each keeps its page and its counts.
   */
  async sync(userId: string, input: unknown): Promise<SyncedBuild[]> {
    const builds = await this.check(input)
    await db.transaction(async (trx) => {
      await trx.from('invade_user').where('id', userId).forUpdate().firstOrFail()
      const kept = builds.map((b) => b.localId)
      const gone = trx.from('invade_build').where('user_id', userId)
      await (kept.length ? gone.whereNotIn('local_id', kept) : gone).delete()
      for (const build of builds) {
        await trx
          .knexQuery()
          .table('invade_build')
          .insert({
            id: newId(),
            user_id: userId,
            local_id: build.localId,
            champion_id: build.championId,
            lane: build.lane,
            name: build.name,
            code: build.code,
            shared: build.shared,
            updated_at: build.updatedAt,
          })
          .onConflict(['user_id', 'local_id'])
          .merge(['champion_id', 'lane', 'name', 'code', 'shared', 'updated_at'])
      }
    })
    const rows = await db.rawQuery(
      `SELECT b.id, b.local_id, b.opens, ${IMPORTS}
       FROM invade_build b WHERE b.user_id = ? ORDER BY b.updated_at DESC`,
      [userId]
    )
    return rows.rows.map((r: Row) => ({
      localId: String(r.local_id),
      id: String(r.id),
      url: buildUrl(String(r.id)),
      opens: Number(r.opens),
      imports: Number(r.imports),
    }))
  }

  /** The account's builds for the app: its own, then those saved from others (§14). */
  async ofAccount(userId: string): Promise<AccountBuild[]> {
    const visible = await moderation.visibility()
    const rows = await db.rawQuery(
      `SELECT b.*, ${IMPORTS}, NULL AS saved_at, NULL AS author_name, NULL AS author_handle
       FROM invade_build b WHERE b.user_id = ?
       UNION ALL
       SELECT b.*, ${IMPORTS}, s.created_at AS saved_at,
         u.display_name AS author_name, u.handle AS author_handle
       FROM invade_build_saved s
       JOIN invade_build b ON b.id = s.build_id AND b.shared
       JOIN invade_user u ON u.id = b.user_id
       WHERE s.user_id = ? AND ${visible.person('u.id')}
       ORDER BY saved_at DESC NULLS FIRST, updated_at DESC`,
      [userId, userId]
    )
    return rows.rows.map((r: Row) => ({
      localId: String(r.local_id),
      id: String(r.id),
      url: buildUrl(String(r.id)),
      opens: Number(r.opens),
      imports: Number(r.imports),
      championId: Number(r.champion_id),
      lane: r.lane as ProfileBuildLane,
      name: String(r.name),
      code: String(r.code),
      updatedAt: iso(r.updated_at),
      shared: Boolean(r.shared),
      savedFrom: r.saved_at
        ? { name: String(r.author_name), handle: String(r.author_handle) }
        : null,
    }))
  }

  /**
   * A build's page, for a visitor: a build that is not shared is only its owner's, and none of a
   * suspended account's shows.
   */
  async page(id: unknown, viewerId: string | null): Promise<BuildPage | null> {
    if (typeof id !== 'string' || !ID.test(id)) return null
    const visible = await moderation.visibility()
    const found = await db.rawQuery(
      `SELECT b.*, ${IMPORTS}, u.display_name, u.handle, ${SHOWN_MAIN_COLUMNS},
         EXISTS (SELECT 1 FROM invade_build_saved s
           WHERE s.build_id = b.id AND s.user_id = ?::uuid) AS saved
       FROM invade_build b
       JOIN invade_user u ON u.id = b.user_id
       ${SHOWN_MAIN_JOIN}
       WHERE b.id = ? AND ${visible.person('u.id')}`,
      [viewerId, id]
    )
    const row = found.rows[0]
    const mine = Boolean(row && viewerId === row.user_id)
    if (!row || (!row.shared && !mine)) return null
    const build = await this.resolve(row)
    if (!build) return null
    return {
      id,
      build,
      author: { name: row.display_name, handle: row.handle, avatarUrl: avatarOf(row) },
      opens: Number(row.opens),
      imports: Number(row.imports),
      shared: Boolean(row.shared),
      mine,
      saved: Boolean(row.saved),
    }
  }

  /**
   * Counts an opening of a shared build's page: once a day per visitor (a hash of their address,
   * never the address itself), never its owner's own visits.
   */
  async opened(page: BuildPage, visitor: string) {
    if (page.mine || !page.shared) return
    const key = `build:open:${page.id}:${createHash('sha256').update(visitor).digest('base64url').slice(0, 16)}`
    try {
      const first = await redis.set(key, '1', 'EX', OPEN_WINDOW_SECONDS, 'NX')
      if (first) await db.from('invade_build').where('id', page.id).increment('opens', 1)
    } catch (error) {
      logger.warn({ err: error }, 'build opening not counted')
    }
  }

  /** Saves someone else's shared build to the account; saving it again is already done. */
  async save(userId: string, id: unknown) {
    if (typeof id !== 'string' || !ID.test(id)) throw AccountError.notFound('This build is gone.')
    await db.transaction(async (trx) => {
      await trx.from('invade_user').where('id', userId).forUpdate().firstOrFail()
      const build = await trx.from('invade_build').where({ id, shared: true }).first()
      if (!build) throw AccountError.notFound('This build is gone.')
      if (build.user_id === userId) throw AccountError.invalid('This build is already yours.')
      const [{ total }] = await trx
        .from('invade_build_saved')
        .where('user_id', userId)
        .count('* as total')
      if (Number(total) >= BUILD_LIMITS.saved) {
        throw AccountError.limit(`You can save up to ${BUILD_LIMITS.saved} builds.`)
      }
      await trx
        .knexQuery()
        .table('invade_build_saved')
        .insert({ user_id: userId, build_id: id })
        .onConflict(['user_id', 'build_id'])
        .ignore()
    })
  }

  /** Lets a saved build go; one that is not saved is already gone. */
  async unsave(userId: string, id: unknown) {
    if (typeof id !== 'string' || !ID.test(id)) return
    await db.from('invade_build_saved').where({ user_id: userId, build_id: id }).delete()
  }

  /**
   * The builds an Invade profile shows: the person's shared builds (all of them to the person),
   * then those they saved from others.
   */
  async ofProfile(profileUserId: string, viewerId: string | null): Promise<ProfileBuild[]> {
    const all = await this.ofAccount(profileUserId)
    const shown = all.filter((b) => b.savedFrom || b.shared || viewerId === profileUserId)
    const resolved = await Promise.all(
      shown.map((b) =>
        this.resolve({ champion_id: b.championId, lane: b.lane, name: b.name, code: b.code })
      )
    )
    return shown.flatMap((b, i) => {
      const build = resolved[i]
      if (!build) return []
      const route = routeOf(build.items)
      return [
        {
          id: b.id,
          url: `/build/${b.id}`,
          name: b.name,
          championId: b.championId,
          lane: b.lane,
          items: {
            start: route.start,
            boots: route.boots,
            core: route.core,
            later: route.later.flatMap((slot) => slot.slice(0, 1)),
          },
          skillOrder: build.items.max,
          shared: b.shared,
          opens: b.opens,
          imports: b.imports,
          updatedAt: b.updatedAt,
          savedFrom: b.savedFrom,
        },
      ]
    })
  }
}

export default new BuildsService()
