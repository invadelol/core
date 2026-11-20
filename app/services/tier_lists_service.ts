import type { ClickHouseSettings } from '@clickhouse/client'
import riotAssetsService from '#services/riot/assets'
import buildStatsService from '#services/build_stats_service'
import championStatsService from '#services/champion_stats_service'
import { AnswerCache } from '#services/ranked_stats'
import { patchStart, rows, statsCache } from '#services/ranked_games_service'
import type { StatsCache } from '#services/stats_cache'
import statsQueue from '#services/stats_queue'
import { POSITIONS, type Filter, type Position } from '#services/champion_stats'
import { bracketTiers, championClasses, type ChampionClass } from '#services/tier_lists'
import {
  itemBlob,
  itemRowsSql,
  itemText,
  itemView,
  recipesOf,
  roleItemCounts,
  type ItemBlob,
  type ItemCounts,
  type ItemRow,
  type ItemText,
  type ItemView,
  type RecipeNode,
} from '#services/item_tier_list'
import {
  keystoneTrees,
  mergeRuneCounts,
  roleRuneCounts,
  runeBlob,
  runeRowsSql,
  runeView,
  type RuneBlob,
  type RuneRow,
  type RuneView,
} from '#services/rune_tier_list'
import {
  duoBlob,
  duoCounts,
  duoRowsSql,
  duoView,
  type DuoBlob,
  type DuoLane,
  type DuoRow,
  type DuoView,
} from '#services/duo_tier_list'
import {
  ARAM_MODES,
  aramCounts,
  aramRowsSql,
  aramView,
  type AramCounts,
  type AramMode,
  type AramRow,
  type AramView,
} from '#services/aram_tier_list'
import { patchValue, previousRange } from '../../inertia/lib/patches.js'
import { SHOW_RUNES } from '../../inertia/lib/features.js'

/**
 * The tier lists of items, runes, duos and ARAM (`/tier-list/items`, `/runes`, `/duos`,
 * `/aram`), from our own crawled games.
 *
 * Each list reads one patch at a time (a role at a time for items and runes), with a row per
 * seed tier: any rank bracket is a sum of tiers and a range of patches a sum of patches, so one
 * read serves every filter of a region. These "blobs" are kept in the stats cache (this process
 * and Redis, a day fresh, two days at most). No pre-counted cells exist for them (migration
 * 0013 counts champion records and lane pairs only), and a blob is a read of a whole patch (tens
 * of seconds in production): a page never computes one while a visitor waits. It peeks at the
 * cache and, when a blob is missing or stale, queues it in the background (`stats_queue.ts`, one
 * read at a time): a missing one shows the page's "being computed" state, which fills once it is
 * there. The warmer queues the common filters (`warmTierLists`).
 */

/** A read stays bounded on a busy server. */
const LIMITS: ClickHouseSettings = {
  max_execution_time: 300,
  max_threads: 2,
}

/** A champion as the pages link it. */
export interface ChampionRef {
  id: number
  name: string
  slug: string
  /** Its main class (Community Dragon), when it has one. */
  class: ChampionClass | null
}

/** A list whose counts are still being computed in the background. */
export interface Computing {
  computing: true
  /** Reads queued before this list's (0: it is being read), null when the queue is full. */
  ahead: number | null
}

const num = (v: unknown) => Number(v)

export interface ItemTierList extends ItemView {
  computing?: false
  patch: string
  previousPatch: string | null
  position: Position | null
  class: ChampionClass | null
  /** What each listed item gives: name, price, recipe, stats and effects (Data Dragon, the patch's). */
  details: Record<number, ItemText>
  /** Names of every other item the page shows (build card, recipes, component orders). */
  names: Record<number, string>
  champions: ChampionRef[]
}

export interface RuneTierList extends RuneView {
  computing?: false
  patch: string
  previousPatch: string | null
  position: Position | null
  /** Names of every rune, tree and shard the page shows. */
  names: Record<number, string>
  champions: ChampionRef[]
}

export interface DuoTierList extends DuoView {
  computing?: false
  patch: string
  previousPatch: string | null
  champions: ChampionRef[]
}

export interface AramTierList extends AramView {
  patch: string
  mode: AramMode
  /** Names of the keystones and trees shown. */
  names: Record<number, string>
  champions: ChampionRef[]
}

/** One blob to read: its cache, key and load. */
interface Want<T> {
  cache: StatsCache
  key: string
  load: () => Promise<T>
}

export class TierListsService {
  // A patch's blobs: a role's items hold a few MB of rows, the rest tens of kB.
  #items = statsCache('tier-items-v2', 12)
  #runes = statsCache('tier-runes-v3', 12)
  #duos = statsCache('tier-duos-v3', 6)
  #aram = statsCache('tier-aram', 8)
  /** Views built from the blobs, a few minutes, so a busy page sums them once. */
  #views = new AnswerCache(256, 5 * 60_000)

  /** The filter of the patch (or range) before, same rank and region; null without one. */
  async previous(filter: Filter): Promise<Filter | null> {
    const shown = await championStatsService.patches()
    const before = previousRange(
      filter.patches,
      shown.map((p) => p.patch)
    )
    return before ? { ...filter, patch: patchValue(before), patches: before } : null
  }

  /* ── Blobs ─────────────────────────────────────────────────── */

  /** One patch's items of one role in a region (every seed tier). */
  itemBlob(patch: string, region: string | null, position: Position): Want<ItemBlob> {
    return {
      cache: this.#items,
      key: `${patch}:${region ?? ''}:${position}`,
      load: async () => {
        const [items, kinds] = await Promise.all([
          buildStatsService.items(patch),
          buildStatsService.kinds(patch),
        ])
        const found = await rows(
          itemRowsSql(region, kinds, recipesOf(items, kinds.legendary)),
          { patch, position },
          LIMITS
        )
        return itemBlob(
          found.map(
            ([tier, kind, champion, item, slot, parts, games, wins]) =>
              [
                String(tier),
                num(kind),
                num(champion),
                num(item),
                num(slot),
                (parts as unknown[]).map(num),
                num(games),
                num(wins),
              ] as ItemRow
          )
        )
      },
    }
  }

  /** One patch's rune pages of one role in a region (every seed tier). */
  runeBlob(patch: string, region: string | null, position: Position): Want<RuneBlob> {
    return {
      cache: this.#runes,
      key: `${patch}:${region ?? ''}:${position}`,
      load: async () => {
        const found = await rows(
          runeRowsSql(region),
          { patch, position, patchStart: await patchStart(patch) },
          LIMITS
        )
        return runeBlob(
          found.map(
            ([tier, kind, champion, a, b, page, games, wins]) =>
              [
                String(tier),
                num(kind),
                num(champion),
                num(a),
                num(b),
                (page as unknown[]).map(num),
                num(games),
                num(wins),
              ] as RuneRow
          )
        )
      },
    }
  }

  /** One patch's duo pairs in a region (every pair of roles and seed tier). */
  duoBlob(patch: string, region: string | null): Want<DuoBlob> {
    return {
      cache: this.#duos,
      key: `${patch}:${region ?? ''}`,
      load: async () => {
        const found = await rows(duoRowsSql(region), { patch }, LIMITS)
        return duoBlob(
          found.map(
            ([tier, pa, pb, a, b, games, wins]) =>
              [
                String(tier),
                String(pa),
                String(pb),
                num(a),
                num(b),
                num(games),
                num(wins),
              ] as DuoRow
          )
        )
      },
    }
  }

  /**
   * The blobs if the cache holds them all, else null: each missing or stale one is queued in
   * the background, its queue place in `wait` (null when the queue is full).
   */
  private async ready<T>(wants: Want<T>[], wait?: { ahead: number | null }) {
    const found = await Promise.all(wants.map((w) => w.cache.peek<T>(w.key)))
    found.forEach((hit, i) => {
      if (hit?.fresh) return
      const w = wants[i]
      const job = `${w.cache.namespace}:${w.key}`
      const queued = statsQueue.add(job, () => w.cache.fill(w.key, w.load))
      if (!hit && wait) {
        const at = queued ? (statsQueue.position(job) ?? 0) : null
        wait.ahead = at === null || wait.ahead === null ? null : Math.max(wait.ahead, at)
      }
    })
    return found.every(Boolean) ? found.map((hit) => hit!.value) : null
  }

  /** Reads `wants` now, one after the other through the queue (the warmer). */
  async fill(wants: Want<unknown>[]) {
    for (const w of wants) {
      await statsQueue.add(`${w.cache.namespace}:${w.key}`, () => w.cache.fill(w.key, w.load))
    }
  }

  /* ── Items ─────────────────────────────────────────────────── */

  private itemWants(filter: Filter, position: Position | null) {
    const roles = position ? [position] : [...POSITIONS]
    return filter.patches.flatMap((p) => roles.map((r) => this.itemBlob(p, filter.region, r)))
  }

  /** A filter's item counts if every blob it sums is held, else null (missing ones are queued). */
  private async itemCounts(
    filter: Filter,
    position: Position | null,
    wait?: { ahead: number | null }
  ): Promise<ItemCounts | null> {
    const roles = position ? [position] : [...POSITIONS]
    const blobs = await this.ready(this.itemWants(filter, position), wait)
    if (!blobs) return null
    const tiers = bracketTiers(filter.bracket)
    const counts: ItemCounts = { roles: {} }
    roles.forEach((role, r) => {
      // The blobs are patch by patch, each holding every role in order.
      const mine = filter.patches.map((_, p) => blobs[p * roles.length + r])
      counts.roles[role] = roleItemCounts(mine, tiers)
    })
    return counts
  }

  /** The item tier list of a role (`null`: every role) and an item class (`null`: every item). */
  async items(
    filter: Filter,
    position: Position | null,
    cls: ChampionClass | null
  ): Promise<ItemTierList | Computing> {
    const wait = { ahead: 0 as number | null }
    const before = await this.previous(filter)
    const [counts, previous] = await Promise.all([
      this.itemCounts(filter, position, wait),
      before ? this.itemCounts(before, position).catch(() => null) : null,
    ])
    if (!counts) return { computing: true, ahead: wait.ahead }
    const at = `items:${filter.patch}:${filter.bracket}:${filter.region ?? ''}:${position}:${cls}:${!!previous}`
    return this.#views.get(at, async () => {
      const [items, kinds, list] = await Promise.all([
        buildStatsService.items(filter.patches[0]),
        buildStatsService.kinds(filter.patches[0]),
        championStatsService.champions(),
      ])
      const view = itemView(counts, previous, position, cls, championClasses(list), kinds)
      const details: Record<number, ItemText> = {}
      for (const r of view.rows) details[r.item] = itemText(items, r.item)
      const others = new Set<number>()
      const walk = (node: RecipeNode) => {
        others.add(node.item)
        node.from.forEach(walk)
      }
      Object.values(details).forEach((d) => walk(d.recipe))
      for (const slot of view.build.slots) for (const o of slot) others.add(o.item)
      for (const o of view.build.boots) others.add(o.item)
      for (const o of Object.values(view.orders)) o.components.forEach((i) => others.add(i))
      const names: Record<number, string> = {}
      for (const id of others) {
        const name = (items[id] as { name?: string } | undefined)?.name
        if (name) names[id] = name
      }
      const champions = new Set(view.rows.flatMap((r) => r.champions.map((c) => c.champion)))
      return {
        ...view,
        patch: filter.patch,
        previousPatch: previous ? (before?.patch ?? null) : null,
        position,
        class: cls,
        details,
        names,
        champions: this.refs(champions, list),
      }
    })
  }

  /* ── Runes ─────────────────────────────────────────────────── */

  /** The rune tier list of a role (`null`: every role). */
  async runes(filter: Filter, position: Position | null): Promise<RuneTierList | Computing> {
    const wait = { ahead: 0 as number | null }
    const before = await this.previous(filter)
    const roles = position ? [position] : [...POSITIONS]
    const counts = async (f: Filter, w?: { ahead: number | null }) => {
      const wants = f.patches.flatMap((p) => roles.map((r) => this.runeBlob(p, f.region, r)))
      const blobs = await this.ready(wants, w)
      if (!blobs) return null
      const tiers = bracketTiers(f.bracket)
      return mergeRuneCounts(
        roles.map((role, r) =>
          roleRuneCounts(
            f.patches.map((_, p) => blobs[p * roles.length + r]),
            tiers,
            role
          )
        )
      )
    }
    const [now, previous] = await Promise.all([
      counts(filter, wait),
      before ? counts(before).catch(() => null) : null,
    ])
    if (!now) return { computing: true, ahead: wait.ahead }
    const at = `runes:${filter.patch}:${filter.bracket}:${filter.region ?? ''}:${position}:${!!previous}`
    return this.#views.get(at, async () => {
      const [trees, perks, list] = await Promise.all([
        riotAssetsService.runeTrees(),
        riotAssetsService.names('perk').catch(() => ({}) as Record<string, string>),
        championStatsService.champions(),
      ])
      const view = runeView(now, previous, position, keystoneTrees(trees.styles), trees.styles)
      const ids = new Set<number>()
      for (const r of view.rows) {
        ids.add(r.keystone).add(r.style)
        r.secondary.forEach((s) => ids.add(s.style))
        for (const p of r.pages) pageIds(p.page).forEach((i) => ids.add(i))
      }
      for (const p of view.pages) pageIds(p.page).forEach((i) => ids.add(i))
      for (const t of view.trees) {
        ids.add(t.style)
        if (t.paired) ids.add(t.paired.style)
        t.rows.flat().forEach((r) => ids.add(r.rune))
      }
      view.shards.flat().forEach((s) => ids.add(s.shard))
      const names: Record<number, string> = {}
      for (const id of ids) {
        const name = perks[id] ?? trees.styles[id]?.name
        if (name) names[id] = name
      }
      const champions = new Set(view.rows.flatMap((r) => r.champions.map((c) => c.champion)))
      return {
        ...view,
        patch: filter.patch,
        previousPatch: previous ? (before?.patch ?? null) : null,
        position,
        names,
        champions: this.refs(champions, list),
      }
    })
  }

  /* ── Duos ──────────────────────────────────────────────────── */

  /** The duo tier list of two roles (bot and support, mid and jungle, jungle and support…). */
  async duos(filter: Filter, lane: DuoLane): Promise<DuoTierList | Computing> {
    const wait = { ahead: 0 as number | null }
    const before = await this.previous(filter)
    const counts = async (f: Filter, w?: { ahead: number | null }) => {
      const blobs = await this.ready(
        f.patches.map((p) => this.duoBlob(p, f.region)),
        w
      )
      return blobs ? duoCounts(blobs, bracketTiers(f.bracket)) : null
    }
    const [now, previous] = await Promise.all([
      counts(filter, wait),
      before ? counts(before).catch(() => null) : null,
    ])
    if (!now) return { computing: true, ahead: wait.ahead }
    const at = `duos:${filter.patch}:${filter.bracket}:${filter.region ?? ''}:${lane}:${!!previous}`
    return this.#views.get(at, async () => {
      const [summary, list] = await Promise.all([
        championStatsService.summary(filter).catch(() => null),
        championStatsService.champions(),
      ])
      const wins = new Map(
        (summary?.roles ?? []).map((r) => [`${r.champion}:${r.position}`, r.win])
      )
      const view = duoView(
        now,
        previous,
        lane,
        (champion, position) => wins.get(`${champion}:${position}`) ?? null
      )
      const champions = new Set([
        ...view.rows.flatMap((r) => [r.a, r.b]),
        ...view.grid.a,
        ...view.grid.b,
      ])
      return {
        ...view,
        patch: filter.patch,
        previousPatch: previous ? (before?.patch ?? null) : null,
        champions: this.refs(champions, list),
      }
    })
  }

  /* ── ARAM ──────────────────────────────────────────────────── */

  /**
   * Every champion's ARAM (or Mayhem) games stored for the filter's patches and region: a few
   * thousand rows (the games players' profiles synced), read at once.
   */
  aramCounts(filter: Filter, mode: AramMode): Promise<AramCounts> {
    const at = `${filter.patch}:${filter.region ?? ''}:${mode}`
    return this.#aram.get(at, async () => {
      const starts = await Promise.all(filter.patches.map((p) => patchStart(p)))
      const found = await rows(
        aramRowsSql(filter),
        {
          patches: filter.patches,
          queue: ARAM_MODES[mode],
          patchStart: starts.length ? Math.min(...starts) : 0,
        },
        LIMITS
      )
      return aramCounts(found.map((r) => [String(r[0]), ...r.slice(1).map(num)] as AramRow))
    })
  }

  /** The ARAM tier list (any rank: ARAM has none). */
  async aram(filter: Filter, mode: AramMode): Promise<AramTierList> {
    const [counts, trees, perks, list] = await Promise.all([
      this.aramCounts(filter, mode),
      riotAssetsService.runeTrees(),
      riotAssetsService.names('perk').catch(() => ({}) as Record<string, string>),
      championStatsService.champions(),
    ])
    const view = aramView(counts)
    const names: Record<number, string> = {}
    for (const r of view.rows) {
      if (!r.keystone) continue
      for (const id of [r.keystone.keystone, r.keystone.style]) {
        const name = perks[id] ?? trees.styles[id]?.name
        if (name) names[id] = name
      }
    }
    return {
      ...view,
      patch: filter.patch,
      mode,
      names,
      champions: this.refs(new Set(view.rows.map((r) => r.champion)), list),
    }
  }

  /* ── Warming ───────────────────────────────────────────────── */

  /**
   * Every blob of `patches` for every region in `regions` (`null`: every region): items and
   * runes of each role (runes while their page is shown), the duos, in that order. Each is a read
   * of a patch at every rank.
   */
  warmWants(patches: string[], regions: (string | null)[]) {
    const wants: Want<unknown>[] = []
    for (const region of regions) {
      for (const patch of patches) {
        for (const role of POSITIONS) wants.push(this.itemBlob(patch, region, role))
        if (SHOW_RUNES) for (const role of POSITIONS) wants.push(this.runeBlob(patch, region, role))
        wants.push(this.duoBlob(patch, region))
      }
    }
    return wants
  }

  /** The champions of `ids` as the pages link them. */
  private refs(
    ids: Set<number>,
    list: { id: number; name: string; slug: string; roles: string[] }[]
  ): ChampionRef[] {
    const classes = championClasses(list)
    return list
      .filter((c) => ids.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, slug: c.slug, class: classes.get(c.id) ?? null }))
  }
}

/** Every rune id of a page. */
const pageIds = (p: {
  primaryStyle: number
  keystone: number
  primary: number[]
  secondaryStyle: number
  secondary: number[]
  shards: number[]
}) => [p.primaryStyle, p.keystone, ...p.primary, p.secondaryStyle, ...p.secondary, ...p.shards]

export default new TierListsService()
