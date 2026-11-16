import clickhouse from 'adonisjs-clickhouse/services/main'
import db from '@adonisjs/lucid/services/db'
import { asString, escapeClickhouseString } from '#utils/clickhouse'
import { VISIBLE_QUEUES_SQL } from '#constants/riot'

/**
 * The stored games of the players of one lobby, each player's own line only, for the desktop
 * app's scouting. Everything comes from what is already stored: the players by Riot ID from
 * `riot_player`, their games from `participants`. Nothing is ever asked from Riot here, so a lobby
 * costs no Riot request, and a player nobody stored yet is simply answered as unknown.
 */

/** Games answered per player, at most. */
export const LOBBY_GAMES_MAX = 40
/** Players per request: the ten of a game. */
export const LOBBY_PLAYERS_MAX = 10
/** Games older than this are left out: the scouting reads recent habits. */
const SINCE_MS = 365 * 24 * 3600 * 1000
/** A player's games are kept this long: the same lobby is asked again by its other players. */
const TTL_MS = 5 * 60 * 1000
const MAX_CACHED = 2000

export interface LobbyPlayerQuery {
  gameName: string
  tagLine: string
}

/** One game of one player: their own line. */
export interface LobbyGame {
  /** `EUW1_7998180573`. */
  matchId: string
  startMs: number
  /** Seconds; 0 when the game's own row is not stored. */
  duration: number
  queueId: number
  championId: number
  teamId: number
  win: boolean
  kills: number
  deaths: number
  assists: number
  /** `TOP` `JUNGLE` `MIDDLE` `BOTTOM` `UTILITY`, or empty. */
  position: string
  /** `item0`…`item6`. */
  items: number[]
  spells: [number, number]
  keystone: number
  primary: number
  sub: number
}

export interface LobbyPlayerGames {
  gameName: string
  tagLine: string
  /** The player is stored here; `false`: nothing known, no game. */
  known: boolean
  /** Newest first. */
  games: LobbyGame[]
}

interface StoredPlayer {
  puuid: string
  platform: string
  game_name: string
  tag_line: string
  last_refresh_at: Date | string | null
}

/** Where each column of the participants read stands. */
const COLUMNS = [
  'puuid',
  'match_id',
  'game_start_ms',
  'queue_id',
  'champion_id',
  'team_id',
  'win',
  'kills',
  'deaths',
  'assists',
  'team_position',
  'item0',
  'item1',
  'item2',
  'item3',
  'item4',
  'item5',
  'item6',
  'spell1',
  'spell2',
  'keystone',
  'primary_style',
  'secondary_style',
] as const

const at = (name: (typeof COLUMNS)[number]) => COLUMNS.indexOf(name)

/** One positional participants row as a game line (without its duration). */
export function lobbyGame(row: readonly unknown[]): LobbyGame {
  const n = (name: (typeof COLUMNS)[number]) => Number(row[at(name)]) || 0
  return {
    matchId: asString(row[at('match_id')]),
    startMs: n('game_start_ms'),
    duration: 0,
    queueId: n('queue_id'),
    championId: n('champion_id'),
    teamId: n('team_id'),
    win: n('win') > 0,
    kills: n('kills'),
    deaths: n('deaths'),
    assists: n('assists'),
    position: asString(row[at('team_position')]),
    items: [n('item0'), n('item1'), n('item2'), n('item3'), n('item4'), n('item5'), n('item6')],
    spells: [n('spell1'), n('spell2')],
    keystone: n('keystone'),
    primary: n('primary_style'),
    sub: n('secondary_style'),
  }
}

const riotIdKey = (gameName: string, tagLine: string) =>
  `${gameName.trim().toLowerCase()}#${tagLine.trim().toLowerCase()}`

/**
 * The stored player each Riot ID names: on `platform` when several platforms hold the same Riot
 * ID, else the one refreshed last.
 */
export function pickPlayers(rows: readonly StoredPlayer[], platform: string | undefined) {
  const time = (row: StoredPlayer) =>
    row.last_refresh_at ? new Date(row.last_refresh_at).getTime() || 0 : 0
  const picked = new Map<string, StoredPlayer>()
  for (const row of rows) {
    const key = riotIdKey(row.game_name, row.tag_line)
    const held = picked.get(key)
    const better =
      !held ||
      (platform && row.platform === platform && held.platform !== platform) ||
      ((!platform || (row.platform === platform) === (held.platform === platform)) &&
        time(row) > time(held))
    if (better) picked.set(key, row)
  }
  return picked
}

async function rawRows(query: string): Promise<unknown[][]> {
  const result = await clickhouse.query({ query, format: 'JSONCompactEachRow' })
  return (await result.json<unknown[]>()) ?? []
}

export class LobbyGamesService {
  #cache = new Map<string, { games: LobbyGame[]; expires: number }>()

  constructor(private now: () => number = Date.now) {}

  /** The stored players named by `players`, by lowercase Riot ID. */
  async storedPlayers(players: readonly LobbyPlayerQuery[], platform: string | undefined) {
    if (!players.length) return new Map<string, StoredPlayer>()
    const rows: StoredPlayer[] = await db
      .from('riot_player')
      .select('puuid', 'platform', 'game_name', 'tag_line', 'last_refresh_at')
      .where((query) => {
        // `game_name` and `tag_line` are citext: the comparison ignores case.
        for (const p of players) {
          query.orWhere((one) => one.where('game_name', p.gameName).where('tag_line', p.tagLine))
        }
      })
    return pickPlayers(rows, platform)
  }

  /** The latest stored games of each puuid, newest first, read once for all of them. */
  async storedGames(puuids: readonly string[], count: number) {
    const out = new Map<string, LobbyGame[]>()
    if (!puuids.length) return out
    const list = puuids.map((p) => `'${escapeClickhouseString(p)}'`).join(',')
    const since = Math.max(0, Math.trunc(this.now() - SINCE_MS))
    const limit = Math.min(LOBBY_GAMES_MAX, Math.max(1, Math.trunc(count)))
    const rows = await rawRows(`
      SELECT ${COLUMNS.join(', ')}
      FROM participants
      PREWHERE puuid IN (${list})
      WHERE game_start_ms >= ${since} AND ${VISIBLE_QUEUES_SQL}
      ORDER BY puuid, game_start_ms DESC, match_id DESC
      LIMIT ${limit} BY puuid
    `)
    const ids = new Set<string>()
    for (const row of rows) {
      const puuid = asString(row[at('puuid')])
      const game = lobbyGame(row)
      ids.add(game.matchId)
      const games = out.get(puuid)
      if (games) games.push(game)
      else out.set(puuid, [game])
    }
    if (ids.size) {
      const idList = Array.from(ids, (id) => `'${escapeClickhouseString(id)}'`).join(',')
      const durations = new Map<string, number>()
      for (const row of await rawRows(
        `SELECT match_id, duration_sec FROM matches WHERE match_id IN (${idList})`
      )) {
        durations.set(asString(row[0]), Number(row[1]) || 0)
      }
      for (const games of out.values()) {
        for (const game of games) game.duration = durations.get(game.matchId) ?? 0
      }
    }
    return out
  }

  /**
   * Each asked player's stored games, in the order asked. A player this server never stored is
   * `known: false` with no game.
   */
  async games(
    players: readonly LobbyPlayerQuery[],
    platform: string | undefined,
    count: number
  ): Promise<LobbyPlayerGames[]> {
    const stored = await this.storedPlayers(players, platform)
    const now = this.now()
    const wanted = new Set<string>()
    for (const row of stored.values()) {
      const held = this.#cache.get(row.puuid)
      if (!held || held.expires <= now) wanted.add(row.puuid)
    }
    if (wanted.size) {
      const read = await this.storedGames(Array.from(wanted), LOBBY_GAMES_MAX)
      for (const puuid of wanted) {
        this.#cache.set(puuid, { games: read.get(puuid) ?? [], expires: now + TTL_MS })
      }
      this.#trim(now)
    }
    return players.map((p) => {
      const row = stored.get(riotIdKey(p.gameName, p.tagLine))
      const games = row ? (this.#cache.get(row.puuid)?.games ?? []) : []
      return {
        gameName: p.gameName,
        tagLine: p.tagLine,
        known: !!row,
        games: games.slice(0, count),
      }
    })
  }

  /** Expired entries go first, then the oldest, until the cache is back under its bound. */
  #trim(now: number) {
    if (this.#cache.size <= MAX_CACHED) return
    for (const [key, entry] of this.#cache) {
      if (entry.expires <= now) this.#cache.delete(key)
    }
    for (const key of this.#cache.keys()) {
      if (this.#cache.size <= MAX_CACHED) break
      this.#cache.delete(key)
    }
  }
}

export default new LobbyGamesService()
