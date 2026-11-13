import type { HttpContext } from '@adonisjs/core/http'
import riotAssetsService from '#services/riot/assets'
import championStatsService, { DEFAULT_BRACKET } from '#services/champion_stats_service'
import statsExplorerService, { LENGTHS, VIEWS, type View } from '#services/stats_explorer_service'
import { ROLE_OF, positionOf, type Position } from '#services/champion_stats'
import { latestPatch } from '#services/ranked_games_service'
import { REGIONS } from '#services/ranked_stats'
import { BRACKET_TEXT, breadcrumbs, count, meta } from '#services/page_meta'
import { onceEach, settle } from '#services/page_blocks'
import { patchText } from '../../inertia/lib/patches.js'

/** How long the page waits for its view's blocks before it is sent (see the champion page). */
const READY_MS = 150

/** The views' names, as the page and its title say them. */
export const VIEW_LABELS: Record<View, string> = {
  overview: 'Champion stats',
  early: 'Early game',
  length: 'Game length',
  firstblood: 'First blood',
  items: 'Items',
  regions: 'Regions',
  patch: 'Patch changes',
}

const VIEW_TEXT: Record<View, string> = {
  overview: 'win, pick and ban rates, KDA, CS, damage, gold at 10 minutes and first blood',
  early: 'gold, CS and experience at 10 and 15 minutes against the lane opponent',
  length: 'win rate by game length',
  firstblood: 'how often each champion takes, helps or gives first blood',
  items: 'how often each finished item is bought and how those games end',
  regions: 'win rate on each server',
  patch: 'who climbed and who fell since the previous patch',
}

/** `/stats?view=early&role=mid`: every champion of a role in one sortable table. */
export default class StatsController {
  async index({ inertia, request }: HttpContext) {
    const asked = String(request.input('view', 'overview'))
    const view: View = (VIEWS as readonly string[]).includes(asked) ? (asked as View) : 'overview'
    const askedRole = positionOf(request.input('role'))
    const position: Position = askedRole ?? 'MIDDLE'
    const filter = await championStatsService.filter(request.qs())
    const [patches, champions] = await Promise.all([
      championStatsService.patches(),
      championStatsService.champions(),
    ])
    const base = {
      view,
      position,
      patches,
      filter,
      lengths: LENGTHS.map(([from, to]) => [from, to]),
      regions: Object.entries(REGIONS).map(([value, r]) => ({ value, label: r.label })),
    }
    if (!filter) return inertia.render('stats/index', { ...base, rows: [], champions: [] })

    const [role, updatedAt] = await Promise.all([
      statsExplorerService.roleRows(filter, position).catch(() => null),
      statsExplorerService.updatedAt(filter.patch).catch(() => null),
    ])
    const rows = role?.rows ?? []
    const ids = new Set(rows.map((r) => r.champion))
    // The view's blocks: what the cache holds within a short wait is sent with the page, the rest
    // (a cold filter's averages are a read of the role's games) follows as a deferred prop.
    const loads: Record<string, () => Promise<unknown>> = {}
    if (view === 'overview' || view === 'length') {
      loads.averages = async () => {
        const averages = await statsExplorerService.averages(filter, position)
        return Object.fromEntries(
          Object.entries(averages)
            .filter(([c]) => ids.has(Number(c)))
            .map(([c, a]) => [
              c,
              view === 'overview'
                ? {
                    kda: a.kda,
                    csPerMin: a.csPerMin,
                    damage: a.damage,
                    early: a.byLength[0],
                    late: a.byLength[a.byLength.length - 1],
                  }
                : { length: a.length, byLength: a.byLength, games: a.games },
            ])
        )
      }
    }
    if (view === 'overview') {
      loads.events = async () => {
        const events = await statsExplorerService.events(filter, position)
        return Object.fromEntries(
          [...ids].map((c) => {
            const e = events.early[c]
            const f = events.firstBlood[c]
            return [
              c,
              {
                gold: e?.at10.goldDiff ?? null,
                cs: e?.at10.csDiff ?? null,
                ahead: e?.ahead ?? null,
                aheadWin: e?.aheadWin ?? null,
                fb: f?.involved ?? null,
              },
            ]
          })
        )
      }
    }
    if (view === 'early' || view === 'firstblood') {
      loads[view === 'early' ? 'early' : 'firstBlood'] = async () => {
        const events = await statsExplorerService.events(filter, position)
        const of = view === 'early' ? events.early : events.firstBlood
        return Object.fromEntries(Object.entries(of).filter(([c]) => ids.has(Number(c))))
      }
    }
    if (view === 'regions') {
      loads.byRegion = async () => {
        const regions = await statsExplorerService.regions(filter, position)
        return Object.fromEntries(Object.entries(regions).filter(([c]) => ids.has(Number(c))))
      }
    }
    if (view === 'items') {
      loads.items = async () => {
        const [items, names] = await Promise.all([
          statsExplorerService.items(filter, position),
          riotAssetsService.names('item').catch(() => ({}) as Record<string, string>),
        ])
        return items.map((i) => ({ ...i, name: names[i.item] ?? null }))
      }
    }
    const blocks = onceEach(loads)
    const partial = Boolean(request.header('x-inertia-partial-data'))
    const { ready, waiting } = partial
      ? { ready: {}, waiting: Object.keys(blocks) }
      : await settle(blocks, READY_MS)
    const extra: Record<string, unknown> = { ...ready }
    for (const k of waiting) extra[k] = inertia.defer(blocks[k], 'explorer')

    const roleGames = rows.reduce((n, r) => n + r.games, 0)
    const label = ROLE_OF[position].label
    const isDefault =
      filter.bracket === DEFAULT_BRACKET && !filter.region && filter.patch === (await latestPatch())
    const path = view === 'overview' ? '/stats' : `/stats?view=${view}`
    const byId = new Map(champions.map((c) => [c.id, c]))
    return inertia.render('stats/index', {
      ...base,
      ...extra,
      rows,
      games: role?.summary.games ?? 0,
      roleGames,
      previousPatch: role?.previousPatch ?? null,
      updatedAt,
      now: Date.now(),
      champions: rows.flatMap((r) => {
        const c = byId.get(r.champion)
        return c ? [{ id: c.id, name: c.name, slug: c.slug }] : []
      }),
      ...meta({
        title: `${VIEW_LABELS[view]}: ${label.toLowerCase()}, ${patchText(filter.patch)}`,
        description: `${rows.length} ${label.toLowerCase()} champions, ${VIEW_TEXT[view]}. ${BRACKET_TEXT[filter.bracket]}, ${patchText(filter.patch)}, ${count(role?.summary.games ?? 0)} ranked games.`,
        path,
        image: `/og/stats/${view === 'overview' ? 'all' : view}.jpg`,
        version: filter.patch,
        alt: `${VIEW_LABELS[view]} on invade.lol`,
      }),
      robots: !rows.length || !isDefault ? 'noindex,follow' : null,
      jsonld: [
        breadcrumbs([
          { name: 'Stats', path: '/stats' },
          ...(view === 'overview' ? [] : [{ name: VIEW_LABELS[view], path }]),
        ]),
      ],
    })
  }
}
