import type { HttpContext } from '@adonisjs/core/http'
import championStatsService, { DEFAULT_BRACKET } from '#services/champion_stats_service'
import tierListsService from '#services/tier_lists_service'
import { ROLE_OF, positionOf, type Filter } from '#services/champion_stats'
import { latestPatch } from '#services/ranked_games_service'
import { REGIONS } from '#services/ranked_stats'
import { CLASSES, classOf } from '#services/tier_lists'
import { DUO_LANES, duoLaneOf } from '#services/duo_tier_list'
import { ARAM_MODES, aramModeOf } from '#services/aram_tier_list'
import { BRACKET_TEXT, breadcrumbs, meta } from '#services/page_meta'
import { onceEach, settle } from '#services/page_blocks'
import { patchText } from '../../inertia/lib/patches.js'

/**
 * How long a page waits for its list before it is sent: a list the stats cache holds comes back
 * well within it; a cold one (a read of the patch's games) arrives on its own after the page, as
 * an Inertia deferred prop.
 */
const READY_MS = 150

/** The class names in titles. */
const CLASS_LABEL: Record<string, string> = {
  mage: 'Mage',
  assassin: 'Assassin',
  fighter: 'Fighter',
  marksman: 'Marksman',
  tank: 'Tank',
  support: 'Support',
}

const DUO_LABEL: Record<string, string> = {
  bot: 'Bot lane duos',
  mid: 'Mid and jungle duos',
  top: 'Top and jungle duos',
}

/** Whether the filter is the default one (newest patch, default rank, every region). */
async function isDefault(filter: Filter | null, bracket = DEFAULT_BRACKET) {
  return (
    !!filter &&
    filter.bracket === bracket &&
    !filter.region &&
    filter.patch === (await latestPatch().catch(() => null))
  )
}

/**
 * The tier lists beside the champions' (`/tier-list`): items, runes, duos and ARAM. Each page is
 * sent with its filters at once and its list when the cache holds it, else right after.
 */
export default class TierListsController {
  /** `/tier-list/items?role=mid&class=mage`: items ranked against the others of their class. */
  async items(ctx: HttpContext) {
    const { request } = ctx
    const filter = await championStatsService.filter(request.qs())
    const position = positionOf(request.input('role'))
    const cls = classOf(request.input('class'))
    const role = position ? ROLE_OF[position].label : null
    const heading = [role, cls ? CLASS_LABEL[cls].toLowerCase() : null, 'items']
      .filter(Boolean)
      .join(' ')
    const title = `${heading.charAt(0).toUpperCase()}${heading.slice(1)}`
    const query = new URLSearchParams()
    if (position) query.set('role', ROLE_OF[position].slug)
    if (cls) query.set('class', cls)
    const path = `/tier-list/items${query.size ? `?${query}` : ''}`
    return this.render(ctx, 'tier_lists/items', {
      filter,
      load: (f) => tierListsService.items(f, position, cls),
      props: { position, class: cls, classes: CLASSES },
      meta: {
        title: `${title} tier list${filter ? `, ${patchText(filter.patch)}` : ''}`,
        description: `${title} ranked by win rate from our own ranked games${filter ? `, ${BRACKET_TEXT[filter.bracket]}, ${patchText(filter.patch)}` : ''}: when each item is finished, who builds it, its recipe and the order its components are bought in.`,
        path,
      },
      crumb: 'Items',
      image: {
        path: '/og/tier-list/items.jpg',
        alt: 'The five best items by win rate, their icons and tiers, with a poro holding a heart',
      },
      indexable: !cls,
    })
  }

  /** `/tier-list/runes?role=support`: keystones ranked against each other, trees, shards and pages. */
  async runes(ctx: HttpContext) {
    const { request } = ctx
    const filter = await championStatsService.filter(request.qs())
    const position = positionOf(request.input('role'))
    const role = position ? ROLE_OF[position].label : null
    const path = `/tier-list/runes${position ? `?role=${ROLE_OF[position].slug}` : ''}`
    return this.render(ctx, 'tier_lists/runes', {
      filter,
      load: (f) => tierListsService.runes(f, position),
      props: { position },
      meta: {
        title: `${role ? `${role} rune` : 'Rune'} tier list${filter ? `, ${patchText(filter.patch)}` : ''}`,
        description: `Every keystone ${role ? `played ${role.toLowerCase()} ` : ''}ranked by win rate from our own ranked games${filter ? `, ${BRACKET_TEXT[filter.bracket]}, ${patchText(filter.patch)}` : ''}: who runs it, the tree it is paired with and its most played full pages.`,
        path,
      },
      crumb: 'Runes',
      image: {
        path: '/og/tier-list/runes.jpg',
        alt: 'The five best keystones by win rate, their icons and tiers, with a poro',
      },
      indexable: true,
    })
  }

  /** `/tier-list/duos?lane=bot`: champions played together, ranked by their win rate together. */
  async duos(ctx: HttpContext) {
    const { request } = ctx
    const filter = await championStatsService.filter(request.qs())
    const lane = duoLaneOf(request.input('lane')) ?? 'bot'
    const path = `/tier-list/duos${lane === 'bot' ? '' : `?lane=${lane}`}`
    return this.render(ctx, 'tier_lists/duos', {
      filter,
      load: (f) => tierListsService.duos(f, lane),
      props: { lane, lanes: Object.keys(DUO_LANES) },
      meta: {
        title: `${DUO_LABEL[lane]} tier list${filter ? `, ${patchText(filter.patch)}` : ''}`,
        description: `${DUO_LABEL[lane]} ranked by their win rate together from our own ranked games${filter ? `, ${BRACKET_TEXT[filter.bracket]}, ${patchText(filter.patch)}` : ''}, with how much better they do together than apart.`,
        path,
      },
      crumb: 'Duos',
      image: {
        path: `/og/tier-list/duos${lane === 'bot' ? '' : `-${lane}`}.jpg`,
        alt: `The best ${DUO_LABEL[lane].toLowerCase()} as pairs of champion portraits with their win rate together, with two poros`,
      },
      indexable: true,
    })
  }

  /** `/tier-list/aram?mode=mayhem`: every champion's record in the ARAM games we hold. */
  async aram(ctx: HttpContext) {
    const { request } = ctx
    // ARAM has no rank: every stored game counts.
    const filter = await championStatsService.filter({ ...request.qs(), rank: 'all' })
    const mode = aramModeOf(request.input('mode'))
    const label = mode === 'mayhem' ? 'ARAM: Mayhem' : 'ARAM'
    const path = `/tier-list/aram${mode === 'aram' ? '' : `?mode=${mode}`}`
    return this.render(ctx, 'tier_lists/aram', {
      filter,
      load: (f) => tierListsService.aram(f, mode),
      props: { mode, modes: Object.keys(ARAM_MODES) },
      meta: {
        title: `${label} tier list${filter ? `, ${patchText(filter.patch)}` : ''}`,
        description: `Every champion's win and pick rate in ${label} from the games we hold${filter ? `, ${patchText(filter.patch)}` : ''}.`,
        path,
      },
      crumb: 'ARAM',
      image: {
        path: '/og/tier-list/aram.jpg',
        alt: 'The five best ARAM champions, their portraits, tiers and win rates, with a poro',
      },
      // Too few games stored to be worth indexing yet.
      indexable: false,
      bracket: 'all',
    })
  }

  /**
   * A tier list page: its filters and patch menu at once, its list with the page when ready
   * within `READY_MS`, else as a deferred prop (an Inertia partial reload asks for it directly).
   */
  private async render(
    { inertia, request }: HttpContext,
    component: string,
    opts: {
      filter: Filter | null
      load: (filter: Filter) => Promise<unknown>
      props: Record<string, unknown>
      meta: { title: string; description: string; path: string }
      crumb: string
      image: { path: string; alt: string }
      indexable: boolean
      bracket?: Filter['bracket']
    }
  ) {
    const { filter } = opts
    const patches = await championStatsService.patches()
    const blocks = onceEach({
      list: () => (filter ? opts.load(filter) : Promise.resolve(null)),
    })
    const partial = Boolean(request.header('x-inertia-partial-data'))
    const { ready, waiting } = partial
      ? { ready: {}, waiting: Object.keys(blocks) }
      : await settle(blocks, READY_MS)
    const lists: Record<string, unknown> = { ...ready }
    for (const k of waiting) lists[k] = inertia.defer(blocks[k], 'list')
    const indexable = opts.indexable && (await isDefault(filter, opts.bracket))
    return inertia.render(component, {
      ...opts.props,
      ...lists,
      filter,
      patches,
      regions: Object.entries(REGIONS).map(([value, r]) => ({ value, label: r.label })),
      ...meta({
        title: opts.meta.title,
        description: opts.meta.description,
        path: opts.meta.path,
        image: opts.image.path,
        version: filter?.patch ?? 'none',
        alt: opts.image.alt,
      }),
      robots: indexable ? null : 'noindex,follow',
      jsonld: [
        breadcrumbs([
          { name: 'Tier list', path: '/tier-list' },
          { name: opts.crumb, path: opts.meta.path },
        ]),
      ],
    })
  }
}
