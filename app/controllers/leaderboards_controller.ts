import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import ladderService, {
  SCORE_GAMES,
  WINDOW_DAYS,
  type LadderSnapshot,
  type OneTrickBuild,
} from '#services/ladder_service'
import flexLadderService, { LISTED, SEEN_DAYS } from '#services/flex_ladder_service'
import proLadderService from '#services/pro_ladder_service'
import proService from '#services/pro_service'
import championStatsService from '#services/champion_stats_service'
import { leagueCatalog, leagueRef } from '#services/pro_leagues'
import {
  APEX_TIERS,
  LADDER_ROLES,
  ONE_TRICK_RULE,
  ROLE_PARAM,
  matchesName,
  pageOf,
  sortParam,
  sortRows,
  type ApexEntry,
  type LadderRole,
  type OneTrick,
} from '#services/ladder'
import { breadcrumbs, count, meta, today } from '#services/page_meta'
import { SERVERS, serverList } from '#constants/riot'

/** Rows per page of every ladder. */
const PAGE = 20
/** One-tricks shown for the chosen champion, and best one-tricks per page. */
const CHAMPION_ROWS = 10
const BEST_PAGE = 16
/** Every one-trick of the chosen champion, up to this many (`?all=1`). */
const ALL_ROWS = 200
/** "Played in the last 14 days" on the one-tricks. */
const RECENT_DAYS = 14
const DAY_MS = 86_400_000
const DEFAULT_SERVER = SERVERS[0]

/** The pro ladder's roles (`pro_player.role`). */
const PRO_ROLE: Record<string, string> = {
  top: 'TOP',
  jungle: 'JUNGLE',
  mid: 'MID',
  bot: 'ADC',
  adc: 'ADC',
  support: 'SUPPORT',
}

const serverOf = (value: unknown) =>
  SERVERS.find((s) => s.slug === String(value ?? '').toLowerCase()) ?? null

const pageParam = (value: unknown) =>
  Math.max(1, Math.min(1000, Number.parseInt(String(value ?? 1)) || 1))

/** A season's win rate, null without a game. */
const winRate = (r: { wins: number; losses: number }) =>
  r.wins + r.losses ? r.wins / (r.wins + r.losses) : null

/**
 * A ladder in the order its heads asked (`?sort=&dir=`): `rank` most first is the ladder's own
 * order, `rank` least first the same list from its end, any other key sorted by its value.
 */
function ordered<T, K extends string>(
  list: T[],
  order: { key: K | 'rank' | null; dir: 'asc' | 'desc' },
  values: Record<K, (row: T) => number | null | undefined>
) {
  if (order.key === null || order.key === 'rank') {
    return order.dir === 'asc' && order.key === 'rank' ? [...list].reverse() : list
  }
  return sortRows(list, values[order.key as K], order.dir)
}
/** The sort a page's props carry: null for the ladder's own order. */
const sortProp = (order: { key: string | null; dir: 'asc' | 'desc' }) =>
  order.key === null || (order.key === 'rank' && order.dir === 'desc')
    ? { sort: null, dir: null }
    : { sort: order.key, dir: order.dir }

const flag = (value: unknown) => ['1', 'true', 'on', 'yes'].includes(String(value ?? ''))

const search = (value: unknown) =>
  String(value ?? '')
    .slice(0, 40)
    .trim()

/** A country code as its English name ("FR" to "France"). */
function countryName(code: string | null) {
  if (!code) return null
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

/** Every champion's name and address, for the champions a page shows. */
async function championNames(ids: Iterable<number>) {
  const wanted = new Set(ids)
  const list = await championStatsService.champions().catch(() => [])
  return Object.fromEntries(
    list.filter((c) => wanted.has(c.id)).map((c) => [c.id, [c.name, c.slug]])
  ) as Record<number, [string, string]>
}

const regionProps = (server: (typeof SERVERS)[number]) => ({
  region: { slug: server.slug, label: server.label, platform: server.platform },
  regions: SERVERS.map((s) => ({ slug: s.slug, label: s.label })),
})

/**
 * The leaderboards: the Solo/Duo apex ladder of a server, its flex ranks, its one-tricks and the
 * pros. Every number is stored data (`ladder_service.ts`, `flex_ladder_service.ts`,
 * `pro_ladder_service.ts`); no page asks Riot anything.
 */
export default class LeaderboardsController {
  /** `/leaderboards/solo?region=euw&role=mid&tier=challenger&pros=1&q=&sort=wr&dir=asc&page=2` */
  async solo({ inertia, request }: HttpContext) {
    const server = serverOf(request.input('region')) ?? DEFAULT_SERVER
    const role = ROLE_PARAM[String(request.input('role', '')).toLowerCase()] ?? null
    const askedTier = String(request.input('tier', '')).toUpperCase()
    const tier = (APEX_TIERS as readonly string[]).includes(askedTier) ? askedTier : null
    const prosOnly = flag(request.input('pros'))
    const q = search(request.input('q'))
    const snapshot = await ladderService
      .snapshot(server.platform)
      .catch(() => emptySnapshot(server))

    const list = snapshot.entries.filter(
      (e) =>
        (!role || snapshot.players[e.puuid]?.role === role) &&
        (!tier || e.tier === tier) &&
        (!prosOnly || snapshot.pros[e.puuid]) &&
        (!q ||
          matchesName(snapshot.identities[e.puuid]?.gameName, q) ||
          matchesName(snapshot.pros[e.puuid]?.name, q))
    )
    const order = sortParam(request.input('sort'), request.input('dir'), ['rank', 'move', 'wr'])
    const sorted = ordered(list, order, {
      move: (e) => snapshot.history?.moves[e.puuid]?.lp ?? null,
      wr: winRate,
    })
    const {
      rows: shown,
      page,
      pages,
      total,
    } = pageOf(sorted, pageParam(request.input('page')), PAGE)
    // The top five: #1 on the leader banner, #2 to #5 as small cards beside it.
    const podiumEntries = snapshot.entries.slice(0, 5)
    const [scores, podiumScores] = await Promise.all([
      ladderService.scores(shown),
      ladderService.scores(podiumEntries),
    ])
    const scored = (entries: ApexEntry[], found: typeof scores) =>
      ladderService.rowsOf(snapshot, entries).map((r, i) => {
        const s = found.get(entries[i].puuid)
        return { ...r, score: s?.score ?? null, scoreGames: s?.games ?? 0 }
      })
    const rows = scored(shown, scores)
    const podium = scored(podiumEntries, podiumScores)
    const overview = ladderService.overview(snapshot)
    const filtered = Boolean(role || tier || prosOnly || q || page > 1 || sortProp(order).sort)
    const leader = podium[0]

    return inertia.render('leaderboards/solo', {
      ...regionProps(server),
      filters: {
        role: role ? roleSlug(role) : null,
        tier: tier?.toLowerCase() ?? null,
        pros: prosOnly,
        q: q || null,
        ...sortProp(order),
      },
      podium,
      ...overview,
      rows,
      total,
      players: snapshot.entries.length,
      page,
      pages,
      pageSize: PAGE,
      rule: { windowDays: WINDOW_DAYS, scoreGames: SCORE_GAMES },
      names: await championNames([
        ...rows.flatMap((r) => r.champions.map((c) => c.champion)),
        ...podium.flatMap((r) => r.champions.map((c) => c.champion)),
      ]),
      ...meta({
        title: `Solo/Duo ladder, ${server.label}: Challenger, Grandmaster and Master`,
        description: leader?.gameName
          ? `${count(snapshot.entries.length)} apex players on ${server.label} ranked by LP. ${leader.gameName} leads with ${count(leader.lp)} LP.`
          : `The Solo/Duo apex ladder of ${server.label}, ranked by LP.`,
        path: `/leaderboards/solo${server.slug === DEFAULT_SERVER.slug ? '' : `?region=${server.slug}`}`,
        image: `/og/leaderboards/solo.jpg${server.slug === DEFAULT_SERVER.slug ? '' : `?region=${server.slug}`}`,
        version: today(),
        alt: leader?.gameName
          ? `The ${server.label} Solo/Duo ladder: ${leader.gameName} first with ${count(leader.lp)} LP, over their champion's splash art, a poro bouncer at the door`
          : `The ${server.label} Solo/Duo ladder, a poro bouncer at the door`,
      }),
      robots: filtered ? 'noindex,follow' : null,
      jsonld: [
        breadcrumbs([
          { name: 'Leaderboards', path: '/leaderboards/solo' },
          { name: 'Solo/Duo', path: '/leaderboards/solo' },
        ]),
      ],
    })
  }

  /**
   * `/api/leaderboards/solo/place?region=euw&riotId=Name%23TAG`: where a Riot ID stands on its
   * server's apex ladder (for the page's "you" row), or `place: null` outside it.
   */
  async place({ request, response }: HttpContext) {
    const server = serverOf(request.input('region')) ?? DEFAULT_SERVER
    const riotId = String(request.input('riotId', ''))
    const at = riotId.lastIndexOf('#')
    if (at <= 0) return response.badRequest({ error: 'riotId is Name#TAG' })
    const name = riotId.slice(0, at).toLowerCase()
    const tag = riotId.slice(at + 1).toLowerCase()
    const snapshot = await ladderService
      .snapshot(server.platform)
      .catch(() => emptySnapshot(server))
    const index = snapshot.entries.findIndex((e) => {
      const id = snapshot.identities[e.puuid]
      return id?.gameName.toLowerCase() === name && id.tagLine.toLowerCase() === tag
    })
    response.header('Cache-Control', 'public, max-age=300')
    if (index < 0) return response.ok({ place: null, total: snapshot.entries.length })
    const entry = snapshot.entries[index]
    const [row] = ladderService.rowsOf(snapshot, [entry])
    const scores = await ladderService.scores([entry])
    return response.ok({
      ...row,
      score: scores.get(entry.puuid)?.score ?? null,
      total: snapshot.entries.length,
    })
  }

  /** `/leaderboards/flex?region=euw&role=mid&q=&sort=wr&dir=asc&page=2` */
  async flex({ inertia, request }: HttpContext) {
    const server = serverOf(request.input('region')) ?? DEFAULT_SERVER
    const role = ROLE_PARAM[String(request.input('role', '')).toLowerCase()] ?? null
    const q = search(request.input('q'))
    const ladder = await flexLadderService.ladder(server.platform).catch(() => ({
      platform: server.platform,
      players: [],
      tiers: [],
    }))
    const list = ladder.players.filter(
      (p) => (!role || p.role === role) && (!q || matchesName(p.gameName, q))
    )
    const order = sortParam(request.input('sort'), request.input('dir'), ['rank', 'wr'])
    const sorted = ordered(list, order, { wr: winRate })
    const { rows, page, pages, total } = pageOf(sorted, pageParam(request.input('page')), PAGE)
    const filtered = Boolean(role || q || page > 1 || sortProp(order).sort)
    return inertia.render('leaderboards/flex', {
      ...regionProps(server),
      /**
       * Riot's flex ladder is not stored: these are the flex ranks of the players Invade looked up
       * or saw in the desktop app on this server in the last `seenDays` days.
       */
      scope: { kind: 'tracked', seenDays: SEEN_DAYS, listed: LISTED },
      filters: { role: role ? roleSlug(role) : null, q: q || null, ...sortProp(order) },
      tiers: ladder.tiers,
      rows,
      total,
      players: ladder.players.length,
      page,
      pages,
      pageSize: PAGE,
      names: await championNames(rows.flatMap((r) => r.champions.map((c) => c.champion))),
      ...meta({
        title: `Flex ladder, ${server.label}: the best ranked flex players`,
        description: `Ranked flex players Invade knows on ${server.label}, ranked by rank and LP, with their role and the champions they play.`,
        path: `/leaderboards/flex${server.slug === DEFAULT_SERVER.slug ? '' : `?region=${server.slug}`}`,
        image: `/og/leaderboards/flex.jpg${server.slug === DEFAULT_SERVER.slug ? '' : `?region=${server.slug}`}`,
        version: today(),
        alt: `The ${server.label} flex ladder, with two poros side by side`,
      }),
      robots: filtered || !ladder.players.length ? 'noindex,follow' : null,
      jsonld: [
        breadcrumbs([
          { name: 'Leaderboards', path: '/leaderboards/solo' },
          { name: 'Flex', path: '/leaderboards/flex' },
        ]),
      ],
    })
  }

  /**
   * `/leaderboards/one-tricks?region=euw&champion=katarina&role=mid&sort=games&dir=asc&recent=1&page=2`:
   * `sort` orders the best one-trick of each champion, by LP (`lp`), games on it (`games`, which
   * also picks each champion's best by games), win rate on it (`wr`) or one-tricks (`count`).
   */
  async oneTricks({ inertia, request }: HttpContext) {
    const server = serverOf(request.input('region')) ?? DEFAULT_SERVER
    const role = ROLE_PARAM[String(request.input('role', '')).toLowerCase()] ?? null
    const order = sortParam(request.input('sort'), request.input('dir'), [
      'lp',
      'games',
      'wr',
      'count',
    ])
    const sort = order.key ?? 'lp'
    const recent = flag(request.input('recent'))
    const full = flag(request.input('all'))
    const [snapshot, filter] = await Promise.all([
      ladderService.snapshot(server.platform).catch(() => emptySnapshot(server)),
      championStatsService.filter({ rank: 'emerald_plus' }).catch(() => null),
    ])
    const summary = filter ? await championStatsService.summary(filter).catch(() => null) : null
    const statOf = (champion: number, position: string | null) =>
      summary?.roles.find((r) => r.champion === champion && r.position === position) ??
      summary?.roles.filter((r) => r.champion === champion).sort((a, b) => b.games - a.games)[0] ??
      null

    const since = Date.now() - RECENT_DAYS * DAY_MS
    const all = ladderService.oneTricks(snapshot).filter((t) => !recent || t.trick.last >= since)
    const place = new Map(snapshot.entries.map((e, i) => [e.puuid, i + 1]))
    const byChampion = new Map<number, { entry: ApexEntry; trick: OneTrick }[]>()
    for (const t of all) {
      const list = byChampion.get(t.trick.champion) ?? []
      list.push(t)
      byChampion.set(t.trick.champion, list)
    }
    const tierCounts = (list: { entry: ApexEntry }[]) =>
      Object.fromEntries(
        APEX_TIERS.map((t) => [t, list.filter((x) => x.entry.tier === t).length])
      ) as Record<(typeof APEX_TIERS)[number], number>
    /** Each role a champion has one-tricks in, with how many: a champion is listed in every one. */
    const rolesOf = (list: { trick: OneTrick }[]) =>
      LADDER_ROLES.map((position) => ({
        position,
        oneTricks: list.filter((t) => t.trick.position === position).length,
      })).filter((r) => r.oneTricks > 0)
    const champions = [...byChampion]
      .map(([champion, list]) => ({
        champion,
        oneTricks: list.length,
        byTier: tierCounts(list),
        roles: rolesOf(list),
      }))
      .sort((a, b) => b.oneTricks - a.oneTricks || a.champion - b.champion)

    const row = (t: { entry: ApexEntry; trick: OneTrick }, build: OneTrickBuild | null = null) => {
      const [base] = ladderService.rowsOf(snapshot, [t.entry])
      const stat = statOf(t.trick.champion, t.trick.position)
      const winRate = t.trick.games ? Math.round((t.trick.wins / t.trick.games) * 1000) / 1000 : 0
      return {
        place: place.get(t.entry.puuid) ?? 0,
        gameName: base.gameName,
        tagLine: base.tagLine,
        icon: base.icon,
        level: base.level,
        tier: base.tier,
        lp: base.lp,
        pro: base.pro,
        champion: t.trick.champion,
        position: t.trick.position,
        games: t.trick.games,
        share: t.trick.share,
        wins: t.trick.wins,
        winRate,
        /** Against the champion's average in that role, Emerald and above (`patch`). */
        vsAverage: stat ? Math.round((winRate - stat.win) * 1000) / 1000 : null,
        kda: t.trick.kda,
        last: t.trick.last,
        also: t.trick.also,
        /** Champion mastery is not stored for these players. */
        mastery: null,
        /** Their usual build on it, for the chosen champion's list. */
        build,
      }
    }

    // The chosen champion: asked by slug, else the one with the most one-tricks.
    const asked = String(request.input('champion', '')).toLowerCase()
    const found = asked ? await championStatsService.champion(asked).catch(() => null) : null
    const chosen = found?.id ?? champions[0]?.champion ?? null
    const chosenList = chosen ? (byChampion.get(chosen) ?? []) : []
    const chosenPosition = mostCommon(chosenList.map((t) => t.trick.position))
    const chosenStat = chosen ? statOf(chosen, chosenPosition) : null
    const chosenShown = chosenList.slice(0, full ? ALL_ROWS : CHAMPION_ROWS)
    const chosenBuilds = chosen
      ? await ladderService.builds(
          server.platform,
          chosen,
          chosenShown.map((t) => t.entry)
        )
      : new Map<string, OneTrickBuild>()

    // The best one-trick of each champion; with a role, of each champion one-tricked in it, among
    // its one-tricks in that role.
    const bestOf = (list: { entry: ApexEntry; trick: OneTrick }[]) =>
      sort === 'games' ? [...list].sort((a, b) => b.trick.games - a.trick.games) : list
    const byPlace = [...byChampion]
      .map(([champion, all]) => {
        const list = role ? all.filter((t) => t.trick.position === role) : all
        if (!list.length) return null
        const top = bestOf(list)[0]
        const position = role ?? mostCommon(list.map((t) => t.trick.position))
        const stat = statOf(champion, position)
        return {
          champion,
          position,
          tier: stat?.tier ?? null,
          oneTricks: list.length,
          best: row(top),
          others: list
            .filter((t) => t !== top)
            .slice(0, 3)
            .map((t) => row(t).icon),
        }
      })
      .filter((b) => b !== null)
      .sort((a, b) =>
        sort === 'games' ? b.best.games - a.best.games : a.best.place - b.best.place
      )
    const best =
      sort === 'wr' || sort === 'count'
        ? sortRows(byPlace, (b) => (sort === 'wr' ? b.best.winRate : b.oneTricks), order.dir)
        : order.dir === 'asc'
          ? byPlace.reverse()
          : byPlace
    const bestPage = pageOf(best, pageParam(request.input('page')), BEST_PAGE)

    return inertia.render('leaderboards/one_tricks', {
      ...regionProps(server),
      rule: { ...ONE_TRICK_RULE, windowDays: WINDOW_DAYS, recentDays: RECENT_DAYS },
      filters: {
        role: role ? roleSlug(role) : null,
        sort,
        dir: order.dir,
        recent,
        all: full,
      },
      updatedAt: ladderService.overview(snapshot).updatedAt,
      patch: summary?.patch ?? null,
      champions,
      selected: chosen
        ? {
            champion: chosen,
            position: chosenPosition,
            stat: chosenStat
              ? {
                  win: chosenStat.win,
                  pick: chosenStat.pick,
                  tier: chosenStat.tier,
                  games: chosenStat.games,
                }
              : null,
            byTier: tierCounts(chosenList),
            roles: rolesOf(chosenList),
            total: chosenList.length,
            rows: chosenShown.map((t) => row(t, chosenBuilds.get(t.entry.puuid) ?? null)),
          }
        : null,
      best: { ...bestPage, pageSize: BEST_PAGE },
      oneTricks: all.length,
      names: await championNames([
        ...champions.map((c) => c.champion),
        ...all.flatMap((t) => (t.trick.also ? [t.trick.also.champion] : [])),
      ]),
      ...meta({
        title: `One-tricks, ${server.label}: the best player of every champion`,
        description: `${count(all.length)} one-tricks in Master and above on ${server.label}: players with at least half of their ranked games on one champion.`,
        path: `/leaderboards/one-tricks${server.slug === DEFAULT_SERVER.slug ? '' : `?region=${server.slug}`}`,
        image: `/og/leaderboards/one-tricks.jpg${server.slug === DEFAULT_SERVER.slug ? '' : `?region=${server.slug}`}`,
        version: today(),
        alt: `One-tricks on ${server.label}: the best one-trick, their champion's splash art and LP`,
      }),
      robots:
        role || recent || asked || bestPage.page > 1 || sort !== 'lp' || order.dir === 'asc'
          ? 'noindex,follow'
          : null,
      jsonld: [
        breadcrumbs([
          { name: 'Leaderboards', path: '/leaderboards/solo' },
          { name: 'One-tricks', path: '/leaderboards/one-tricks' },
        ]),
      ],
    })
  }

  /** `/leaderboards/pros?role=mid&league=lec&team=fnatic&server=euw&q=&sort=move&dir=asc&page=2` */
  async pros({ inertia, request }: HttpContext) {
    const server = serverOf(request.input('server'))
    const role = PRO_ROLE[String(request.input('role', '')).toLowerCase()] ?? null
    const catalog = await leagueCatalog()
    // The first league by default (the LEC), as the board opens; `league=all` for every pro.
    const askedLeague = String(request.input('league', '')).toLowerCase()
    const league = askedLeague === 'all' ? null : (catalog.bySlug(askedLeague) ?? catalog.first)
    const team = String(request.input('team', '')).toLowerCase() || null
    const q = search(request.input('q'))
    const scope = { platform: server?.platform ?? null, role, league: league?.slug ?? null }
    const [ladder, servers, updated] = await Promise.all([
      proLadderService.ladder(scope).catch(() => ({ total: 0, rows: [] })),
      proLadderService.servers(role).catch(() => []),
      db
        .rawQuery(
          `SELECT max(rank_at) AS at FROM pro_account WHERE tier IN ('MASTER','GRANDMASTER','CHALLENGER')`
        )
        .then((r) => (r.rows[0]?.at ? new Date(r.rows[0].at).getTime() : null))
        .catch(() => null),
    ])
    const teams = new Map<
      string,
      { id: string; slug: string; name: string; shortName: string | null }
    >()
    for (const r of ladder.rows) {
      if (r.pro.team) {
        const { id, slug, name, shortName } = r.pro.team
        teams.set(slug, { id, slug, name, shortName })
      }
    }
    const list = ladder.rows.filter(
      (r) => (!team || r.pro.team?.slug === team) && (!q || matchesName(r.pro.name, q))
    )
    const order = sortParam(request.input('sort'), request.input('dir'), ['rank', 'move'])
    const sorted = ordered(list, order, { move: (r) => r.move?.lp ?? null })
    const {
      rows: shown,
      page,
      pages,
      total,
    } = pageOf(sorted, pageParam(request.input('page')), PAGE)
    const podium = ladder.rows.slice(0, 3)
    const ids = [...new Set([...shown, ...podium].map((r) => r.playerId))]
    const records = await proService.records(ids).catch(() => new Map())
    const out = (r: (typeof ladder.rows)[number]) => {
      const rec = records.get(r.playerId)
      return {
        place: r.place,
        pro: {
          slug: r.pro.slug,
          name: r.pro.name,
          ...(r.pro.photo ? { photo: r.pro.photo } : {}),
          role: r.pro.role,
          country: r.pro.country,
          countryName: countryName(r.pro.country),
          team: r.pro.team
            ? {
                id: r.pro.team.id,
                slug: r.pro.team.slug,
                name: r.pro.team.name,
                shortName: r.pro.team.shortName,
              }
            : null,
        },
        league: r.league ? { slug: r.league.slug, code: r.league.code } : null,
        account: {
          platform: r.account.platform,
          tier: r.account.tier,
          division: r.account.division,
          lp: r.account.lp,
          wins: r.account.wins,
          losses: r.account.losses,
        },
        move: r.move,
        /** Their stored ranked games of the last 30 days, every account. */
        record: rec ? { games: rec.games, wins: rec.wins } : null,
        champions: (rec?.champions ?? []).slice(0, 3),
      }
    }
    const rows = shown.map(out)
    const filtered = Boolean(
      server || role || askedLeague || team || q || page > 1 || sortProp(order).sort
    )
    return inertia.render('leaderboards/pros', {
      leagues: catalog.listed.map(leagueRef),
      servers: servers.map(({ slug, label, pros }) => ({ slug, label, pros })),
      teams: [...teams.values()].sort((a, b) => a.name.localeCompare(b.name)),
      filters: {
        server: server?.slug ?? null,
        role: request.input('role') ? String(request.input('role')).toLowerCase() : null,
        league: league?.slug ?? 'all',
        team,
        q: q || null,
        ...sortProp(order),
      },
      /** The servers the listed pros' accounts are on ("EUW and NA"). */
      on: serverList([...new Set(ladder.rows.map((r) => r.account.platform))]),
      apex: Object.fromEntries(
        APEX_TIERS.map((t) => [t, ladder.rows.filter((r) => r.account.tier === t).length])
      ),
      podium: podium.map(out),
      rows,
      total,
      pros: ladder.total,
      page,
      pages,
      pageSize: PAGE,
      updatedAt: updated,
      names: await championNames(
        [...rows, ...podium.map(out)].flatMap((r) =>
          r.champions.map((c: { champion: number }) => c.champion)
        )
      ),
      ...meta({
        title: 'Pro ladder: every pro ranked by LP',
        description: podium[0]
          ? `${count(ladder.total)} ${league ? `${league.code} ` : ''}pros in Master and above, ranked by their best account. ${podium[0].pro.name} leads with ${count(podium[0].account.lp)} LP.`
          : 'Every pro ranked by LP, with their moves of the last 24 hours.',
        path: '/leaderboards/pros',
        image: `/og/pros/${league ? league.slug : 'all'}.jpg`,
        version: today(),
        alt: `Photos of the five best ${league ? `${league.code} ` : ''}pros by LP, with a poro holding a foam finger`,
      }),
      robots: filtered ? 'noindex,follow' : null,
      jsonld: [
        breadcrumbs([
          { name: 'Leaderboards', path: '/leaderboards/solo' },
          { name: 'Pros', path: '/leaderboards/pros' },
        ]),
      ],
    })
  }
}

/** `?role=` of a stored role. */
function roleSlug(role: LadderRole) {
  return (
    { TOP: 'top', JUNGLE: 'jungle', MIDDLE: 'mid', BOTTOM: 'bot', UTILITY: 'support' } as const
  )[role]
}

function mostCommon(values: (string | null)[]): LadderRole | null {
  const counts = new Map<string, number>()
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  const [top] = [...counts].sort((a, b) => b[1] - a[1])
  return top && (LADDER_ROLES as readonly string[]).includes(top[0]) ? (top[0] as LadderRole) : null
}

function emptySnapshot(server: (typeof SERVERS)[number]): LadderSnapshot {
  return {
    platform: server.platform,
    reads: [],
    entries: [],
    players: {},
    identities: {},
    pros: {},
    history: {
      moves: {},
      since: null,
      cutoffsThen: null,
      lines: { CHALLENGER: [], GRANDMASTER: [] },
    },
  }
}
