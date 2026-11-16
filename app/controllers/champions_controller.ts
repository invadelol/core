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
import { leagueCatalog, leagueRef } from '#services/pro_leagues'
import {
  BRACKET_TEXT,
  breadcrumbs,
  count,
  itemList,
  meta,
  notFoundPage,
  percent,
} from '#services/page_meta'
import statsExplorerService from '#services/stats_explorer_service'
import { log5 } from '#services/matchup_stats'
import { CHAMPION_TABS, type ChampionTab } from '../../inertia/lib/champions.js'
import { patchText } from '../../inertia/lib/patches.js'

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
  /**
   * `/champions`: the old directory of every champion. Champions are reached from the tier list
   * now, so the address leads there, with its role.
   */
  async index({ request, response }: HttpContext) {
    const role = positionOf(request.input('role'))
    return response.redirect(`/tier-list${role ? `?role=${ROLE_OF[role].slug}` : ''}`, false, 301)
  }

  /**
   * `/tier-list?role=bot`: one role's champions ranked (every role without `role`), each with its
   * place on the patch (or range) before and its last two weeks' win rate.
   */
  async tierList({ inertia, request }: HttpContext) {
    const asked = positionOf(request.input('role'))
    const filter = await championStatsService.filter(request.qs())
    const [champions, summary, previous, patches] = await Promise.all([
      championStatsService.champions(),
      filter ? championStatsService.summary(filter).catch(() => null) : null,
      filter ? championStatsService.previous(filter).catch(() => null) : null,
      championStatsService.patches(),
    ])
    const before = new Map<string, number>()
    for (const r of previous?.roles ?? []) {
      if (r.rank) before.set(`${r.champion}:${r.position}`, r.rank)
    }
    const ranked = summary?.ranked ?? null
    // Every role: each role's champions by tier, then by their place in the role.
    const rows = (summary?.roles ?? [])
      .filter((r) => r.rank && (!asked || r.position === asked))
      .sort(
        (a, b) =>
          (a.tier ?? 9) - (b.tier ?? 9) ||
          a.rank! / (ranked?.[a.position] || 1) - b.rank! / (ranked?.[b.position] || 1)
      )
      .map((r) => ({
        champion: r.champion,
        position: r.position,
        games: r.games,
        win: r.win,
        pick: r.pick,
        ban: r.ban,
        roleShare: r.roleShare,
        tier: r.tier,
        rank: r.rank,
        before: previous ? (before.get(`${r.champion}:${r.position}`) ?? null) : null,
      }))
    const byId = new Map(champions.map((c) => [c.id, c]))
    const role = asked ? ROLE_OF[asked] : null
    const label = role?.label ?? 'Champion'
    const top = rows[0] ? byId.get(rows[0].champion) : null
    const path = role ? `/tier-list?role=${role.slug}` : '/tier-list'
    const ids = [...new Set(rows.map((r) => r.champion))]
    return inertia.render('champions/tier_list', {
      // Each role's last two weeks, once the background has read them (null until then).
      trends: inertia.defer(async () => {
        if (!filter) return null
        const roles = asked ? [asked] : POSITIONS
        const found = await Promise.all(
          roles.map((p) => championStatsService.roleTrendIfReady(filter, p).catch(() => null))
        )
        return Object.fromEntries(roles.map((p, i) => [p, found[i]]))
      }, 'extras'),
      champions: ids.flatMap((id) => {
        const c = byId.get(id)
        return c ? [{ id: c.id, name: c.name, slug: c.slug }] : []
      }),
      rows,
      previousPatch: previous?.patch ?? null,
      ranked,
      games: summary?.games ?? 0,
      position: asked,
      patches,
      filter,
      ...meta({
        title: `${label} tier list${filter ? `, ${patchText(filter.patch)}` : ''}`,
        description: top
          ? `${rows.length} ${role ? `${role.label.toLowerCase()} champions` : 'champions in every role'} ranked from ${count(summary!.games)} ranked games, ${BRACKET_TEXT[filter!.bracket]}, ${patchText(filter!.patch)}. ${top.name} leads at ${percent(rows[0].win)} win rate.`
          : `${label} tier list from our own ranked games.`,
        path,
        image: `/og/tier-list/${role ? role.slug : 'all'}.jpg`,
        version: filter?.patch ?? 'none',
        alt: `${label} tier list on invade.lol`,
      }),
      robots: !rows.length || (filter && !(await isDefault(filter))) ? 'noindex,follow' : null,
      jsonld: [
        breadcrumbs([
          { name: 'Tier list', path: '/tier-list' },
          ...(role ? [{ name: role.label, path }] : []),
        ]),
        itemList(
          `${label} tier list`,
          rows.slice(0, 50).flatMap((r) => {
            const c = byId.get(r.champion)
            return c
              ? [{ name: c.name, path: `/champions/${c.slug}?role=${ROLE_OF[r.position].slug}` }]
              : []
          })
        ),
      ],
    })
  }

  /** `/champions/:slug/:tab?role=bot`: one champion in one role, every section on one page. */
  async show({ inertia, params, request, response }: HttpContext) {
    const champion = await championStatsService.champion(String(params.slug))
    const tab = (params.tab ?? 'build') as ChampionTab
    if (!champion || !CHAMPION_TABS.some((t) => t.key === tab)) {
      return notFoundPage({ inertia, response })
    }

    const filter = await championStatsService.filter(request.qs())
    const asked = positionOf(request.input('role'))
    // The blocks load one by one: a partial reload asks for those still missing.
    const partial = Boolean(request.header('x-inertia-partial-data'))
    // A role in the address needs no summary first: the blocks load alongside it.
    const early = filter && asked ? this.blocks(filter, champion.id, asked) : null
    if (early && !partial) for (const load of Object.values(early)) void load()
    const [summary, previous, patches, champions, text] = await Promise.all([
      filter ? championStatsService.summary(filter).catch(() => null) : null,
      filter ? championStatsService.previous(filter).catch(() => null) : null,
      championStatsService.patches(),
      championStatsService.champions(),
      riotAssetsService.championText(String(champion.id)).catch(() => null),
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
    const [labels, updatedAt] = await Promise.all([
      data ? labelsOf(data).catch(() => null) : null,
      filter ? statsExplorerService.updatedAt(filter.patch).catch(() => null) : null,
    ])

    const role = ROLE_OF[position]
    const isMain = position === main || !main
    const path = `/champions/${champion.slug}${isMain ? '' : `?role=${role.slug}`}`
    const sample = stat ? `${count(stat.games)} games` : 'few games'
    return inertia.render('champions/show', {
      ...late,
      champion: entryOf(champion),
      // Its title and the names of its passive and abilities (Community Dragon), null when unknown.
      text,
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
      updatedAt,
      now: Date.now(),
      names: Object.fromEntries(champions.map((c) => [c.id, [c.name, c.slug]])),
      ...meta({
        title: `${champion.name} ${role.label.toLowerCase()} build, runes and counters${stat ? `, ${percent(stat.win)} win rate` : ''}`,
        description: stat
          ? `${champion.name} ${role.label.toLowerCase()} on ${patchText(filter!.patch)}, ${BRACKET_TEXT[filter!.bracket]}: ${percent(stat.win)} win rate, ${percent(stat.pick)} pick rate, ${percent(stat.ban)} ban rate over ${sample}. Build, runes, skill order, counters and pro games.`
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
          { name: 'Tier list', path: '/tier-list' },
          { name: role.label, path: `/tier-list?role=${role.slug}` },
          { name: champion.name, path },
        ]),
      ],
    })
  }

  /**
   * `/champions/:slug/matchups/:opponent?role=mid`: one lane matchup, the two champions side by
   * side. The pair's own record comes from the first champion's lane opponents (its Matchups
   * tab); the rest is each champion's own page in the role, against every opponent.
   */
  async matchup({ inertia, params, request, response }: HttpContext) {
    const [champion, opponent] = await Promise.all([
      championStatsService.champion(String(params.slug)),
      championStatsService.champion(String(params.opponent)),
    ])
    if (!champion || !opponent || champion.id === opponent.id) {
      return notFoundPage({ inertia, response })
    }
    const filter = await championStatsService.filter(request.qs())
    const asked = positionOf(request.input('role'))
    const [summary, patches, champions] = await Promise.all([
      filter ? championStatsService.summary(filter).catch(() => null) : null,
      championStatsService.patches(),
      championStatsService.champions(),
    ])
    const of = (id: number) => (summary?.roles ?? []).filter((r) => r.champion === id)
    const main = [...of(champion.id)].sort((a, b) => b.games - a.games)[0]?.position ?? null
    const position: Position = asked ?? main ?? 'MIDDLE'
    const stat = of(champion.id).find((r) => r.position === position) ?? null
    const theirs = of(opponent.id).find((r) => r.position === position) ?? null

    // Each side loads once; what the cache holds within a short wait comes with the page.
    const sides = onceEach(
      filter
        ? {
            mine: () => this.side(filter, champion.id, position, opponent.id),
            theirs: () => this.side(filter, opponent.id, position, champion.id),
          }
        : {}
    )
    const partial = Boolean(request.header('x-inertia-partial-data'))
    const { ready, waiting } = partial
      ? { ready: {}, waiting: Object.keys(sides) }
      : await settle(sides, READY_MS)
    const late: Record<string, unknown> = {}
    for (const k of waiting) late[k] = inertia.defer(sides[k], 'sides')

    const role = ROLE_OF[position]
    const isMain = position === main || !main
    const path = `/champions/${champion.slug}/matchups/${opponent.slug}${isMain ? '' : `?role=${role.slug}`}`
    const title = `${champion.name} vs ${opponent.name}, ${role.label.toLowerCase()}`
    return inertia.render('champions/matchup', {
      ...ready,
      ...late,
      champion: entryOf(champion),
      opponent: entryOf(opponent),
      position,
      main,
      stat,
      opponentStat: theirs,
      // What the two win rates alone predict for the pair (log5), to set its record against.
      expected: stat && theirs ? log5(stat.win, theirs.win) : null,
      ranked: summary?.ranked[position] ?? 0,
      games: summary?.games ?? 0,
      patches,
      filter,
      names: Object.fromEntries(champions.map((c) => [c.id, [c.name, c.slug]])),
      ...meta({
        title,
        description: `${champion.name} against ${opponent.name} in the ${role.label.toLowerCase()} lane${filter ? ` on ${patchText(filter.patch)}, ${BRACKET_TEXT[filter.bracket]}` : ''}: their win rate together, both champions side by side and their builds.`,
        path,
        image: `/og/champion/${champion.slug}/${role.slug}.jpg`,
        version: filter?.patch ?? 'none',
        alt: `${title} on invade.lol`,
      }),
      robots: !stat || !theirs || !filter || !(await isDefault(filter)) ? 'noindex,follow' : null,
      jsonld: [
        breadcrumbs([
          { name: 'Tier list', path: '/tier-list' },
          { name: champion.name, path: `/champions/${champion.slug}` },
          { name: `Against ${opponent.name}`, path },
        ]),
      ],
    })
  }

  /**
   * One side of a matchup: the champion's own page in the role (its averages, early game, first
   * blood, most played runes, spells, build and skill order) and its lane opponents, with its
   * record against `against`.
   */
  private async side(filter: Filter, champion: number, position: Position, against: number) {
    const role = SERVICE_ROLE[position]
    const settled = <T>(p: Promise<T>) => p.catch(() => null)
    const [profile, early, firstBlood, runes, spells, build, skills, matchups] = await Promise.all([
      settled(championStatsService.profile(filter, champion, position)),
      settled(championStatsService.early(filter, champion, position)),
      settled(championStatsService.firstBlood(filter, champion, position)),
      settled(runeStatsService.forRole(champion, role, filter.bracket, filter.patch)),
      settled(spellStatsService.forRole(champion, role, filter.bracket, filter.patch)),
      settled(buildStatsService.forRole(champion, role, filter.bracket, filter.patch)),
      settled(championStatsService.skills(filter, champion, position)),
      settled(championStatsService.matchups(filter, champion, position)),
    ])
    const data = {
      averages: profile?.averages ?? null,
      length: profile?.length ?? [],
      early,
      firstBlood,
      runes: runes ? { games: runes.games, win: runes.win, page: runes.pages[0] ?? null } : null,
      spells: spells ? { games: spells.games, pair: spells.pairs[0] ?? null } : null,
      build: build
        ? {
            games: build.games,
            starter: build.starters[0] ?? null,
            core: build.cores[0] ?? null,
            boots: build.boots[0] ?? null,
          }
        : null,
      skills: skills
        ? { games: skills.games, max: skills.max, order: skills.orders[0] ?? null }
        : null,
      matchups: matchups ?? [],
      against: matchups?.find((m) => m.champion === against) ?? null,
    }
    const labels = await labelsOf({
      build: data.build && {
        starters: data.build.starter ? [data.build.starter] : [],
        cores: data.build.core ? [data.build.core] : [],
        boots: data.build.boots ? [data.build.boots] : [],
      },
      runes: data.runes?.page && { pages: [data.runes.page] },
      spells: data.spells?.pair && { pairs: [data.spells.pair] },
    }).catch(() => null)
    return { ...data, labels }
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
        const [found, leagues] = await Promise.all([
          proService.championGames(champion, position),
          leagueCatalog(),
        ])
        return {
          games: found.games.map(({ opponentPuuid: _o, skillOrder: _s, ...g }) => {
            const league = leagues.ofTeam(g.pro?.team?.slug)
            return { ...g, league: league ? leagueRef(league) : null }
          }),
          players: found.players,
        }
      },
    })
  }
}
