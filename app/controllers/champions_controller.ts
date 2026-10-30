import type { HttpContext } from '@adonisjs/core/http'
import riotAssetsService from '#services/riot/assets'
import buildStatsService from '#services/build_stats_service'
import runeStatsService from '#services/rune_stats_service'
import spellStatsService from '#services/spell_stats_service'
import championStatsService from '#services/champion_stats_service'
import proService from '#services/pro_service'
import { onceEach, settle } from '#services/page_blocks'
import { POSITIONS, positionOf, type Filter, type Position } from '#services/champion_stats'
import type { Role } from '#services/ranked_stats'
import { CHAMPION_TABS, type ChampionTab } from '../../inertia/lib/champions.js'

/**
 * How long a page waits for its build tab's blocks before it is sent: an answer the stats cache
 * holds comes back well within it. A block still counting then arrives on its own (an Inertia
 * deferred prop), so the page shows what it has instead of waiting for its slowest query.
 */
const READY_MS = 150

/** The build tab's blocks that load together: matchups and teammates are one query. */
const BLOCK_GROUP: Record<string, string> = { matchups: 'lane', teammates: 'lane' }

/** The role names the build, rune and spell services take. */
const SERVICE_ROLE: Record<Position, Role> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MIDDLE: 'mid',
  BOTTOM: 'adc',
  UTILITY: 'support',
}

/** Champion statistics from our own ranked games: the list, the tier list and a champion's page. */
export default class ChampionsController {
  /** `/champions`: every champion with its main role, tier and win rate. */
  async index({ inertia, request }: HttpContext) {
    const filter = await championStatsService.filter(request.qs())
    const [champions, summary, patches] = await Promise.all([
      championStatsService.champions(),
      filter ? championStatsService.summary(filter) : null,
      championStatsService.patches(),
    ])
    return inertia.render('champions/index', {
      champions,
      summary,
      patches,
      filter,
      social: {
        title: 'Champions · invade.lol',
        description:
          'Every League of Legends champion: tier, win rate, pick and ban rate in each role.',
        url: 'https://invade.lol/champions',
      },
    })
  }

  /** `/tier-list?role=bot`: one role's champions ranked, with how each moved since last patch. */
  async tierList({ inertia, request }: HttpContext) {
    const position = positionOf(request.input('role')) ?? 'TOP'
    const filter = await championStatsService.filter(request.qs())
    const [champions, summary, previous, patches] = await Promise.all([
      championStatsService.champions(),
      filter ? championStatsService.summary(filter) : null,
      filter ? championStatsService.previous(filter) : null,
      championStatsService.patches(),
    ])
    const ranks: Record<string, number> = {}
    for (const r of previous?.roles ?? []) {
      if (r.position === position && r.rank) ranks[r.champion] = r.rank
    }
    return inertia.render('champions/tier_list', {
      champions,
      summary,
      previousRanks: previous ? ranks : null,
      previousPatch: previous?.patch ?? null,
      position,
      patches,
      filter,
      social: {
        title: 'Tier list · invade.lol',
        description: 'League of Legends tier list from our own ranked games, role by role.',
        url: 'https://invade.lol/tier-list',
      },
    })
  }

  /** `/champions/:slug/:tab?role=bot`: one champion in one role. */
  async show({ inertia, params, request, response }: HttpContext) {
    const champion = await championStatsService.champion(String(params.slug))
    if (!champion) return response.notFound()
    const tab = (params.tab ?? 'build') as ChampionTab
    if (!CHAMPION_TABS.some((t) => t.key === tab)) return response.notFound()

    const filter = await championStatsService.filter(request.qs())
    const asked = positionOf(request.input('role'))
    // The build tab's blocks load one by one: a partial reload asks for those still missing.
    const partial = tab === 'build' && Boolean(request.header('x-inertia-partial-data'))
    // A role in the address needs no summary first: the tab loads alongside it.
    const earlyBlocks =
      filter && asked && tab === 'build' ? this.blocks(filter, champion.id, asked) : null
    if (earlyBlocks && !partial) for (const load of Object.values(earlyBlocks)) void load()
    const early =
      filter && asked && tab !== 'build'
        ? this.tab(tab, filter, champion.id, asked).catch(() => null)
        : null
    const [summary, patches] = await Promise.all([
      filter ? championStatsService.summary(filter) : null,
      championStatsService.patches(),
    ])
    const mine = (summary?.roles ?? []).filter((r) => r.champion === champion.id)
    const main = [...mine].sort((a, b) => b.games - a.games)[0]?.position ?? null
    const position: Position = asked ?? main ?? 'MIDDLE'
    const stat = mine.find((r) => r.position === position) ?? null

    let data: Record<string, unknown> | null = null
    const late: Record<string, unknown> = {}
    if (filter && tab === 'build') {
      const blocks = earlyBlocks ?? this.blocks(filter, champion.id, position)
      const { ready, waiting } = partial
        ? { ready: {}, waiting: Object.keys(blocks) }
        : await settle(blocks, READY_MS)
      data = ready
      for (const key of waiting) late[key] = inertia.defer(blocks[key], BLOCK_GROUP[key] ?? key)
    } else if (filter) {
      data =
        (await (early ?? this.tab(tab, filter, champion.id, position).catch(() => null))) ?? null
    }
    return inertia.render('champions/show', {
      ...late,
      champion,
      tab,
      position,
      roles: POSITIONS.map((p) => mine.find((r) => r.position === p)).filter(Boolean),
      stat,
      ranked: summary?.ranked[position] ?? 0,
      games: summary?.games ?? 0,
      patches,
      filter,
      data,
      social: {
        title: `${champion.name} ${tab === 'build' ? 'build' : tab} · invade.lol`,
        description: `${champion.name}'s build, runes, matchups and statistics from our own ranked games.`,
        url: `https://invade.lol/champions/${champion.slug}${tab === 'build' ? '' : `/${tab}`}`,
      },
    })
  }

  /** The build tab's blocks, each loaded once whoever asks first (`onceEach`). */
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
    })
  }

  /** What one of the other tabs shows (the build tab is `blocks`). */
  private async tab(tab: ChampionTab, filter: Filter, champion: number, position: Position) {
    const role = SERVICE_ROLE[position]
    const build = () => buildStatsService.forRole(champion, role, filter.bracket, filter.patch)
    const runes = () => runeStatsService.forRole(champion, role, filter.bracket, filter.patch)
    switch (tab) {
      case 'runes': {
        const [r, trees] = await Promise.all([runes(), riotAssetsService.runeTrees()])
        return { runes: r, trees }
      }
      case 'items':
        return { build: await build() }
      case 'matchups': {
        const [matchups, teammates] = await Promise.all([
          championStatsService.matchups(filter, champion, position),
          championStatsService.teammates(filter, champion, position),
        ])
        return { matchups, teammates }
      }
      case 'statistics': {
        const [byRank, trend, profile] = await Promise.all([
          championStatsService.byRank(filter, champion, position),
          championStatsService.trend(filter, champion, position),
          championStatsService.profile(filter, champion, position),
        ])
        return { byRank, trend, ...profile }
      }
      case 'pros':
        return proService.championGames(champion, position)
    }
  }
}
