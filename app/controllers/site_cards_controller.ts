import { createHash } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import championStatsService, { DEFAULT_BRACKET } from '#services/champion_stats_service'
import { POSITIONS, ROLE_OF, positionOf, type Position } from '#services/champion_stats'
import homeService from '#services/home_service'
import proLadderService from '#services/pro_ladder_service'
import { leagueCatalog } from '#services/pro_leagues'
import proService from '#services/pro_service'
import riotAssets from '#services/riot/assets'
import teamLogoService from '#services/team_logo_service'
import {
  RENDERER,
  championCard,
  figureCard,
  homeCard,
  logoCard,
  tierListCard,
  type CardRole,
} from '#services/site_card'
import { ByteCache } from '#utils/byte_cache'

/**
 * The share cards of the site's pages (`site_card`), at fixed addresses the pages link with a
 * `?v=` (a patch or a day): `/og/home.jpg`, `/og/champion/<slug>/<role>.jpg`,
 * `/og/tier-list/<role>.jpg`, `/og/stats/<view>.jpg`, `/og/pros/<league>.jpg`, `/og/pro/<slug>.jpg`,
 * `/og/team/<slug>.jpg`. Each reads its figures from the services the pages read, and an
 * unknown slug, role or view is a 404. The bytes are kept in memory an hour, keyed by what they
 * draw, and sent with an ETag.
 */

/** About 90 KB a card: some 500 cards stay in memory. */
const cards = new ByteCache<{ body: Buffer; etag: string }>(48 * 1024 * 1024, 1024)
const pending = new Map<string, Promise<Rendered | null>>()
const HOUR = 3_600_000

interface Rendered {
  body: Buffer
  etag: string
  /** False when the art could not be read: the card is still sent, but not kept. */
  complete: boolean
}

/** Renders at once: a link pasted in a busy channel brings many crawlers. */
const RENDERS = 2
let running = 0
const waiting: Array<() => void> = []
async function limited<T>(work: () => Promise<T>): Promise<T> {
  if (running >= RENDERS) await new Promise<void>((resolve) => waiting.push(resolve))
  running++
  try {
    return await work()
  } finally {
    running--
    waiting.shift()?.()
  }
}

const CARD_ROLE: Record<Position, CardRole> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MIDDLE: 'mid',
  BOTTOM: 'bot',
  UTILITY: 'support',
}

const STATS_VIEWS = {
  all: 'Champion stats',
  early: 'Early game',
  length: 'Game length',
  firstblood: 'First blood',
  items: 'Items',
  regions: 'Regions',
  patch: 'Patch',
} as const
type StatsView = keyof typeof STATS_VIEWS

/** `mid.jpg` → `mid`; anything else is not a card. */
const nameOf = (file: unknown) => /^([\w-]{1,64})\.jpg$/i.exec(String(file ?? ''))?.[1] ?? null

/** A role of the address: `all`, the site's (`mid`) or the API's (`MIDDLE`), any case. */
function roleOf(name: string | null): Position | 'all' | null {
  if (!name) return null
  if (name.toLowerCase() === 'all') return 'all'
  return positionOf(name)
}

async function art(kind: 'centered' | 'champion', id: number) {
  const asset = await riotAssets.get(kind, String(id)).catch(() => null)
  return asset && !asset.placeholder ? asset.body : undefined
}

async function filter() {
  const f = await championStatsService.filter({ rank: DEFAULT_BRACKET })
  return f && { ...f, region: null }
}

const compact = (n: number) =>
  n >= 999_950
    ? `${(n / 1_000_000).toFixed(1)}m`
    : n >= 9_950
      ? `${Math.round(n / 1000)}k`
      : n.toLocaleString('en-US')

export default class SiteCardsController {
  /** `/og/home.jpg` */
  async home(ctx: HttpContext) {
    return this.send(ctx, 'home', async () => {
      const picks = await homeService.picks()
      const mid = picks?.best.find((b) => b.position === 'MIDDLE') ?? picks?.best[0]
      const splash = mid ? await art('centered', mid.championId) : undefined
      return {
        body: await homeCard({ patch: picks?.patch ?? null }, splash),
        complete: Boolean(splash) || !mid,
      }
    })
  }

  /** `/og/champion/<slug>/<role>.jpg` */
  async champion(ctx: HttpContext) {
    const role = roleOf(nameOf(ctx.params.file))
    const champion = await championStatsService.champion(String(ctx.params.slug))
    if (!champion || !role || role === 'all') return this.missing(ctx)
    const f = await filter()
    if (!f) return this.missing(ctx)
    const summary = await championStatsService.summary(f)
    const stat = summary.roles.find((r) => r.champion === champion.id && r.position === role)
    const key = `champion:${champion.id}:${role}:${f.patch}:${stat?.tier}:${stat?.win}`
    return this.send(ctx, key, async () => {
      const splash = await art('centered', champion.id)
      const body = await championCard(
        {
          name: champion.name,
          role: CARD_ROLE[role],
          roleLabel: ROLE_OF[role].label,
          patch: f.patch,
          tier: stat?.tier ?? null,
          rank: stat?.rank ?? null,
          winRate: stat && stat.games >= 100 ? stat.win : null,
        },
        splash
      )
      return { body, complete: Boolean(splash) }
    })
  }

  /** `/og/tier-list/<role>.jpg`: the first five of the role, or the best pick of each role. */
  async tierList(ctx: HttpContext) {
    const role = roleOf(nameOf(ctx.params.file))
    if (!role) return this.missing(ctx)
    const f = await filter()
    if (!f) return this.missing(ctx)
    const summary = await championStatsService.summary(f)
    const ranked = (position: Position) =>
      summary.roles
        .filter((r) => r.position === position && r.rank)
        .sort((a, b) => a.rank! - b.rank!)
    const top =
      role === 'all' ? POSITIONS.flatMap((p) => ranked(p).slice(0, 1)) : ranked(role).slice(0, 5)
    const key = `tier:${role}:${f.patch}:${top.map((r) => `${r.champion}${r.tier}`).join(',')}`
    return this.send(ctx, key, async () => {
      const [splash, ...icons] = await Promise.all([
        top[0] ? art('centered', top[0].champion) : undefined,
        ...top.map((r) => art('champion', r.champion)),
      ])
      const body = await tierListCard(
        {
          title: role === 'all' ? 'Tier list' : `${ROLE_OF[role].label} tier list`,
          patch: f.patch,
          champions: top.map((r, i) => ({
            image: icons[i],
            tier: r.tier,
            role: role === 'all' ? CARD_ROLE[r.position] : undefined,
          })),
        },
        splash
      )
      return { body, complete: Boolean(splash) || !top.length }
    })
  }

  /** `/og/stats/<view>.jpg`: the view's name and the figure it leads with. */
  async stats(ctx: HttpContext) {
    const view = nameOf(ctx.params.file)?.toLowerCase() as StatsView | undefined
    if (!view || !(view in STATS_VIEWS)) return this.missing(ctx)
    const [picks, lanes] = await Promise.all([
      homeService.picks(),
      view === 'early' || view === 'firstblood' ? homeService.lanes() : null,
    ])
    if (!picks) return this.missing(ctx)
    const kicker = `Patch ${picks.patch}, Emerald and above`
    let card = {
      kicker,
      title: STATS_VIEWS[view] as string,
      value: compact(picks.games),
      label: 'Ranked games',
      champion: picks.best.find((b) => b.position === 'MIDDLE')?.championId ?? null,
    }
    const bully = lanes?.bullies[0]
    const first = lanes?.firstBlood[0]
    const climber = picks.climbers[0]
    if (view === 'early' && bully) {
      card = {
        ...card,
        value: `+${Math.round(bully.value)}`,
        label: `${bully.name}, gold ahead at 10 min`,
        champion: bully.championId,
      }
    } else if (view === 'firstblood' && first) {
      card = {
        ...card,
        value: `${(first.value * 100).toFixed(1)}%`,
        label: `${first.name}, in on first blood`,
        champion: first.championId,
      }
    } else if (view === 'patch') {
      card = climber
        ? {
            ...card,
            title: `Patch ${picks.patch}`,
            kicker: `Since ${picks.previousPatch}, Emerald and above`,
            value: `#${climber.to}`,
            label: `${climber.name}, up from #${climber.from}`,
            champion: climber.championId,
          }
        : { ...card, title: `Patch ${picks.patch}` }
    }
    const key = `stats:${view}:${card.value}:${card.label}:${card.champion}`
    return this.send(ctx, key, async () => {
      const splash = card.champion ? await art('centered', card.champion) : undefined
      const body = await figureCard(card, splash)
      return { body, complete: Boolean(splash) || !card.champion }
    })
  }

  /** `/og/pros/<league>.jpg`: the pros directory (`all`), or one league with its logo. */
  async pros(ctx: HttpContext) {
    const name = nameOf(ctx.params.file)?.toLowerCase()
    if (name !== 'all') return this.league(ctx, name)
    const pros = await homeService.pros()
    if (!pros?.counts) return this.missing(ctx)
    const lead = pros.top.find((p) => p.team)
    const key = `pros:all:${pros.counts.players}:${lead?.team?.id ?? ''}`
    return this.send(ctx, key, async () => {
      const image = lead?.team ? await teamLogoService.get(lead.team.id).catch(() => null) : null
      const body = await logoCard(
        {
          kicker: `${pros.counts!.teams.toLocaleString('en-US')} teams, ${pros.counts!.accounts.toLocaleString('en-US')} accounts`,
          title: 'Pro players',
          value: pros.counts!.players.toLocaleString('en-US'),
          label: 'players',
          short: '',
        },
        image?.body
      )
      return { body, complete: true }
    })
  }

  /** `/og/pros/<league>.jpg` for a league: its logo, its teams and how many of its pros rank. */
  private async league(ctx: HttpContext, slug: string | undefined) {
    const leagues = await leagueCatalog()
    const league = leagues.bySlug(slug)
    if (!league?.teams.length) return this.missing(ctx)
    const ladderOf = await proLadderService
      .ladder({ league: league.slug, limit: 1, apexOnly: false })
      .catch(() => null)
    if (!ladderOf) return this.missing(ctx)
    const key = `pros:${league.slug}:${league.teams.length}:${ladderOf.total}`
    return this.send(ctx, key, async () => {
      const image = await teamLogoService.league(league.slug).catch(() => null)
      const body = await logoCard(
        {
          kicker: `${league.name}, ${league.teams.length} teams`,
          title: league.code,
          value: ladderOf.total.toLocaleString('en-US'),
          label: 'ranked players',
          short: league.code,
        },
        image?.body
      )
      return { body, complete: Boolean(image) }
    })
  }

  /** `/og/pro/<slug>.jpg`: the pro, their team's logo, their best account's LP. */
  async pro(ctx: HttpContext) {
    const slug = nameOf(ctx.params.file)
    const pro = slug ? await proService.player(slug).catch(() => null) : null
    if (!pro) return this.missing(ctx)
    const best = pro.accounts.find((a: { tier: string | null }) => a.tier) ?? null
    const role = pro.role ? positionOf(pro.role) : null
    const apex = best?.tier && ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(best.tier)
    const tierName = best?.tier
      ? `${best.tier.charAt(0)}${best.tier.slice(1).toLowerCase()}${apex || !best.division ? '' : ` ${['', 'I', 'II', 'III', 'IV'][best.division] ?? ''}`}`
      : null
    const key = `pro:${pro.slug}:${pro.team?.id ?? ''}:${best?.tier}:${best?.lp}`
    return this.send(ctx, key, async () => {
      const image = pro.team ? await teamLogoService.get(pro.team.id).catch(() => null) : null
      const body = await logoCard(
        {
          kicker:
            [pro.team?.name, role ? ROLE_OF[role].label : null].filter(Boolean).join(', ') ||
            'Pro player',
          title: pro.name,
          value:
            best?.lp !== null && best?.lp !== undefined
              ? best.lp.toLocaleString('en-US')
              : undefined,
          label: best?.lp !== null && best?.lp !== undefined ? 'LP' : undefined,
          tier: tierName,
          short: pro.team?.shortName ?? pro.name.slice(0, 3).toUpperCase(),
        },
        image?.body
      )
      return { body, complete: true }
    })
  }

  /** `/og/team/<slug>.jpg`: the team's logo, its name and its players. */
  async team(ctx: HttpContext) {
    const slug = nameOf(ctx.params.file)
    const team = slug ? await proService.team(slug).catch(() => null) : null
    if (!team) return this.missing(ctx)
    const players = team.roster
      .filter((m: { current: boolean; title: string | null }) => m.current && m.title !== 'staff')
      .filter((m: { role: string | null }) => !m.role || positionOf(m.role) !== null)
      .slice(0, 5)
      .map((m: { name: string; role: string | null }) => {
        const p = m.role ? positionOf(m.role) : null
        return { name: m.name, role: p ? CARD_ROLE[p] : null }
      })
    const key = `team:${team.slug}:${players.map((p: { name: string }) => p.name).join(',')}`
    return this.send(ctx, key, async () => {
      const image = await teamLogoService.get(team.id).catch(() => null)
      const body = await logoCard(
        {
          kicker: [team.region, `${players.length} players`].filter(Boolean).join(', '),
          title: team.name,
          roster: players,
          short: team.shortName ?? team.name.slice(0, 3).toUpperCase(),
        },
        image?.body
      )
      return { body, complete: true }
    })
  }

  private missing({ response }: HttpContext) {
    response.header('Cache-Control', 'public, max-age=60')
    return response.notFound()
  }

  /** The card under `key`: from memory, or rendered once whoever asks first, with its ETag. */
  private async send(
    { request, response }: HttpContext,
    key: string,
    render: () => Promise<{ body: Buffer; complete: boolean }>
  ) {
    const full = `${RENDERER}:${key}`
    let card: { body: Buffer; etag: string; complete: boolean } | null | undefined = cards.get(full)
      ? { ...cards.get(full)!, complete: true }
      : undefined
    if (!card) {
      let job = pending.get(full)
      if (!job) {
        job = limited(async () => {
          const out = await render()
          const etag = `"${createHash('sha1').update(out.body).digest('base64url').slice(0, 16)}"`
          if (out.complete) cards.set(full, { body: out.body, etag }, out.body.byteLength, HOUR)
          return { ...out, etag }
        })
          .catch((error) => {
            logger.warn({ err: error, card: key }, 'share card failed')
            return null
          })
          .finally(() => pending.delete(full))
        pending.set(full, job)
      }
      card = await job
    }
    if (!card) return response.internalServerError()
    response.header('Content-Type', 'image/jpeg')
    response.header('ETag', card.etag)
    response.header(
      'Cache-Control',
      card.complete ? 'public, max-age=86400, stale-while-revalidate=604800' : 'public, max-age=300'
    )
    if (request.header('if-none-match') === card.etag) return response.status(304).send('')
    return response.send(card.body)
  }
}
