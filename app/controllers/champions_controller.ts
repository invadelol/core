import type { HttpContext } from '@adonisjs/core/http'
import riotAssetsService from '#services/riot/assets'
import buildStatsService from '#services/build_stats_service'
import runeStatsService from '#services/rune_stats_service'
import spellStatsService from '#services/spell_stats_service'
import championStatsService, { DEFAULT_BRACKET } from '#services/champion_stats_service'
import proService from '#services/pro_service'
import { onceEach, settle } from '#services/page_blocks'
import {
  POSITIONS,
  ROLE_OF,
  positionOf,
  type Filter,
  type Position,
} from '#services/champion_stats'
import type { Role } from '#services/ranked_stats'
import { latestPatch } from '#services/ranked_games_service'
import { leagueOfTeam, leagueRef } from '#services/pro_leagues'
import { BRACKET_TEXT, breadcrumbs, count, itemList, meta, percent } from '#services/page_meta'
import { CHAMPION_TABS, type ChampionTab } from '../../inertia/lib/champions.js'

/**
 * How long a page waits for its first screen's blocks before it is sent: an answer the stats
 * cache holds comes back well within it. A block still counting then arrives on its own (an
 * Inertia deferred prop), so the page shows what it has instead of waiting for its slowest query.
 */
const READY_MS = 150

/** Blocks that load together: matchups and teammates are one query. */
const BLOCK_GROUP: Record<string, string> = { matchups: 'lane', teammates: 'lane' }

/** The sections below the first screen: always sent after the page, in one request. */
const LOWER = ['byRank', 'details', 'pros'] as const

/** The role names the build, rune and spell services take. */
const SERVICE_ROLE: Record<Position, Role> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MIDDLE: 'mid',
  BOTTOM: 'adc',
  UTILITY: 'support',
}

/** `?tab=` of the champion list: which section of a champion's page its tiles open. */
const LIST_TABS = ['matchups', 'items', 'runes', 'pros'] as const

/** A champion's own fields a page needs. */
const entryOf = (c: { id: number; name: string; slug: string; roles: string[] }) => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  roles: c.roles,
})

/** Whether the filter is the default one (newest patch, default rank, every region). */
async function isDefault(filter: Filter) {
  return (
    filter.bracket === DEFAULT_BRACKET && !filter.region && filter.patch === (await latestPatch())
  )
}

/**
 * The names of the items, runes and spells the first screen shows, so the page is sent with them
 * (the browser loads the other names when it needs them).
 */
async function labelsOf(data: Record<string, any>) {
  const items = new Set<number>()
  const runes = new Set<number>()
  const spells = new Set<number>()
  const b = data.build
  if (b) {
    for (const list of [b.starters, b.boots, b.cores])
      for (const o of list ?? []) o.items.forEach((i: number) => items.add(i))
    for (const slot of b.slots ?? []) for (const o of slot.slice(0, 5)) items.add(o.item)
  }
  for (const k of data.runes?.keystones ?? []) runes.add(k.keystone)
  const page = data.runes?.pages?.[0]?.page
  if (page)
    [page.keystone, ...page.primary, ...page.secondary, ...page.shards].forEach((i: number) =>
      runes.add(i)
    )
  for (const p of data.spells?.pairs ?? []) p.spells.forEach((i: number) => spells.add(i))
  const [itemNames, runeNames, spellNames] = await Promise.all([
    items.size ? riotAssetsService.names('item') : {},
    runes.size ? riotAssetsService.names('perk') : {},
    spells.size ? riotAssetsService.names('spell') : {},
  ])
  const pick = (names: Record<string, string>, ids: Set<number>) =>
    Object.fromEntries([...ids].filter((i) => names[i]).map((i) => [i, names[i]]))
  return {
    item: pick(itemNames, items),
    rune: pick(runeNames, runes),
    spell: pick(spellNames, spells),
  }
}

/** Champion statistics from our own ranked games: the list, the tier list and a champion's page. */
export default class ChampionsController {
  /** `/champions`: every champion with its main role, tier and win rate. */
  async index({ inertia, request }: HttpContext) {
    const filter = await championStatsService.filter(request.qs())
    const [champions, summary, patches] = await Promise.all([
      championStatsService.champions(),
      filter ? championStatsService.summary(filter).catch(() => null) : null,
      championStatsService.patches(),
    ])
    const asked = String(request.input('tab', ''))
    const tab = (LIST_TABS as readonly string[]).includes(asked) ? asked : null
    const list = champions.map(entryOf)
    return inertia.render('champions/index', {
      // Compact rows (the page reads them back): every champion and every role row of the summary.
      champions: list.map((c) => [c.id, c.name, c.slug, c.roles]),
      stats: (summary?.roles ?? []).map((r) => [
        r.champion,
        POSITIONS.indexOf(r.position),
        r.games,
        r.win,
        r.pick,
        r.ban,
        r.tier,
        r.rank,
      ]),
      games: summary?.games ?? 0,
      patches,
      filter,
      tab,
      ...meta({
        title: tab
          ? `Champion ${tab === 'pros' ? 'pro builds' : tab}: pick a champion`
          : 'Every champion: builds, runes, counters and tiers',
        description: `${list.length} League of Legends champions with their tier, win rate, builds, runes and counters in each role${filter ? `, from ${count(summary?.games ?? 0)} ranked games on patch ${filter.patch}, ${BRACKET_TEXT[filter.bracket]}` : ''}.`,
        path: '/champions',
        image: '/og/tier-list/all.jpg',
        version: filter?.patch ?? 'none',
        alt: 'Champions on invade.lol',
      }),
      robots: tab || (filter && !(await isDefault(filter))) ? 'noindex,follow' : null,
      jsonld: [
        breadcrumbs([{ name: 'Champions', path: '/champions' }]),
        itemList(
          'League of Legends champions',
          list.map((c) => ({ name: c.name, path: `/champions/${c.slug}` }))
        ),
      ],
    })
  }

  /** `/tier-list?role=bot`: one role's champions ranked, with how each moved since last patch. */
  async tierList({ inertia, request }: HttpContext) {
    const asked = positionOf(request.input('role'))
    const position = asked ?? 'TOP'
    const filter = await championStatsService.filter(request.qs())
    const [champions, summary, previous, patches] = await Promise.all([
      championStatsService.champions(),
      filter ? championStatsService.summary(filter).catch(() => null) : null,
      filter ? championStatsService.previous(filter).catch(() => null) : null,
      championStatsService.patches(),
    ])
    const ranks: Record<string, number> = {}
    for (const r of previous?.roles ?? []) {
      if (r.position === position && r.rank) ranks[r.champion] = r.rank
    }
    const rows = (summary?.roles ?? [])
      .filter((r) => r.position === position && r.rank)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
      .map((r) => ({
        champion: r.champion,
        games: r.games,
        win: r.win,
        pick: r.pick,
        ban: r.ban,
        roleShare: r.roleShare,
        tier: r.tier,
        rank: r.rank,
      }))
    const byId = new Map(champions.map((c) => [c.id, c]))
    const role = ROLE_OF[position]
    const top = rows[0] ? byId.get(rows[0].champion) : null
    const path = asked ? `/tier-list?role=${role.slug}` : '/tier-list'
    return inertia.render('champions/tier_list', {
      champions: rows.flatMap((r) => {
        const c = byId.get(r.champion)
        return c ? [{ id: c.id, name: c.name, slug: c.slug }] : []
      }),
      rows,
      previousRanks: previous ? ranks : null,
      previousPatch: previous?.patch ?? null,
      ranked: summary?.ranked ?? null,
      games: summary?.games ?? 0,
      position,
      patches,
      filter,
      ...meta({
        title: `${role.label} tier list, patch ${filter?.patch ?? ''}`.trim(),
        description: top
          ? `${rows.length} ${role.label.toLowerCase()} champions ranked from ${count(summary!.games)} ranked games, ${BRACKET_TEXT[filter!.bracket]}, patch ${filter!.patch}. ${top.name} leads at ${percent(rows[0].win)} win rate.`
          : `${role.label} champions ranked from our own ranked games.`,
        path,
        image: `/og/tier-list/${asked ? role.slug : 'all'}.jpg`,
        version: filter?.patch ?? 'none',
        alt: `${role.label} tier list on invade.lol`,
      }),
      robots: !rows.length || (filter && !(await isDefault(filter))) ? 'noindex,follow' : null,
      jsonld: [
        breadcrumbs([
          { name: 'Champions', path: '/champions' },
          { name: `${role.label} tier list`, path },
        ]),
        itemList(
          `${role.label} tier list`,
          rows.slice(0, 50).flatMap((r) => {
            const c = byId.get(r.champion)
            return c ? [{ name: c.name, path: `/champions/${c.slug}?role=${role.slug}` }] : []
          })
        ),
      ],
    })
  }

  /** `/champions/:slug/:tab?role=bot`: one champion in one role, every section on one page. */
  async show({ inertia, params, request, response }: HttpContext) {
    const champion = await championStatsService.champion(String(params.slug))
    if (!champion) return response.notFound()
    const tab = (params.tab ?? 'build') as ChampionTab
    if (!CHAMPION_TABS.some((t) => t.key === tab)) return response.notFound()

    const filter = await championStatsService.filter(request.qs())
    const asked = positionOf(request.input('role'))
    // The blocks load one by one: a partial reload asks for those still missing.
    const partial = Boolean(request.header('x-inertia-partial-data'))
    // A role in the address needs no summary first: the blocks load alongside it.
    const early = filter && asked ? this.blocks(filter, champion.id, asked) : null
    if (early && !partial) for (const load of Object.values(early)) void load()
    const [summary, previous, patches, champions] = await Promise.all([
      filter ? championStatsService.summary(filter).catch(() => null) : null,
      filter ? championStatsService.previous(filter).catch(() => null) : null,
      championStatsService.patches(),
      championStatsService.champions(),
    ])
    const mine = (summary?.roles ?? []).filter((r) => r.champion === champion.id)
    const main = [...mine].sort((a, b) => b.games - a.games)[0]?.position ?? null
    const position: Position = asked ?? main ?? 'MIDDLE'
    const stat = mine.find((r) => r.position === position) ?? null
    const was = previous?.roles.find((r) => r.champion === champion.id && r.position === position)

    const late: Record<string, unknown> = {}
    let data: Record<string, unknown> | null = null
    if (filter) {
      const blocks = early ?? this.blocks(filter, champion.id, position)
      const first = Object.fromEntries(
        Object.entries(blocks).filter(([k]) => !(LOWER as readonly string[]).includes(k))
      )
      const { ready, waiting } = partial
        ? { ready: {}, waiting: Object.keys(first) }
        : await settle(first, READY_MS)
      data = ready
      for (const k of waiting) late[k] = inertia.defer(blocks[k], BLOCK_GROUP[k] ?? k)
      for (const k of LOWER) late[k] = inertia.defer(blocks[k], 'lower')
    }
    const labels = data ? await labelsOf(data).catch(() => null) : null

    const role = ROLE_OF[position]
    const isMain = position === main || !main
    const path = `/champions/${champion.slug}${isMain ? '' : `?role=${role.slug}`}`
    const sample = stat ? `${count(stat.games)} games` : 'few games'
    return inertia.render('champions/show', {
      ...late,
      champion: entryOf(champion),
      section: tab === 'build' ? null : tab,
      position,
      main,
      roles: POSITIONS.map((p) => mine.find((r) => r.position === p))
        .filter(Boolean)
        .map((r) => ({ position: r!.position, games: r!.games, roleShare: r!.roleShare })),
      stat,
      before: was ? { win: was.win, pick: was.pick, rank: was.rank } : null,
      previousPatch: previous?.patch ?? null,
      ranked: summary?.ranked[position] ?? 0,
      games: summary?.games ?? 0,
      patches,
      filter,
      data,
      labels,
      names: Object.fromEntries(champions.map((c) => [c.id, [c.name, c.slug]])),
      ...meta({
        title: `${champion.name} ${role.label.toLowerCase()} build, runes and counters${stat ? `, ${percent(stat.win)} win rate` : ''}`,
        description: stat
          ? `${champion.name} ${role.label.toLowerCase()} on patch ${filter!.patch}, ${BRACKET_TEXT[filter!.bracket]}: ${percent(stat.win)} win rate, ${percent(stat.pick)} pick rate, ${percent(stat.ban)} ban rate over ${sample}. Build, runes, skill order, counters and pro games.`
          : `${champion.name}'s build, runes, matchups and statistics from our own ranked games.`,
        path,
        image: `/og/champion/${champion.slug}/${role.slug}.jpg`,
        version: filter?.patch ?? 'none',
        alt: `${champion.name} ${role.label.toLowerCase()} on invade.lol`,
      }),
      robots:
        !stat || stat.games < 100 || (filter && !(await isDefault(filter)))
          ? 'noindex,follow'
          : null,
      jsonld: [
        breadcrumbs([
          { name: 'Champions', path: '/champions' },
          { name: `${role.label} tier list`, path: `/tier-list?role=${role.slug}` },
          { name: champion.name, path },
        ]),
      ],
    })
  }

  /** Every block of a champion's page, each loaded once whoever asks first (`onceEach`). */
  private blocks(filter: Filter, champion: number, position: Position) {
    const role = SERVICE_ROLE[position]
    return onceEach({
      build: () => buildStatsService.forRole(champion, role, filter.bracket, filter.patch),
      runes: () => runeStatsService.forRole(champion, role, filter.bracket, filter.patch),
      spells: () => spellStatsService.forRole(champion, role, filter.bracket, filter.patch),
      skills: () => championStatsService.skills(filter, champion, position),
      matchups: () => championStatsService.matchups(filter, champion, position),
      teammates: () => championStatsService.teammates(filter, champion, position),
      trees: () => riotAssetsService.runeTrees(),
      profile: () => championStatsService.profile(filter, champion, position),
      trend: () => championStatsService.trend(filter, champion, position),
      early: () => championStatsService.early(filter, champion, position),
      firstBlood: () => championStatsService.firstBlood(filter, champion, position),
      byRank: () => championStatsService.byRank(filter, champion, position),
      details: () => championStatsService.details(filter, champion, position),
      pros: async () => {
        const found = await proService.championGames(champion, position)
        return {
          games: found.games.map(({ opponentPuuid: _o, skillOrder: _s, ...g }) => {
            const league = leagueOfTeam(g.pro?.team?.slug)
            return { ...g, league: league ? leagueRef(league) : null }
          }),
          players: found.players,
        }
      },
    })
  }
}
