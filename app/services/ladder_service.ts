import { createHash } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { rows } from '#services/ranked_games_service'
import { RANKED_SOLO } from '#services/ranked_stats'
import { StatsCache } from '#services/stats_cache'
import matchRepository from '#services/analytics/match_repository'
import proPhotoService from '#services/pro_photo_service'
import { buildsOf, itemKinds } from '#services/pro_service'
import { catalog, leagueCatalog } from '#services/pro_leagues'
import { isRemake, scoreLobby, REMAKE_SECONDS } from '../../inertia/lib/match.js'
import type { Match } from '../../inertia/lib/types.js'
import {
  APEX_TIERS,
  currentApex,
  cutoffs,
  isApex,
  oneTrickOf,
  roleShares,
  summarizePlayers,
  type ApexEntry,
  type GamesRow,
  type OneTrick,
  type PlayerGames,
  type TierRead,
} from '#services/ladder'
import {
  recordAndRead,
  redisHistory,
  type HistoryStore,
  type LadderHistory,
  type Move,
} from '#services/ladder_history'

/**
 * The Solo/Duo apex ladder of a server (Challenger, Grandmaster, Master) and its one-tricks, from
 * what the crawler already stores, with no request to Riot:
 *
 * - `league_entries`: the crawler reads each apex league whole (every entry of one read shares its
 *   `seen_at`) when it picks seeds there, about once a day per tier and server. The newest full read
 *   of each tier is the ladder; it is in the first crawler key's PUUIDs.
 * - `participants`: the same players' ranked games the crawler stored (it seeds from these leagues,
 *   so nearly every apex player has games), giving their Riot ID, icon, level, role and champions.
 *   Only the games of the last `WINDOW_DAYS` count; they are the stored ones, not every game played.
 * - `pro_puuids`: which entries are pros.
 *
 * A server's whole ladder is read in one pass and kept (`StatsCache`, fresh `FRESH_MS`); a page of
 * it adds the Invade score of its players' last games, kept too.
 */

/** Stored games counted for roles, champions and one-tricks. */
export const WINDOW_DAYS = Number(process.env.LADDER_WINDOW_DAYS) || 30
/** Games averaged into a player's Invade score on the ladder. */
export const SCORE_GAMES = 20
/** A tier's read counts as full from this many entries (other rows are single updates). */
const FULL_READ = 20
const SOLO_QUEUE = 'RANKED_SOLO_5x5'
/** A one-trick's newest games on their champion read for their build. */
const BUILD_GAMES = 40
const DAY_MS = 86_400_000
const FRESH_MS = 20 * 60_000
const KEEP_MS = 12 * 3_600_000
/** The cached shape: bump it when the snapshot's fields change. */
const SHAPE = 2

const APEX_SQL = `tier IN (${APEX_TIERS.map((t) => `'${t}'`).join(',')})`

export interface Identity {
  gameName: string
  tagLine: string
  icon: number
  level: number
}

export interface LadderPro {
  slug: string
  name: string
  photo?: string
  team: { id: string; slug: string; name: string; shortName: string | null } | null
  league: { slug: string; code: string } | null
}

/** Everything known of one server's apex ladder now. */
export interface LadderSnapshot {
  platform: string
  /** The newest full read of each tier. */
  reads: TierRead[]
  /** Current entries, best first. */
  entries: ApexEntry[]
  /** Stored games of the window, by PUUID. */
  players: Record<string, PlayerGames>
  /** Riot ID, icon and level, by PUUID (from their newest stored game). */
  identities: Record<string, Identity>
  /** Pros among them, by PUUID. */
  pros: Record<string, LadderPro>
  /** Moves since an earlier read and the cutoffs' line (`ladder_history.ts`). */
  history: LadderHistory
}

/** Where the snapshot's rows come from; tests stand in for it. */
export interface LadderSource {
  reads(platform: string): Promise<TierRead[]>
  entries(platform: string, since: number): Promise<ApexEntry[]>
  /** Their stored games of the window by champion and role, and their newest Riot ID in them. */
  games(
    platform: string,
    since: number,
    windowStart: number
  ): Promise<{ games: GamesRow[]; identities: Map<string, Identity> }>
  /** The newest Riot ID of some players, whenever they last played. */
  identitiesOf(puuids: string[]): Promise<Map<string, Identity>>
  pros(platform: string, since: number): Promise<Map<string, string>>
  proTags(playerIds: string[]): Promise<Map<string, LadderPro>>
  recentGames(puuids: string[], count: number): Promise<Map<string, string[]>>
  matches(ids: string[], since: number): Promise<Match[]>
  /** Some players' stored ranked games of the window on one champion: what they built. */
  championGames(puuids: string[], champion: number, windowStart: number): Promise<BuildGame[]>
}

/** One stored game of a player on a champion, as far as their build goes. */
export interface BuildGame {
  puuid: string
  items: number[]
  keystone: number
  secondaryStyle: number
  spells: [number, number]
  skillOrder: number[]
  win: boolean
}

/** A one-trick's usual build on their champion, from their stored games of the window. */
export interface OneTrickBuild {
  /** Games it was read from. */
  games: number
  /** Their three most bought finished items, most bought first. */
  core: number[]
  boots: number | null
  keystone: number | null
  secondaryStyle: number | null
}

const num = (v: unknown) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

const identityMap = (found: unknown[][]) =>
  new Map<string, Identity>(
    found.map(([puuid, gameName, tagLine, icon, level]) => [
      String(puuid),
      { gameName: String(gameName), tagLine: String(tagLine), icon: num(icon), level: num(level) },
    ])
  )

/** The puuids of a server's apex entries read since `since` (s), as a ClickHouse subquery. */
const apexPuuids = `SELECT puuid FROM league_entries
  WHERE platform = {platform:String} AND queue = '${SOLO_QUEUE}' AND ${APEX_SQL}
    AND seen_at >= toDateTime({since:UInt32})`

export const clickhouseSource: LadderSource = {
  async reads(platform) {
    const found = await rows(
      `SELECT tier, toUnixTimestamp(seen_at), count() AS n FROM league_entries
       WHERE platform = {platform:String} AND queue = '${SOLO_QUEUE}' AND ${APEX_SQL}
       GROUP BY tier, seen_at HAVING n >= ${FULL_READ}
       ORDER BY seen_at DESC LIMIT 1 BY tier`,
      { platform }
    )
    return found
      .filter(([tier]) => isApex(String(tier)))
      .map(([tier, at, n]) => ({
        tier: String(tier) as TierRead['tier'],
        at: num(at) * 1000,
        entries: num(n),
      }))
  },

  async entries(platform, since) {
    // The newest entry of each player read in an apex league since then, whatever its tier now.
    const found = await rows(
      `SELECT puuid, argMax(tier, seen_at), argMax(league_points, seen_at), argMax(wins, seen_at),
              argMax(losses, seen_at), argMax(hot_streak, seen_at), argMax(veteran, seen_at),
              argMax(fresh_blood, seen_at), argMax(inactive, seen_at), toUnixTimestamp(max(seen_at))
       FROM league_entries
       WHERE platform = {platform:String} AND queue = '${SOLO_QUEUE}' AND puuid IN (${apexPuuids})
       GROUP BY puuid`,
      { platform, since: Math.floor(since / 1000) }
    )
    return found
      .filter(([, tier]) => isApex(String(tier)))
      .map(([puuid, tier, lp, wins, losses, hot, veteran, fresh, inactive, seen]) => ({
        puuid: String(puuid),
        tier: String(tier) as ApexEntry['tier'],
        lp: num(lp),
        wins: num(wins),
        losses: num(losses),
        hotStreak: num(hot) === 1,
        veteran: num(veteran) === 1,
        freshBlood: num(fresh) === 1,
        inactive: num(inactive) === 1,
        seenAt: num(seen) * 1000,
      }))
  },

  async games(platform, since, windowStart) {
    // One pass over the players' games: participants is keyed by player, and reading their rows
    // is most of the cost, so the Riot ID comes from the same groups (the newest one wins).
    const found = await rows(
      `SELECT puuid, champion_id, team_position, count(), sum(win), sum(kills), sum(deaths),
              sum(assists), max(game_start_ms),
              argMaxIf(riot_id_game_name, game_start_ms, riot_id_game_name != ''),
              argMaxIf(riot_id_tag_line, game_start_ms, riot_id_game_name != ''),
              argMaxIf(profile_icon_id, game_start_ms, riot_id_game_name != ''),
              max(summoner_level)
       FROM (
         SELECT puuid, champion_id, team_position, win, kills, deaths, assists, game_start_ms,
                riot_id_game_name, riot_id_tag_line, profile_icon_id, summoner_level
         FROM participants
         WHERE puuid IN (${apexPuuids}) AND queue_id = ${RANKED_SOLO}
           AND game_start_ms >= {windowStart:UInt64}
           AND match_id NOT IN (
             SELECT match_id FROM matches
             WHERE duration_sec < ${REMAKE_SECONDS} AND game_start_ms >= {windowStart:UInt64}
           )
         LIMIT 1 BY puuid, match_id
       )
       GROUP BY puuid, champion_id, team_position`,
      { platform, since: Math.floor(since / 1000), windowStart }
    )
    const games: GamesRow[] = []
    const identities = new Map<string, Identity>()
    const newest = new Map<string, number>()
    for (const [
      puuid,
      champion,
      position,
      n,
      wins,
      k,
      d,
      a,
      last,
      name,
      tag,
      icon,
      level,
    ] of found) {
      const id = String(puuid)
      games.push({
        puuid: id,
        champion: num(champion),
        position: String(position ?? ''),
        games: num(n),
        wins: num(wins),
        kills: num(k),
        deaths: num(d),
        assists: num(a),
        last: num(last),
      })
      const known = identities.get(id)
      if (name && num(last) >= (newest.get(id) ?? 0)) {
        newest.set(id, num(last))
        identities.set(id, {
          gameName: String(name),
          tagLine: String(tag),
          icon: num(icon),
          level: Math.max(num(level), known?.level ?? 0),
        })
      } else if (known) {
        known.level = Math.max(known.level, num(level))
      }
    }
    return { games, identities }
  },

  async identitiesOf(puuids) {
    const out = new Map<string, Identity>()
    for (let i = 0; i < puuids.length; i += 500) {
      const found = await rows(
        `SELECT puuid, argMax(riot_id_game_name, game_start_ms), argMax(riot_id_tag_line, game_start_ms),
                argMax(profile_icon_id, game_start_ms), max(summoner_level)
         FROM participants
         WHERE puuid IN {puuids:Array(String)} AND riot_id_game_name != ''
         GROUP BY puuid`,
        { puuids: puuids.slice(i, i + 500) }
      )
      for (const [k, v] of identityMap(found)) out.set(k, v)
    }
    return out
  },

  async pros(platform, since) {
    const found = await rows(
      `SELECT puuid, toString(any(player_id)) FROM pro_puuids FINAL
       WHERE platform = {platform:String} AND puuid IN (${apexPuuids})
       GROUP BY puuid`,
      { platform, since: Math.floor(since / 1000) }
    )
    return new Map(found.map(([puuid, player]) => [String(puuid), String(player)]))
  },

  async proTags(playerIds) {
    const out = new Map<string, LadderPro>()
    if (!playerIds.length) return out
    await Promise.all([leagueCatalog(), proPhotoService.index()])
    const { rows: found } = await db.rawQuery(
      `SELECT p.id, p.slug, p.name, ct.team_id, ct.team_slug, ct.team_name, ct.team_short
       FROM pro_player p
       LEFT JOIN LATERAL (
         SELECT t.id AS team_id, t.slug AS team_slug, t.name AS team_name, t.short_name AS team_short
         FROM pro_team_member m JOIN pro_team t ON t.id = m.team_id
         WHERE m.player_id = p.id AND m.current
         ORDER BY t.active DESC, m.joined_at DESC NULLS LAST
         LIMIT 1
       ) ct ON true
       WHERE p.id = ANY(?)`,
      [playerIds]
    )
    for (const r of found as Record<string, any>[]) {
      const photo = proPhotoService.of(r.slug)
      const league = catalog().ofTeam(r.team_slug)
      out.set(String(r.id), {
        slug: r.slug,
        name: r.name,
        ...(photo ? { photo } : {}),
        team: r.team_id
          ? { id: r.team_id, slug: r.team_slug, name: r.team_name, shortName: r.team_short ?? null }
          : null,
        league: league ? { slug: league.slug, code: league.code } : null,
      })
    }
    return out
  },

  async recentGames(puuids, count) {
    const out = new Map<string, string[]>()
    if (!puuids.length) return out
    const found = await rows(
      `SELECT puuid, groupArray(match_id) FROM (
         SELECT puuid, match_id FROM (
           SELECT puuid, match_id, game_start_ms FROM participants
           WHERE puuid IN {puuids:Array(String)} AND queue_id = ${RANKED_SOLO}
           ORDER BY puuid, game_start_ms DESC
           LIMIT 1 BY puuid, match_id
         )
         LIMIT {count:UInt32} BY puuid
       )
       GROUP BY puuid`,
      { puuids, count }
    )
    for (const [puuid, ids] of found) out.set(String(puuid), (ids as unknown[]).map(String))
    return out
  },

  async championGames(puuids, champion, windowStart) {
    if (!puuids.length) return []
    const found = await rows(
      `SELECT puuid, item0, item1, item2, item3, item4, item5, spell1, spell2, keystone,
              secondary_style, skill_order, win
       FROM (
         SELECT puuid, match_id, game_start_ms, item0, item1, item2, item3, item4, item5, spell1,
                spell2, keystone, secondary_style, skill_order, win
         FROM participants
         WHERE puuid IN {puuids:Array(String)} AND champion_id = {champion:UInt16}
           AND queue_id = ${RANKED_SOLO} AND game_start_ms >= {windowStart:UInt64}
         LIMIT 1 BY puuid, match_id
       )
       ORDER BY game_start_ms DESC
       LIMIT ${BUILD_GAMES} BY puuid`,
      { puuids, champion, windowStart }
    )
    return found.map((r) => ({
      puuid: String(r[0]),
      items: r.slice(1, 7).map(num),
      spells: [num(r[7]), num(r[8])] as [number, number],
      keystone: num(r[9]),
      secondaryStyle: num(r[10]),
      skillOrder: ((r[11] as unknown[] | null) ?? []).map(num),
      win: num(r[12]) === 1,
    }))
  },

  async matches(ids, since) {
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100))
    const found = await Promise.all(
      chunks.map((chunk) => matchRepository.getByIds(chunk, since) as Promise<Match[]>)
    )
    return found.flat()
  },
}

/** One ladder row, as pages get it: never a PUUID. */
export interface LadderPlayer {
  place: number
  gameName: string | null
  tagLine: string | null
  icon: number | null
  level: number | null
  tier: ApexEntry['tier']
  lp: number
  wins: number
  losses: number
  hotStreak: boolean
  freshBlood: boolean
  veteran: boolean
  inactive: boolean
  /** Their main role in their stored games of the window. */
  role: string | null
  /** Their most played champions in those games. */
  champions: { champion: number; games: number; wins: number }[]
  /** Their stored games of the window. */
  games: number
  pro: LadderPro | null
  /** LP and places gained since `history.since`; null when the tier was not read again since. */
  move: Move | null
}

const NO_HISTORY: LadderHistory = {
  moves: {},
  since: null,
  cutoffsThen: null,
  lines: { CHALLENGER: [], GRANDMASTER: [] },
}

/** `LadderService.placesOf`'s maps, dropped with their snapshot. */
const PLACES = new WeakMap<LadderSnapshot, Map<string, number>>()

export class LadderService {
  source: LadderSource = clickhouseSource
  history: HistoryStore = redisHistory
  #snapshots = new StatsCache(`ladder@${SHAPE}`, {
    freshMs: FRESH_MS,
    keepMs: KEEP_MS,
    maxLocal: 16,
  })
  #scores = new StatsCache(`ladder-scores@${SHAPE}`, {
    freshMs: FRESH_MS,
    keepMs: KEEP_MS,
    maxLocal: 256,
  })
  #builds = new StatsCache(`ladder-builds@${SHAPE}`, {
    freshMs: FRESH_MS,
    keepMs: KEEP_MS,
    maxLocal: 256,
  })

  /** A server's apex ladder now, read once and kept. */
  snapshot(platform: string): Promise<LadderSnapshot> {
    return this.#snapshots.get(platform, () => this.read(platform))
  }

  /** Drops this process's kept answers (tests). */
  clear() {
    this.#snapshots.clear()
    this.#scores.clear()
    this.#builds.clear()
  }

  private async read(platform: string, now = Date.now()): Promise<LadderSnapshot> {
    const reads = await this.source.reads(platform)
    if (!reads.length) {
      return {
        platform,
        reads,
        entries: [],
        players: {},
        identities: {},
        pros: {},
        history: NO_HISTORY,
      }
    }
    const since = Math.min(...reads.map((r) => r.at))
    const windowStart = now - WINDOW_DAYS * DAY_MS
    const [found, { games, identities }, proIds] = await Promise.all([
      this.source.entries(platform, since),
      this.source.games(platform, since, windowStart).catch((error) => {
        logger.warn({ err: error, platform }, 'ladder games unreadable')
        return { games: [] as GamesRow[], identities: new Map<string, Identity>() }
      }),
      this.source.pros(platform, since).catch(() => new Map<string, string>()),
    ])
    const entries = currentApex(found, reads)
    const current = new Set(entries.map((e) => e.puuid))
    // Players without a game in the window keep the name of their newest stored game.
    const unnamed = entries.filter((e) => !identities.has(e.puuid)).map((e) => e.puuid)
    if (unnamed.length) {
      const older = await this.source.identitiesOf(unnamed).catch(() => new Map<string, Identity>())
      for (const [k, v] of older) identities.set(k, v)
    }
    const summaries = summarizePlayers(games.filter((g) => current.has(g.puuid)))
    const tags = await this.source
      .proTags([...new Set([...proIds].filter(([p]) => current.has(p)).map(([, id]) => id))])
      .catch(() => new Map<string, LadderPro>())
    const players: Record<string, PlayerGames> = {}
    const named: Record<string, Identity> = {}
    const pros: Record<string, LadderPro> = {}
    for (const e of entries) {
      const s = summaries.get(e.puuid)
      if (s) players[e.puuid] = s
      const id = identities.get(e.puuid)
      if (id) named[e.puuid] = id
      const tag = tags.get(proIds.get(e.puuid) ?? '')
      if (tag) pros[e.puuid] = tag
    }
    const history = await recordAndRead(
      this.history,
      platform,
      reads,
      entries,
      cutoffs(entries, reads),
      now
    )
    return { platform, reads, entries, players, identities: named, pros, history }
  }

  /**
   * Each player's place on the whole ladder (1 is first), built once per snapshot: pages ask for
   * rows one at a time, and rebuilding it for each kept the process busy for seconds.
   */
  placesOf(snapshot: LadderSnapshot): Map<string, number> {
    let places = PLACES.get(snapshot)
    if (!places) {
      places = new Map(snapshot.entries.map((e, i) => [e.puuid, i + 1]))
      PLACES.set(snapshot, places)
    }
    return places
  }

  /** Rows as pages show them, with their place on the whole ladder. */
  rowsOf(snapshot: LadderSnapshot, entries: ApexEntry[]): LadderPlayer[] {
    const place = this.placesOf(snapshot)
    return entries.map((e) => {
      const id = snapshot.identities[e.puuid]
      const games = snapshot.players[e.puuid]
      return {
        place: place.get(e.puuid) ?? 0,
        gameName: id?.gameName ?? null,
        tagLine: id?.tagLine ?? null,
        icon: id?.icon ?? null,
        level: id?.level ?? null,
        tier: e.tier,
        lp: e.lp,
        wins: e.wins,
        losses: e.losses,
        hotStreak: e.hotStreak,
        freshBlood: e.freshBlood,
        veteran: e.veteran,
        inactive: e.inactive,
        role: games?.role ?? null,
        champions: (games?.champions ?? []).map((c) => ({
          champion: c.champion,
          games: c.games,
          wins: c.wins,
        })),
        games: games?.games ?? 0,
        pro: snapshot.pros[e.puuid] ?? null,
        move: snapshot.history?.moves[e.puuid] ?? null,
      }
    })
  }

  /** The cutoffs, each role's share of the ladder and when each tier was read. */
  overview(snapshot: LadderSnapshot) {
    const history = snapshot.history ?? NO_HISTORY
    return {
      cutoffs: cutoffs(snapshot.entries, snapshot.reads).map((c) => {
        const then = history.cutoffsThen?.[c.tier] ?? null
        return { ...c, change: c.lp !== null && then !== null ? c.lp - then : null }
      }),
      /** The cutoffs' line, one point per read; empty until two reads are kept. */
      cutoffLines: {
        CHALLENGER: history.lines.CHALLENGER.length >= 2 ? history.lines.CHALLENGER : [],
        GRANDMASTER: history.lines.GRANDMASTER.length >= 2 ? history.lines.GRANDMASTER : [],
      },
      /** What moves and cutoff changes read against (ms), null until a day of reads is kept. */
      movesSince: history.since,
      roles: roleShares(snapshot.entries.map((e) => snapshot.players[e.puuid])),
      tiers: APEX_TIERS.map((tier) => ({
        tier,
        players: snapshot.entries.filter((e) => e.tier === tier).length,
        readAt: snapshot.reads.find((r) => r.tier === tier)?.at ?? null,
      })),
      /** The newest read of a tier (each tier says its own in `tiers`). */
      updatedAt: snapshot.reads.length ? Math.max(...snapshot.reads.map((r) => r.at)) : null,
    }
  }

  /**
   * The average Invade score of each entry's last `SCORE_GAMES` stored games (remakes and games
   * they were away in have no score), by PUUID; kept like the ladder.
   */
  async scores(entries: ApexEntry[]): Promise<Map<string, { score: number; games: number }>> {
    const puuids = entries.map((e) => e.puuid)
    if (!puuids.length) return new Map()
    const key = createHash('sha1').update(puuids.join(',')).digest('base64url')
    const found = await this.#scores
      .get(key, async () => {
        const recent = await this.source.recentGames(puuids, SCORE_GAMES)
        const ids = [...new Set([...recent.values()].flat())]
        const matches = ids.length
          ? await this.source.matches(ids, Date.now() - 4 * WINDOW_DAYS * DAY_MS)
          : []
        return Object.fromEntries(averageScores(matches, recent))
      })
      .catch((error) => {
        logger.warn({ err: error }, 'ladder scores failed')
        return {} as Record<string, { score: number; games: number }>
      })
    return new Map(Object.entries(found))
  }

  /**
   * What each entry usually builds on `champion` (their three most bought finished items, their
   * boots and keystone), from their stored ranked games of the window on it, by PUUID; read in one
   * query for the whole list and kept like the ladder.
   */
  async builds(
    platform: string,
    champion: number,
    entries: ApexEntry[]
  ): Promise<Map<string, OneTrickBuild>> {
    const puuids = entries.map((e) => e.puuid)
    if (!puuids.length) return new Map()
    const key = createHash('sha1')
      .update(`${platform}:${champion}:${puuids.join(',')}`)
      .digest('base64url')
    const found = await this.#builds
      .get(key, async () => {
        const [games, kinds] = await Promise.all([
          this.source.championGames(puuids, champion, Date.now() - WINDOW_DAYS * DAY_MS),
          itemKinds(),
        ])
        return Object.fromEntries(oneTrickBuilds(games, champion, kinds))
      })
      .catch((error) => {
        logger.warn({ err: error, platform, champion }, 'one-trick builds failed')
        return {} as Record<string, OneTrickBuild>
      })
    return new Map(Object.entries(found))
  }

  /**
   * The server's one-tricks (`ONE_TRICK_RULE` over their stored games of the window), best
   * ladder place first, each with their entry.
   */
  oneTricks(snapshot: LadderSnapshot) {
    const out: { entry: ApexEntry; trick: OneTrick }[] = []
    for (const entry of snapshot.entries) {
      const games = snapshot.players[entry.puuid]
      const trick = games ? oneTrickOf(games) : null
      if (trick) out.push({ entry, trick })
    }
    return out
  }
}

/** Each player's build on `champion` out of their games on it (`buildsOf`, as for a pro). */
export function oneTrickBuilds(
  games: BuildGame[],
  champion: number,
  kinds: { legendary: Set<number>; boots: Set<number> }
) {
  const byPlayer = new Map<string, BuildGame[]>()
  for (const g of games) {
    const list = byPlayer.get(g.puuid) ?? []
    list.push(g)
    byPlayer.set(g.puuid, list)
  }
  const out = new Map<string, OneTrickBuild>()
  for (const [puuid, list] of byPlayer) {
    const [build] = buildsOf(
      list.map((g) => ({ ...g, champion })),
      kinds,
      [{ champion, games: list.length, wins: list.filter((g) => g.win).length, kda: 0 }]
    )
    if (!build) continue
    out.set(puuid, {
      games: list.length,
      core: build.core,
      boots: build.boots,
      keystone: build.keystone,
      secondaryStyle: build.secondaryStyle,
    })
  }
  return out
}

/** Each player's average score over their scored games among `matches`. */
export function averageScores(matches: Match[], recent: Map<string, string[]>) {
  const byId = new Map(matches.map((m) => [m.matchId, m]))
  const out = new Map<string, { score: number; games: number }>()
  for (const [puuid, ids] of recent) {
    let total = 0
    let n = 0
    for (const id of ids) {
      const match = byId.get(id)
      if (!match || isRemake(match)) continue
      const s = scoreLobby(match)[puuid]
      if (!s) continue
      total += s.score
      n++
    }
    if (n) out.set(puuid, { score: Math.round(total / n), games: n })
  }
  return out
}

const ladderService = new LadderService()
export default ladderService
