import type { HttpContext } from '@adonisjs/core/http'
import championStatsService, { DEFAULT_BRACKET } from '#services/champion_stats_service'
import statsExplorerService from '#services/stats_explorer_service'
import { ROLE_OF, positionOf } from '#services/champion_stats'
import { latestPatch } from '#services/ranked_games_service'
import { BRACKET_TEXT, breadcrumbs, count, meta, notFoundPage } from '#services/page_meta'
import { onceEach, settle } from '#services/page_blocks'
import { patchText } from '../../inertia/lib/patches.js'
import { METRICS, STATS, oldStat, statOf, type Metrics } from '../../inertia/lib/studio.js'

/** How long the page waits for its blocks before it is sent (see the champion page). */
const READY_MS = 150

/**
 * The stats studio. `/stats` is the hub: every statistic by category, with the champion at the
 * top of each. `/stats/<stat>` ranks every champion of the role (`?role=`, every role without
 * one) by that figure. The old explorer's addresses (`/stats?view=early`, `?sort=`) move to
 * their page.
 */
export default class StatsController {
  async index(ctx: HttpContext) {
    const { inertia, request, response, params } = ctx
    const query = request.qs()
    if (!params.stat) {
      const old = oldStat(query.view, query.sort)
      if (old !== undefined) {
        const { view: _view, sort: _sort, ...rest } = query
        const search = new URLSearchParams(rest as Record<string, string>).toString()
        return response
          .redirect()
          .status(301)
          .toPath(`/stats${old ? `/${old}` : ''}${search ? `?${search}` : ''}`)
      }
    }
    const stat = statOf(params.stat)
    if (params.stat && !stat) return notFoundPage({ inertia, response })

    const position = positionOf(query.role)
    const filter = await championStatsService.filter(query)
    const [patches, champions] = await Promise.all([
      championStatsService.patches(),
      championStatsService.champions(),
    ])
    const base = { stat: stat?.slug ?? null, position, patches, filter }
    if (!filter) return inertia.render('stats/index', { ...base, rows: [], champions: [] })

    const [role, updatedAt] = await Promise.all([
      statsExplorerService.roleRows(filter, position).catch(() => null),
      statsExplorerService.updatedAt(filter.patch).catch(() => null),
    ])
    const rows = role?.rows ?? []
    const ids = new Set(rows.map((r) => r.champion))
    const listed = (found: { champions: Record<number, Metrics>; all: Metrics }) => ({
      all: found.all,
      champions: Object.fromEntries(
        Object.entries(found.champions).filter(([c]) => ids.has(Number(c)))
      ),
    })

    // A page reads only the sources its figures come from; the hub reads them all (each stat's
    // leader). What the cache holds within a short wait is sent with the page, the rest follows
    // as a deferred prop.
    const needs = new Set(
      stat ? [stat.key, ...stat.cols].map((k) => METRICS[k].source) : ['game', 'lane']
    )
    const loads: Record<string, () => Promise<unknown>> = {}
    if (needs.has('game')) {
      loads.game = async () => listed(await statsExplorerService.studio(filter, position))
    }
    if (needs.has('lane')) {
      loads.lane = async () => listed(await statsExplorerService.lane(filter, position))
    }
    const blocks = onceEach(loads)
    const partial = Boolean(request.header('x-inertia-partial-data'))
    const { ready, waiting } = partial
      ? { ready: {}, waiting: Object.keys(blocks) }
      : await settle(blocks, READY_MS)
    const extra: Record<string, unknown> = { ...ready }
    for (const k of waiting) extra[k] = inertia.defer(blocks[k], 'studio')

    const roleGames = rows.reduce((n, r) => n + r.games, 0)
    const games = role?.summary.games ?? 0
    const where = position ? ROLE_OF[position].label.toLowerCase() : 'every role'
    const isDefault =
      filter.bracket === DEFAULT_BRACKET && !filter.region && filter.patch === (await latestPatch())
    const path = stat ? `/stats/${stat.slug}` : '/stats'
    const byId = new Map(champions.map((c) => [c.id, c]))
    const tail = `${BRACKET_TEXT[filter.bracket]}, ${patchText(filter.patch)}, ${count(games)} ranked games.`
    return inertia.render('stats/index', {
      ...base,
      ...extra,
      rows,
      games,
      roleGames,
      previousPatch: role?.previousPatch ?? null,
      updatedAt,
      now: Date.now(),
      champions: rows.flatMap((r) => {
        const c = byId.get(r.champion)
        return c ? [{ id: c.id, name: c.name, slug: c.slug }] : []
      }),
      ...meta(
        stat
          ? {
              title: `${stat.label}: ${where}, ${patchText(filter.patch)}`,
              description: `${rows.length} champions of ${where} ranked by ${stat.label.toLowerCase()}. ${stat.about ? `${stat.about} ` : ''}${tail}`,
              path,
              image: `/og/stats/${stat.slug}.jpg`,
              version: filter.patch,
              alt: `${stat.label}: the champion at the top of the list and its figure over its splash art, with a poro`,
            }
          : {
              title: `Champion stats: ${where}, ${patchText(filter.patch)}`,
              description: `${STATS.length} statistics on ${rows.length} champions of ${where}: results, combat, damage, laning, objectives, vision, game length, pings and summoner spells. ${tail}`,
              path,
              image: '/og/stats/all.jpg',
              version: filter.patch,
              alt: 'Champion stats: the games read on the patch over a champion splash art, with a poro',
            }
      ),
      robots: !rows.length || !isDefault ? 'noindex,follow' : null,
      jsonld: [
        breadcrumbs([
          { name: 'Stats', path: '/stats' },
          ...(stat ? [{ name: stat.label, path }] : []),
        ]),
      ],
    })
  }
}
