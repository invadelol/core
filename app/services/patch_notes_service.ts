import { readdir, readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import championStatsService, { DEFAULT_BRACKET } from '#services/champion_stats_service'
import type { PatchChampionStat, PatchNotes } from '../../inertia/lib/patch_notes.js'

/** A patch as players name it: "26.22". */
export const PATCH_NAME = /^\d{2}\.\d{1,2}$/

const DIR = () => app.makePath('resources/patch_notes')

/** Newest first: "26.22" before "26.9". */
const newestFirst = (a: string, b: string) => {
  const [am, an] = a.split('.').map(Number)
  const [bm, bn] = b.split('.').map(Number)
  return bm - am || bn - an
}

/**
 * The patch notes the repository holds (`resources/patch_notes/<patch>.json`, Riot's facts for
 * each patch), and how each changed champion did on that patch in its main role, from the site's
 * own games at the default rank (Emerald+). Files are read once per process; the statistics come
 * from the champion statistics' own caches.
 */
class PatchNotesService {
  #list: Promise<string[]> | null = null
  #notes = new Map<string, Promise<PatchNotes | null>>()

  /** The patches with notes, newest first. */
  list(): Promise<string[]> {
    this.#list ??= readdir(DIR())
      .then((files) =>
        files
          .filter((f) => f.endsWith('.json'))
          .map((f) => f.slice(0, -5))
          .filter((p) => PATCH_NAME.test(p))
          .sort(newestFirst)
      )
      .catch((error) => {
        logger.warn({ err: error }, 'patch notes unreadable')
        this.#list = null
        return []
      })
    return this.#list
  }

  /** One patch's notes, or null when the repository has none for it. */
  async get(patch: string): Promise<PatchNotes | null> {
    if (!PATCH_NAME.test(patch)) return null
    const listed = await this.list()
    if (!listed.includes(patch)) return null
    let found = this.#notes.get(patch)
    if (!found) {
      found = readFile(app.makePath('resources/patch_notes', `${patch}.json`), 'utf8')
        .then((raw) => JSON.parse(raw) as PatchNotes)
        .catch((error) => {
          logger.warn({ err: error, patch }, 'patch notes unreadable')
          this.#notes.delete(patch)
          return null
        })
      this.#notes.set(patch, found)
    }
    return found
  }

  /**
   * Win rate, pick rate and games of each champion on the patch (game version `version`), in the
   * role it was played most, at the default rank. Null when the statistics do not offer the patch.
   */
  async stats(
    version: string,
    champions: number[]
  ): Promise<{
    bracket: string
    games: number
    byChampion: Record<number, PatchChampionStat>
  } | null> {
    try {
      const filter = await championStatsService.filter({ rank: DEFAULT_BRACKET, patch: version })
      if (!filter || filter.patch !== version) return null
      const summary = await championStatsService.summary(filter)
      if (!summary.games) return null
      const wanted = new Set(champions)
      const byChampion: Record<number, PatchChampionStat> = {}
      for (const r of summary.roles) {
        if (!wanted.has(r.champion)) continue
        const known = byChampion[r.champion]
        if (!known || r.games > known.games) {
          byChampion[r.champion] = {
            position: r.position,
            win: r.win,
            pick: r.pick,
            games: r.games,
          }
        }
      }
      return { bracket: filter.bracket, games: summary.games, byChampion }
    } catch (error) {
      logger.warn({ err: error, version }, 'patch notes: statistics unavailable')
      return null
    }
  }

  /** Champion ids to their page's slug. */
  async slugs(): Promise<Record<number, string>> {
    const list = await championStatsService.champions().catch(() => [])
    return Object.fromEntries(list.map((c) => [c.id, c.slug]))
  }
}

const patchNotesService = new PatchNotesService()
export default patchNotesService
