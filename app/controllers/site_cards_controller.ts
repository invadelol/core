import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import championStatsService, { DEFAULT_BRACKET } from '#services/champion_stats_service'
import { POSITIONS, ROLE_OF, positionOf, type Position } from '#services/champion_stats'
import homeService from '#services/home_service'
import ladderService from '#services/ladder_service'
import patchNotesService, { PATCH_NAME } from '#services/patch_notes_service'
import proLadderService from '#services/pro_ladder_service'
import { leagueCatalog } from '#services/pro_leagues'
import proMatchService from '#services/pro_match_service'
import proPhotoService from '#services/pro_photo_service'
import proService from '#services/pro_service'
import playerInsightsService from '#services/player_insights_service'
import riotAssets from '#services/riot/assets'
import summonerService from '#services/summoner_service'
import teamLogoService, { forDarkWell } from '#services/team_logo_service'
import tierListsService from '#services/tier_lists_service'
import { desktopReleases } from '#services/desktop_release'
import { BRACKET_TEXT } from '#services/page_meta'
import { C, RENDERER, type Mood, type Role, type Run } from '#services/og/kit'
import {
  appCard,
  championCard,
  figureCard,
  homeCard,
  patchCard,
  tierListCard,
  type Tile,
} from '#services/og/site_cards'
import { esportsCard, ladderCard, proCard, prosCard, teamCard } from '#services/og/esports_cards'
import { masteryCard } from '#services/og/game_cards'
import { SERVERS } from '#constants/riot'
import { patchName } from '../../inertia/lib/patch.js'
import { ByteCache } from '#utils/byte_cache'

/**
 * The link previews of the site's pages (`og/`), at fixed addresses the pages link with a `?v=`
 * (a patch or a day): `/og/home.jpg`, `/og/champion/<slug>/<role>.jpg`,
 * `/og/tier-list/<role|items|runes|duos|aram>.jpg`, `/og/stats/<view>.jpg`,
 * `/og/pros/<league>.jpg`, `/og/pro/<slug>.jpg`, `/og/team/<slug>.jpg`,
 * `/og/mastery/<Name-Tag>.jpg`, `/og/leaderboards/<solo|flex|one-tricks>.jpg?region=`,
 * `/og/esports.jpg`, `/og/patch/<version>.jpg`, `/og/app.jpg`. Each reads its figures from the
 * services the pages read, and an unknown slug, role or view is a 404. The bytes are kept in
 * memory an hour, keyed by what they draw, and sent with an ETag.
 */

/** About 100 KB a card: some 500 cards stay in memory. */
const cards = new ByteCache<{ body: Buffer; etag: string }>(48 * 1024 * 1024, 1024)
const pending = new Map<string, Promise<Rendered | null>>()
const HOUR = 3_600_000

interface Rendered {
  body: Buffer
  etag: string
  /** False when the art or the list could not be read: the card is still sent, but not kept. */
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

const CARD_ROLE: Record<Position, Role> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MIDDLE: 'mid',
  BOTTOM: 'bot',
  UTILITY: 'support',
}

/** The pros' roles (`pro_player.role`) as lanes. */
const PRO_ROLE: Record<string, Role> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MID: 'mid',
  ADC: 'bot',
  BOT: 'bot',
  SUPPORT: 'support',
}
const PRO_ROLE_LABEL: Record<Role, string> = {
  top: 'Top',
  jungle: 'Jungle',
  mid: 'Mid',
  bot: 'Bot',
  support: 'Support',
}
const ROMAN = ['', 'I', 'II', 'III', 'IV']

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
const nameOf = (file: unknown) => /^([\w.-]{1,64})\.jpg$/i.exec(String(file ?? ''))?.[1] ?? null

/** A role of the address: `all`, the site's (`mid`) or the API's (`MIDDLE`), any case. */
function roleOf(name: string | null): Position | 'all' | null {
  if (!name) return null
  if (name.toLowerCase() === 'all') return 'all'
  return positionOf(name)
}

type Kind = Parameters<typeof riotAssets.get>[0]
async function art(kind: Kind, id: number | string) {
  const asset = await riotAssets.get(kind, String(id)).catch(() => null)
  return asset && !asset.placeholder ? asset.body : undefined
}

async function teamLogo(id: string | null | undefined) {
  if (!id) return null
  const logo = await teamLogoService.get(id).catch(() => null)
  return logo ? (await forDarkWell(logo).catch(() => logo)).body : null
}

async function leagueLogo(slug: string) {
  const logo = await teamLogoService.league(slug).catch(() => null)
  return logo ? (await forDarkWell(logo).catch(() => logo)).body : null
}

async function proPhoto(slug: string | null | undefined, photo?: string | null) {
  if (!slug || photo === undefined || photo === null) return null
  return (await proPhotoService.get(slug, 240).catch(() => null))?.body ?? null
}

async function filter(bracket = DEFAULT_BRACKET) {
  const f = await championStatsService.filter({ rank: bracket })
  return f && { ...f, region: null }
}

const compact = (n: number) =>
  n >= 999_950
    ? `${(n / 1_000_000).toFixed(1)}m`
    : n >= 9_950
      ? `${Math.round(n / 1000)}k`
      : n.toLocaleString('en-US')

const count = (n: number) => n.toLocaleString('en-US')

/** A list that may still be computing (`tier_lists_service`): its rows, or null. */
function rowsOf<T>(list: unknown): T[] | null {
  return list && typeof list === 'object' && Array.isArray((list as { rows?: unknown }).rows)
    ? ((list as { rows: T[] }).rows as T[])
    : null
}

/** The first `n` ranked rows: by tier, then win rate. */
function best<T extends { tier: number | null; win: number }>(rows: T[], n = 5) {
  return rows
    .filter((r) => r.tier !== null)
    .sort((a, b) => a.tier! - b.tier! || b.win - a.win)
    .slice(0, n)
}

const ladderRegion = (value: unknown) =>
  SERVERS.find((s) => s.slug === String(value ?? '').toLowerCase()) ?? SERVERS[0]

let appShot: Promise<Buffer | null> | null = null
const appScreenshot = () =>
  (appShot ??= readFile(app.makePath('public', 'app-page', 'home-1280.webp')).catch(() => {
    appShot = null
    return null
  }))

export default class SiteCardsController {
  /** `/og/home.jpg` */
  async home(ctx: HttpContext) {
    const picks = await homeService.picks()
    const key = `home:${picks?.patch}:${picks?.games}:${picks?.best.map((b) => b.championId).join(',')}`
    return this.send(ctx, key, async () => {
      const mid = picks?.best.find((b) => b.position === 'MIDDLE') ?? picks?.best[0]
      const byRole = POSITIONS.map((p) => picks?.best.find((b) => b.position === p)).filter(
        (b): b is NonNullable<typeof b> => Boolean(b)
      )
      const [splash, ...icons] = await Promise.all([
        mid ? art('centered', mid.championId) : undefined,
        ...byRole.map((b) => art('champion', b.championId)),
      ])
      const body = await homeCard({
        patch: picks?.patch ? patchName(picks.patch) : null,
        games: picks?.games ?? null,
        splash,
        picks: byRole.map((b, i) => ({ art: icons[i], role: CARD_ROLE[b.position as Position] })),
      })
      return { body, complete: Boolean(splash) || !mid }
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
    const ranked = summary.roles.filter((r) => r.position === role && r.rank).length
    const key = `champion:${champion.id}:${role}:${f.patch}:${stat?.tier}:${stat?.win}:${stat?.games}`
    return this.send(ctx, key, async () => {
      const splash = await art('centered', champion.id)
      const enough = Boolean(stat && stat.games >= 100)
      const body = await championCard({
        name: champion.name,
        role: CARD_ROLE[role],
        roleLabel: ROLE_OF[role].label,
        patch: patchName(f.patch),
        bracket: BRACKET_TEXT[f.bracket] ?? 'Emerald+',
        tier: enough ? (stat?.tier ?? null) : null,
        rank: enough ? (stat?.rank ?? null) : null,
        ranked: ranked || null,
        winRate: enough ? stat!.win : null,
        games: enough ? stat!.games : null,
        splash,
      })
      return { body, complete: Boolean(splash) }
    })
  }

  /** `/og/tier-list/<role|all|items|runes|duos|aram>.jpg`: the list's first five. */
  async tierList(ctx: HttpContext) {
    const name = nameOf(ctx.params.file)?.toLowerCase() ?? null
    if (name === 'items' || name === 'runes' || name === 'aram') return this.otherList(ctx, name)
    const duo = /^duos(?:-(mid|top))?$/.exec(name ?? '')
    if (duo) return this.otherList(ctx, 'duos', (duo[1] as 'mid' | 'top' | undefined) ?? 'bot')
    const role = roleOf(name)
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
    const key = `tier:${role}:${f.patch}:${top.map((r) => `${r.champion}${r.tier}${r.win}`).join(',')}`
    return this.send(ctx, key, async () => {
      const [splash, ...portraits] = await Promise.all([
        top[0] ? art('centered', top[0].champion) : undefined,
        ...top.map((r) => art('loading', r.champion)),
      ])
      const body = await tierListCard({
        title:
          role === 'all'
            ? [['Tier list', C.text1]]
            : [
                [ROLE_OF[role].label, C.violet],
                ['tier list', C.text1],
              ],
        sub: `Patch ${patchName(f.patch)}, ${BRACKET_TEXT[f.bracket] ?? 'Emerald+'}`,
        kind: 'tall',
        tiles: top.map((r, i) => ({
          art: portraits[i],
          tier: r.tier,
          winRate: r.win,
          role: role === 'all' ? CARD_ROLE[r.position] : null,
        })),
        splash,
        mood: 'snax',
        source:
          role === 'all' ? 'The best pick of each role' : `The best five of ${ranked(role).length}`,
      })
      return { body, complete: Boolean(splash) || !top.length }
    })
  }

  /** The other tier lists: items, keystones, bot lane duos and ARAM, their first five. */
  private async otherList(
    ctx: HttpContext,
    list: 'items' | 'runes' | 'duos' | 'aram',
    lane: 'bot' | 'mid' | 'top' = 'bot'
  ) {
    const f = await filter(list === 'aram' ? 'all' : DEFAULT_BRACKET)
    if (!f) return this.missing(ctx)
    const sub = `Patch ${patchName(f.patch)}${list === 'aram' ? '' : `, ${BRACKET_TEXT[f.bracket] ?? 'Emerald+'}`}`
    type Row = { tier: number | null; win: number }
    let tiles: Tile[] = []
    let splashId: number | null = null
    let ready = true
    let title: Run[] = []
    let mood: Mood = 'snax'
    let kind: 'tall' | 'icon' | 'pair' = 'tall'
    let source = ''
    if (list === 'items') {
      const rows = rowsOf<Row & { item: number }>(await tierListsService.items(f, null, null))
      ready = rows !== null
      const top = best(rows ?? [])
      tiles = await Promise.all(
        top.map(async (r) => ({ art: await art('item', r.item), tier: r.tier, winRate: r.win }))
      )
      title = [
        ['Item', C.violet],
        ['tier list', C.text1],
      ]
      kind = 'icon'
      mood = 'love'
      source = 'Finished items, by win rate'
    } else if (list === 'runes') {
      const rows = rowsOf<Row & { keystone: number }>(await tierListsService.runes(f, null))
      ready = rows !== null
      const top = best(rows ?? [])
      tiles = await Promise.all(
        top.map(async (r) => ({ art: await art('perk', r.keystone), tier: r.tier, winRate: r.win }))
      )
      title = [
        ['Rune', C.violet],
        ['tier list', C.text1],
      ]
      kind = 'icon'
      mood = 'peace'
      source = 'Keystones, by win rate'
    } else if (list === 'duos') {
      const rows = rowsOf<Row & { a: number; b: number }>(await tierListsService.duos(f, lane))
      ready = rows !== null
      const top = best(rows ?? [], 4)
      splashId = top[0]?.a ?? null
      tiles = await Promise.all(
        top.map(async (r) => ({
          art: await art('champion', r.a),
          art2: await art('champion', r.b),
          tier: r.tier,
          winRate: r.win,
        }))
      )
      title =
        lane === 'bot'
          ? [
              ['Bot lane', C.violet],
              ['duos', C.text1],
            ]
          : [
              [lane === 'mid' ? 'Mid' : 'Top', C.violet],
              ['and jungle duos', C.text1],
            ]
      kind = 'pair'
      mood = 'buddies'
      source = 'Win rate together'
    } else {
      const rows = rowsOf<Row & { champion: number }>(await tierListsService.aram(f, 'aram'))
      ready = rows !== null
      const top = best(rows ?? [])
      splashId = top[0]?.champion ?? null
      tiles = await Promise.all(
        top.map(async (r) => ({
          art: await art('loading', r.champion),
          tier: r.tier,
          winRate: r.win,
        }))
      )
      title = [
        ['ARAM', C.violet],
        ['tier list', C.text1],
      ]
      mood = 'cheeky'
      source = 'The Howling Abyss, every game we hold'
    }
    const key = `list:${list}:${lane}:${f.patch}:${ready}:${tiles.map((t) => `${t.tier}${t.winRate}`).join(',')}:${splashId}`
    return this.send(ctx, key, async () => {
      const splash = splashId ? await art('centered', splashId) : undefined
      const body = await tierListCard({ title, sub, kind, tiles, splash, mood, source })
      return { body, complete: ready }
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
    const patch = patchName(picks.patch)
    let card = {
      title: [[STATS_VIEWS[view], C.text1]] as Run[],
      sub: `Patch ${patch}, Emerald+`,
      value: compact(picks.games),
      unit: '',
      caption: 'Ranked games read on this patch',
      champion: picks.best.find((b) => b.position === 'MIDDLE')?.championId ?? null,
      mood: 'peace' as Mood,
    }
    const bully = lanes?.bullies[0]
    const first = lanes?.firstBlood[0]
    const climber = picks.climbers[0]
    if (view === 'early' && bully) {
      card = {
        ...card,
        value: `+${Math.round(bully.value)}`,
        caption: `${bully.name}, gold ahead at 10 minutes`,
        champion: bully.championId,
        mood: 'cheeky',
      }
    } else if (view === 'firstblood' && first) {
      card = {
        ...card,
        value: (first.value * 100).toFixed(1),
        unit: '%',
        caption: `${first.name}, in on first blood`,
        champion: first.championId,
        mood: 'cheeky',
      }
    } else if (view === 'patch') {
      card = climber
        ? {
            ...card,
            title: [
              ['Patch', C.text1],
              [patch, C.violet],
            ],
            sub: picks.previousPatch
              ? `Since ${patchName(picks.previousPatch)}, Emerald+`
              : 'Emerald+',
            value: `#${climber.to}`,
            caption: `${climber.name}, up from #${climber.from}`,
            champion: climber.championId,
            mood: 'cheeky',
          }
        : {
            ...card,
            title: [
              ['Patch', C.text1],
              [patch, C.violet],
            ],
            sub: 'Emerald+',
          }
    }
    const key = `stats:${view}:${card.value}:${card.caption}:${card.champion}`
    return this.send(ctx, key, async () => {
      const splash = card.champion ? await art('centered', card.champion) : undefined
      const body = await figureCard({ ...card, splash })
      return { body, complete: Boolean(splash) || !card.champion }
    })
  }

  /** `/og/pros/<league>.jpg`: the five best pros by LP, of every league (`all`) or of one. */
  async pros(ctx: HttpContext) {
    const name = nameOf(ctx.params.file)?.toLowerCase()
    const leagues = await leagueCatalog()
    const league = name === 'all' ? null : leagues.bySlug(name)
    if (name !== 'all' && !league?.teams.length) return this.missing(ctx)
    const [ladder, counts] = await Promise.all([
      proLadderService.ladder({ league: league?.slug ?? null, limit: 5 }).catch(() => null),
      league ? null : homeService.pros().catch(() => null),
    ])
    if (!ladder) return this.missing(ctx)
    const key = `pros:${league?.slug ?? 'all'}:${ladder.total}:${ladder.rows.map((r) => `${r.pro.slug}${r.account.lp}`).join(',')}`
    return this.send(ctx, key, async () => {
      const [logo, ...photos] = await Promise.all([
        league ? leagueLogo(league.slug) : null,
        ...ladder.rows.map((r) => proPhoto(r.pro.slug, r.pro.photo)),
      ])
      const body = await prosCard({
        title: league
          ? [
              [league.code, C.violet],
              ['pros', C.text1],
            ]
          : [
              ['Pro', C.violet],
              ['players', C.text1],
            ],
        sub: league
          ? `${league.name}, ${league.teams.length} teams`
          : counts?.counts
            ? `${count(counts.counts.players)} players, ${count(counts.counts.teams)} teams`
            : 'Every league, ranked by LP',
        logo,
        pros: ladder.rows.map((r, i) => ({
          name: r.pro.name,
          photo: photos[i],
          lp: r.account.lp,
          tier: r.account.tier,
          team: r.pro.team?.name ?? null,
        })),
        source: `${count(ladder.total)} in Master and above`,
      })
      return { body, complete: true }
    })
  }

  /** `/og/pro/<slug>.jpg`: the pro's photo, their team, their best account's LP. */
  async pro(ctx: HttpContext) {
    const slug = nameOf(ctx.params.file)
    const pro = slug ? await proService.player(slug).catch(() => null) : null
    if (!pro) return this.missing(ctx)
    const accounts = pro.accounts as {
      tier: string | null
      division: number | null
      lp: number | null
      platform: string
    }[]
    const top = accounts.find((a) => a.tier) ?? null
    const role = pro.role ? (PRO_ROLE[String(pro.role).toUpperCase()] ?? null) : null
    const key = `pro:${pro.slug}:${pro.team?.id ?? ''}:${top?.tier}:${top?.lp}:${pro.photo ?? ''}`
    return this.send(ctx, key, async () => {
      const [logo, photo, emblem] = await Promise.all([
        teamLogo(pro.team?.id),
        proPhoto(pro.slug, pro.photo),
        top?.tier ? art('emblem', top.tier.toLowerCase()) : null,
      ])
      const apex = top?.tier && ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(top.tier)
      const body = await proCard({
        name: pro.name,
        team: pro.team ? { name: pro.team.name, logo } : null,
        role,
        roleLabel: role ? PRO_ROLE_LABEL[role] : null,
        photo,
        rank: top?.tier
          ? {
              tier: top.tier,
              division: apex || !top.division ? null : (ROMAN[top.division] ?? null),
              lp: top.lp ?? 0,
              platform: top.platform,
            }
          : null,
        emblem,
        league: pro.league?.code ?? null,
      })
      return { body, complete: true }
    })
  }

  /** `/og/team/<slug>.jpg`: the team's logo, its name and its players. */
  async team(ctx: HttpContext) {
    const slug = nameOf(ctx.params.file)
    const team = slug ? await proService.team(slug).catch(() => null) : null
    if (!team) return this.missing(ctx)
    const order: Role[] = ['top', 'jungle', 'mid', 'bot', 'support']
    const players = (
      team.roster as {
        name: string
        slug: string
        photo?: string | null
        current: boolean
        title: string | null
        role: string | null
      }[]
    )
      .filter((m) => m.current && m.title !== 'staff')
      .map((m) => ({ ...m, lane: m.role ? (PRO_ROLE[m.role.toUpperCase()] ?? null) : null }))
      .filter((m) => m.lane)
      .sort((a, b) => order.indexOf(a.lane!) - order.indexOf(b.lane!))
      .slice(0, 5)
    const leagues = await leagueCatalog()
    const of = team.league ? (leagues.bySlug(team.league.slug)?.teams.length ?? null) : null
    const key = `team:${team.slug}:${team.place}:${players.map((p) => p.slug).join(',')}`
    return this.send(ctx, key, async () => {
      const [logo, ...photos] = await Promise.all([
        teamLogo(team.id),
        ...players.map((p) => proPhoto(p.slug, p.photo)),
      ])
      const body = await teamCard({
        name: team.name,
        league: team.league?.code ?? null,
        region: team.region,
        logo,
        roster: players.map((p, i) => ({ name: p.name, role: p.lane, photo: photos[i] })),
        place: team.place && of ? { place: team.place, of } : null,
      })
      return { body, complete: true }
    })
  }

  /** `/og/mastery/<Name-Tag>.jpg`: the player's mastery pool and total points. */
  async mastery(ctx: HttpContext) {
    const riotId = /^(.{1,64})\.jpg$/i.exec(String(ctx.params.file ?? ''))?.[1]
    const profile = riotId
      ? await summonerService.findStoredProfile(riotId).catch(() => null)
      : null
    if (!profile) return this.missing(ctx)
    const pool = await playerInsightsService.mastery(profile.puuid).catch(() => null)
    if (!pool?.length) return this.missing(ctx)
    const sum = createHash('sha1')
      .update(pool.map((m) => `${m.championId}:${m.championPoints}`).join(','))
      .digest('base64url')
      .slice(0, 12)
    return this.send(ctx, `mastery:${profile.puuid}:${profile.gameName}:${sum}`, async () => {
      const names = await riotAssets.names('champion').catch(() => ({}) as Record<string, string>)
      let missing = false
      const body = await masteryCard(
        profile,
        pool.map((m) => ({ ...m, name: names[String(m.championId)] ?? '' })),
        async (kind, id) => {
          const bytes = await art(kind === 'splash' ? 'centered' : 'champion', id)
          if (!bytes) missing = true
          return bytes
        }
      )
      return { body, complete: !missing && Object.keys(names).length > 0 }
    })
  }

  /** `/og/leaderboards/<solo|flex|one-tricks>.jpg?region=euw`: who leads the server's ladder. */
  async leaderboard(ctx: HttpContext) {
    const board = nameOf(ctx.params.file)?.toLowerCase()
    if (board !== 'solo' && board !== 'flex' && board !== 'one-tricks') return this.missing(ctx)
    const server = ladderRegion(ctx.request.input('region'))
    const snapshot = await ladderService.snapshot(server.platform).catch(() => null)
    const entries = snapshot?.entries ?? []
    let leader: Parameters<typeof ladderCard>[0]['leader'] = null
    let leaderChampion: number | null = null
    let leaderIcon: number | null = null
    let sub = ''
    let title: Run[] = []
    let mood: Mood = 'bouncer'
    let source = ''
    if (board === 'solo') {
      const top = snapshot && entries[0] ? ladderService.rowsOf(snapshot, [entries[0]])[0] : null
      title = [
        [server.label, C.violet],
        ['ladder', C.text1],
      ]
      sub = entries.length
        ? `Solo/Duo, ${count(entries.length)} players in Master and above`
        : 'Solo/Duo, Challenger, Grandmaster and Master'
      if (top?.gameName) {
        leaderChampion = top.champions[0]?.champion ?? null
        leaderIcon = top.icon
        leader = {
          name: top.gameName,
          tag: top.tagLine,
          icon: null,
          tier: top.tier,
          division: null,
          lp: top.lp,
          splash: null,
          note: top.pro?.name && top.pro.name !== top.gameName ? top.pro.name : null,
        }
      }
      source = 'Ranked by LP'
    } else if (board === 'one-tricks') {
      const tricks = snapshot ? ladderService.oneTricks(snapshot) : []
      const first = tricks[0]
      const row = first && snapshot ? ladderService.rowsOf(snapshot, [first.entry])[0] : null
      const names = await riotAssets.names('champion').catch(() => ({}) as Record<string, string>)
      title = [
        ['One-tricks,', C.text1],
        [server.label, C.violet],
      ]
      sub = tricks.length
        ? `${count(tricks.length)} players with half their games on one champion`
        : 'Half their games on one champion'
      if (row?.gameName && first) {
        leaderChampion = first.trick.champion
        leaderIcon = row.icon
        leader = {
          name: row.gameName,
          tag: row.tagLine,
          icon: null,
          tier: row.tier,
          division: null,
          lp: row.lp,
          splash: null,
          note: names[String(first.trick.champion)] ?? null,
        }
      }
      mood = 'love'
      source = 'Master and above, ranked by LP'
    } else {
      title = [
        [server.label, C.violet],
        ['flex ladder', C.text1],
      ]
      sub = 'Who queues with whom'
      mood = 'buddies'
      source = 'Ranked flex players Invade knows'
    }
    const key = `ladder:${board}:${server.slug}:${leader?.name}:${leader?.lp}:${entries.length}:${leaderChampion}`
    return this.send(ctx, key, async () => {
      const [splash, icon, emblem] = await Promise.all([
        leaderChampion ? art('centered', leaderChampion) : null,
        leaderIcon ? art('profile-icon', leaderIcon) : null,
        art('emblem', (leader?.tier ?? 'challenger').toLowerCase()),
      ])
      const body = await ladderCard({
        title,
        sub,
        leader: leader && { ...leader, icon, splash },
        emblem,
        mood,
        source,
      })
      return { body, complete: !leaderChampion || Boolean(splash) }
    })
  }

  /** `/og/esports.jpg`: the match live now (or next), else the leagues. */
  async esports(ctx: HttpContext) {
    const [headline, leagues, ladder] = await Promise.all([
      proMatchService.headline(1).catch(() => []),
      leagueCatalog(),
      proLadderService.ladder({ limit: 1 }).catch(() => null),
    ])
    const match = headline[0] ?? null
    const live = match?.status === 'running'
    const tier1 = leagues.all.filter((l) => l.tier === 1 || l.tier === undefined).slice(0, 6)
    const key = `esports:${match?.id ?? ''}:${match?.status ?? ''}:${tier1.map((l) => l.slug).join(',')}:${ladder?.total}`
    return this.send(ctx, key, async () => {
      const when = match
        ? new Intl.DateTimeFormat('en-GB', {
            weekday: 'long',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC',
          }).format(new Date(match.at)) + ' UTC'
        : ''
      const [a, b, ...logos] = await Promise.all([
        match ? teamLogo(match.teams[0].id) : null,
        match ? teamLogo(match.teams[1].id) : null,
        ...tier1.map((l) => leagueLogo(l.slug)),
      ])
      const body = await esportsCard({
        match: match
          ? {
              league: match.league?.code ?? 'Esports',
              when,
              live,
              a: { name: match.teams[0].name, logo: a },
              b: { name: match.teams[1].name, logo: b },
            }
          : null,
        leagues: tier1.map((l, i) => ({ code: l.code, logo: logos[i] })),
        pros: ladder?.total ?? null,
      })
      return { body, complete: true }
    })
  }

  /** `/og/patch/<26.22>.jpg`: the patch's name, the champions it buffed and nerfed. */
  async patch(ctx: HttpContext) {
    const version = nameOf(ctx.params.file)
    if (!version || !PATCH_NAME.test(version)) return this.missing(ctx)
    const notes = await patchNotesService.get(version).catch(() => null)
    if (!notes) return this.missing(ctx)
    const ups = notes.champions.filter((c) => c.kind === 'up')
    const downs = notes.champions.filter((c) => c.kind === 'down')
    const key = `patch:${version}:${ups.map((c) => c.id).join(',')}:${downs.map((c) => c.id).join(',')}`
    return this.send(ctx, key, async () => {
      const [splash, buffs, nerfs] = await Promise.all([
        ups[0] ? art('centered', ups[0].id) : downs[0] ? art('centered', downs[0].id) : undefined,
        Promise.all(ups.slice(0, 7).map(async (c) => ({ art: await art('champion', c.id) }))),
        Promise.all(downs.slice(0, 7).map(async (c) => ({ art: await art('champion', c.id) }))),
      ])
      const published = notes.published
        ? new Intl.DateTimeFormat('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
          }).format(new Date(notes.published))
        : null
      const body = await patchCard({
        patch: version,
        published,
        buffs: [...buffs, ...ups.slice(7).map(() => ({ art: null }))],
        nerfs: [...nerfs, ...downs.slice(7).map(() => ({ art: null }))],
        splash,
      })
      return { body, complete: true }
    })
  }

  /** `/og/app.jpg`: the desktop app's Home in its window. */
  async app(ctx: HttpContext) {
    const release = await Promise.race([
      desktopReleases.latest().catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 600)),
    ])
    const version = release?.version ?? null
    return this.send(ctx, `app:${version}`, async () => {
      const shot = await appScreenshot()
      return { body: await appCard({ version, shot }), complete: Boolean(shot && version) }
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
