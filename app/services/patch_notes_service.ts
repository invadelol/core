import { readdir, readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import championStatsService, { DEFAULT_BRACKET } from '#services/champion_stats_service'
import type { Position } from '#services/champion_stats'
import type { PatchChampionStat, PatchDaily, PatchNotes } from '../../inertia/lib/patch_notes.js'
import type { NavPatchNotes } from '../../inertia/lib/home.js'

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

  /** Every patch with notes, newest first, as the header's Patch menu lists them. */
  async summaries(): Promise<NavPatchNotes[]> {
    const patches = await this.list()
    const notes = await Promise.all(patches.map((p) => this.get(p)))
    return notes.flatMap((n, i) =>
      n
        ? [
            {
              patch: patches[i],
              published: n.published,
              champions: n.champions.length,
              items: n.items.length,
            },
          ]
        : []
    )
  }

  /**
   * Win rate, pick rate, games, tier and place in the role of each champion on the patch (game
   * version `version`), in the role it was played most, at the default rank, with its tier and
   * place on the patch before. Null when the statistics do not offer the patch.
   */
  async stats(
    version: string,
    champions: number[]
  ): Promise<{
    bracket: string
    games: number
    /** The patch before, as the statistics name it (`16.21`), when they offer it. */
    previous: string | null
    byChampion: Record<number, PatchChampionStat>
  } | null> {
    try {
      const filter = await championStatsService.filter({ rank: DEFAULT_BRACKET, patch: version })
      if (!filter || filter.patch !== version) return null
      const [summary, before] = await Promise.all([
        championStatsService.summary(filter),
        championStatsService.previous(filter).catch(() => null),
      ])
      if (!summary.games) return null
      const wanted = new Set(champions)
      const was = new Map<string, { tier: number | null; rank: number | null }>()
      for (const r of before?.roles ?? [])
        if (wanted.has(r.champion)) was.set(`${r.champion}:${r.position}`, r)
      const byChampion: Record<number, PatchChampionStat> = {}
      for (const r of summary.roles) {
        if (!wanted.has(r.champion)) continue
        const known = byChampion[r.champion]
        if (!known || r.games > known.games) {
          const prev = was.get(`${r.champion}:${r.position}`)
          byChampion[r.champion] = {
            position: r.position,
            win: r.win,
            pick: r.pick,
            games: r.games,
            tier: r.tier,
            rank: r.rank,
            prevTier: prev?.tier ?? null,
            prevRank: prev?.rank ?? null,
          }
        }
      }
      return {
        bracket: filter.bracket,
        games: summary.games,
        previous: before?.patch ?? null,
        byChampion,
      }
    } catch (error) {
      logger.warn({ err: error, version }, 'patch notes: statistics unavailable')
      return null
    }
  }

  /**
   * Each changed champion's win rate by day over the last two weeks, in its main role, from the
   * tier list's trend lines when their cache holds them (a cold role is filled in the background,
   * never while a visitor waits). Null when no role is ready.
   */
  async daily(byChampion: Record<number, PatchChampionStat>): Promise<PatchDaily | null> {
    try {
      const filter = await championStatsService.filter({ rank: DEFAULT_BRACKET })
      if (!filter) return null
      const positions = [...new Set(Object.values(byChampion).map((s) => s.position))]
      const trends = await Promise.all(
        positions.map((p) =>
          championStatsService.roleTrendIfReady(filter, p as Position).catch(() => null)
        )
      )
      let days: string[] | null = null
      const lines: PatchDaily['lines'] = {}
      for (const [id, s] of Object.entries(byChampion)) {
        const t = trends[positions.indexOf(s.position)]
        const line = t?.lines[Number(id)]
        if (!t || !line) continue
        days ??= t.days
        lines[Number(id)] = line
      }
      return days ? { days, lines } : null
    } catch (error) {
      logger.warn({ err: error }, 'patch notes: daily lines unavailable')
      return null
    }
  }

  /**
   * Each champion's main role on the newest patch the statistics offer, to lay out a patch whose
   * own statistics are not there (too few games yet, or long gone).
   */
  async mainRoles(champions: number[]): Promise<Record<number, string>> {
    try {
      const filter = await championStatsService.filter({ rank: DEFAULT_BRACKET })
      if (!filter) return {}
      const summary = await championStatsService.summary(filter)
      const wanted = new Set(champions)
      const best: Record<number, { position: string; games: number }> = {}
      for (const r of summary.roles) {
        if (!wanted.has(r.champion)) continue
        if (!best[r.champion] || r.games > best[r.champion].games) best[r.champion] = r
      }
      return Object.fromEntries(Object.entries(best).map(([id, r]) => [id, r.position]))
    } catch (error) {
      logger.warn({ err: error }, 'patch notes: main roles unavailable')
      return {}
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
