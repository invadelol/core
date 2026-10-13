#!/usr/bin/env node
/**
 * Local demo data for the Friends section: gives the fictional demo profile `Briar Signal#5555`
 * two duo partners, a regular and a few premade groups, so the page has real duos to show.
 *
 * The local demo games draw every teammate at random, so nobody plays with the demo profile more
 * than a handful of times. This adds 45 older games (late August to September 22, before the demo's
 * own games start) cloned from the profile's own demo games: the same stats and builds, with the
 * profile's chosen partners in their usual seats and fresh fictional players everywhere else.
 *
 * Fictional data only, local only: it refuses to run in production or against a remote ClickHouse.
 * Idempotent: the games have fixed ids (NA1_6190000001…) and existing ones are skipped.
 *
 *   node scripts/seed_friends_demo.mjs
 */
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.replace(/^(['"])(.*)\1$/, '$2')])
)
const setting = (key) => process.env[key] ?? env[key]

const url = new URL(setting('CLICKHOUSE_URL') ?? 'http://127.0.0.1:8123')
if (
  setting('NODE_ENV') === 'production' ||
  !['127.0.0.1', 'localhost', '::1'].includes(url.hostname)
) {
  console.error('Refusing to seed: this script only writes to a local development ClickHouse.')
  process.exit(1)
}

async function clickhouse(query, body) {
  const target = new URL(url)
  target.searchParams.set('database', setting('CLICKHOUSE_DB') ?? 'default')
  target.searchParams.set('query', query)
  const response = await fetch(target, {
    method: 'POST',
    headers: {
      'X-ClickHouse-User': setting('CLICKHOUSE_USER') ?? 'default',
      'X-ClickHouse-Key': setting('CLICKHOUSE_PASSWORD') ?? '',
    },
    body,
  })
  const text = await response.text()
  if (!response.ok) throw new Error(text)
  return text
}

async function rows(query) {
  const text = await clickhouse(`${query} FORMAT JSONEachRow`)
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

const quote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/** Fictional demo players, found by Riot ID in the local demo data. */
async function player(gameName, tagLine) {
  const [found] = await rows(
    `SELECT puuid, any(profile_icon_id) AS icon, any(summoner_level) AS level FROM participants
     WHERE riot_id_game_name = ${quote(gameName)} AND riot_id_tag_line = ${quote(tagLine)}
     GROUP BY puuid ORDER BY count() DESC LIMIT 1`
  )
  if (!found) throw new Error(`${gameName}#${tagLine} is not in the local demo data.`)
  return {
    puuid: found.puuid,
    gameName,
    tagLine,
    icon: Number(found.icon),
    level: Number(found.level),
  }
}

const me = await player('Briar Signal', '5555')
const tidewright = await player('Tidewright', 'FR1')
const kelpie = await player('Kelpie', 'NA1')
const quillon = await player('Quillon', 'FR1')
const glimmer = await player('Glimmer', 'LUX')

/* ── The games ───────────────────────────────────────────────────
   [my role, my champion, partner seats [player, role, champion]…, win]
   Champion ids: Ahri 103, Syndra 134, Orianna 61, Sylas 517, Fiora 114, Garen 86, Jinx 222,
   Caitlyn 51, Kai'Sa 145, Lee Sin 64, Vi 254, Sejuani 113, Ornn 516, Malphite 54, Thresh 412,
   Lulu 117, Nautilus 111, Rek'Sai 421, Kindred 203. */
const T = (role, champion) => [tidewright, role, champion]
const K = (role, champion) => [kelpie, role, champion]
const Q = (role, champion) => [quillon, role, champion]
const G = (role, champion) => [glimmer, role, champion]

const MID = 'MIDDLE'
const GAMES = [
  // Briar mid, Tidewright jungle: the main duo.
  [MID, 103, [T('JUNGLE', 64)], true],
  [MID, 103, [T('JUNGLE', 64), Q('TOP', 516)], true],
  [MID, 103, [T('JUNGLE', 64)], false],
  [MID, 103, [T('JUNGLE', 64), Q('TOP', 54)], true],
  [MID, 103, [T('JUNGLE', 64)], true],
  [MID, 103, [T('JUNGLE', 64)], false],
  [MID, 103, [T('JUNGLE', 64), Q('TOP', 516)], true],
  [MID, 134, [T('JUNGLE', 254)], true],
  [MID, 134, [T('JUNGLE', 254), Q('TOP', 516)], false],
  [MID, 134, [T('JUNGLE', 254)], true],
  [MID, 134, [T('JUNGLE', 254), K('UTILITY', 412)], false],
  [MID, 134, [T('JUNGLE', 254)], true],
  [MID, 134, [T('JUNGLE', 254), Q('TOP', 54)], false],
  [MID, 61, [T('JUNGLE', 113)], false],
  [MID, 61, [T('JUNGLE', 113), K('UTILITY', 117)], true],
  [MID, 61, [T('JUNGLE', 113), Q('TOP', 516)], true],
  [MID, 61, [T('JUNGLE', 113)], false],
  [MID, 61, [T('JUNGLE', 113)], true],
  [MID, 517, [T('JUNGLE', 64), K('UTILITY', 412)], false],
  [MID, 517, [T('JUNGLE', 64), Q('TOP', 54)], true],
  [MID, 517, [T('JUNGLE', 64)], false],
  [MID, 517, [T('JUNGLE', 64)], true],
  // Briar top, Tidewright jungle.
  ['TOP', 114, [T('JUNGLE', 254)], true],
  ['TOP', 114, [T('JUNGLE', 254)], false],
  ['TOP', 114, [T('JUNGLE', 254)], true],
  ['TOP', 114, [T('JUNGLE', 254)], false],
  ['TOP', 114, [T('JUNGLE', 254)], true],
  ['TOP', 86, [T('JUNGLE', 113)], false],
  ['TOP', 86, [T('JUNGLE', 113)], false],
  ['TOP', 86, [T('JUNGLE', 113)], true],
  // Briar bot, Kelpie support: a lot of games, not many wins.
  ['BOTTOM', 222, [K('UTILITY', 412)], true],
  ['BOTTOM', 222, [K('UTILITY', 412), G('JUNGLE', 421)], false],
  ['BOTTOM', 222, [K('UTILITY', 412)], false],
  ['BOTTOM', 222, [K('UTILITY', 412), G('JUNGLE', 421)], true],
  ['BOTTOM', 222, [K('UTILITY', 412)], true],
  ['BOTTOM', 222, [K('UTILITY', 412)], false],
  ['BOTTOM', 51, [K('UTILITY', 117)], false],
  ['BOTTOM', 51, [K('UTILITY', 117), G('JUNGLE', 203)], false],
  ['BOTTOM', 51, [K('UTILITY', 117)], true],
  ['BOTTOM', 51, [K('UTILITY', 117)], false],
  ['BOTTOM', 51, [K('UTILITY', 117)], false],
  ['BOTTOM', 145, [K('UTILITY', 111), G('JUNGLE', 421)], true],
  ['BOTTOM', 145, [K('UTILITY', 111)], false],
  ['BOTTOM', 145, [K('UTILITY', 111)], true],
  ['BOTTOM', 145, [K('UTILITY', 111)], false],
]

/* A small seeded generator: the same games on every run. */
let state = 0x5eed
const random = () => {
  state = (state * 1664525 + 1013904223) % 2 ** 32
  return state / 2 ** 32
}
const shuffled = (list) => {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const id = (index) => `NA1_${6190000001 + index}`
const ids = GAMES.map((_, index) => id(index))
const existing = new Set(
  (await rows(`SELECT match_id FROM matches WHERE match_id IN (${ids.map(quote).join(',')})`)).map(
    (row) => row.match_id
  )
)
if (existing.size === GAMES.length) {
  console.log('Friends demo games already seeded.')
  process.exit(0)
}

/* Templates: the profile's own demo games, by its seat and result. */
const earliest = await rows(
  `SELECT min(game_start_ms) AS t FROM participants PREWHERE puuid = ${quote(me.puuid)}`
)
const own = await rows(
  `SELECT match_id, team_position, win FROM participants
   PREWHERE puuid = ${quote(me.puuid)}
   WHERE match_id NOT LIKE 'NA1_619%' AND queue_id != 0
   ORDER BY match_id`
)
const pools = new Map()
for (const row of shuffled(own)) {
  const key = `${row.team_position}:${Number(row.win) === 1}`
  pools.set(key, [...(pools.get(key) ?? []), row.match_id])
}
const used = new Map()
const templates = GAMES.map(([role, , , win]) => {
  const key = `${role}:${win}`
  const pool = pools.get(key) ?? []
  if (!pool.length) throw new Error(`No demo game to clone for ${key}.`)
  const next = used.get(key) ?? 0
  used.set(key, next + 1)
  return pool[next % pool.length]
})

const unique = [...new Set(templates)]
const [matchRows, participantRows] = await Promise.all([
  rows(`SELECT * FROM matches WHERE match_id IN (${unique.map(quote).join(',')})`),
  rows(`SELECT * FROM participants WHERE match_id IN (${unique.map(quote).join(',')})`),
])

/* Strangers: fictional players who appear once. */
const FIRST = [
  'Amber',
  'Cinder',
  'Hollow',
  'Velvet',
  'Quiet',
  'Rook',
  'Sable',
  'Thistle',
  'Umber',
  'Wren',
]
const SECOND = [
  'Brook',
  'Fen',
  'Gale',
  'Harrow',
  'Lantern',
  'Mire',
  'Pike',
  'Reed',
  'Spire',
  'Vale',
]
const TAGS = ['EUW', 'NA1', '0427', '2211', 'LUX', 'ZEN', 'GG']
let strangers = 0
function stranger() {
  const n = strangers++
  const name = `${FIRST[n % FIRST.length]} ${SECOND[Math.floor(n / FIRST.length) % SECOND.length]}`
  return {
    puuid: `demofriends${String(n).padStart(4, '0')}`.padEnd(78, 'x'),
    gameName: n >= 100 ? `${name} ${Math.floor(n / 100)}` : name,
    tagLine: TAGS[n % TAGS.length],
  }
}

/* Evenings from August 23: three games a session, a session every other day. */
const DAY = 86_400_000
const start = Date.UTC(2026, 7, 23, 18, 30)
const order = shuffled(GAMES.map((_, index) => index))
const startOf = new Map(
  order.map((index, position) => [
    index,
    start +
      Math.floor(position / 3) * 2 * DAY +
      (position % 3) * 38 * 60_000 +
      Math.floor(random() * 20) * 60_000,
  ])
)
const latest = Math.max(...startOf.values())
if (latest >= Number(earliest[0]?.t ?? Infinity))
  throw new Error('Seeded games would overlap the demo games.')

const newMatches = []
const newParticipants = []
GAMES.forEach(([myRole, myChampion, seats], index) => {
  const matchId = id(index)
  if (existing.has(matchId)) return
  const template = templates[index]
  const gameStartMs = startOf.get(index)
  const match = matchRows.find((row) => row.match_id === template)
  const copy = { ...match, match_id: matchId, platform: 'NA1', game_start_ms: gameStartMs }
  delete copy.ingested_at
  newMatches.push(copy)

  const lobby = participantRows.filter((row) => row.match_id === template)
  const mine = lobby.find((row) => row.puuid === me.puuid)
  for (const row of lobby) {
    const copy = { ...row, match_id: matchId, platform: 'NA1', game_start_ms: gameStartMs }
    delete copy.ingested_at
    if (row.puuid === me.puuid) {
      copy.champion_id = myChampion
      copy.team_position = myRole
    } else {
      const seat =
        row.team_id === mine.team_id ? seats.find(([, role]) => role === row.team_position) : null
      const who = seat ? seat[0] : stranger()
      copy.puuid = who.puuid
      copy.riot_id_game_name = who.gameName
      copy.riot_id_tag_line = who.tagLine
      if (seat) {
        copy.champion_id = seat[2]
        copy.profile_icon_id = who.icon
        copy.summoner_level = who.level
      }
    }
    newParticipants.push(copy)
  }
})

const body = (list) => list.map((row) => JSON.stringify(row)).join('\n')
await clickhouse('INSERT INTO matches FORMAT JSONEachRow', body(newMatches))
await clickhouse('INSERT INTO participants FORMAT JSONEachRow', body(newParticipants))
console.log(`Seeded ${newMatches.length} friends demo games for ${me.gameName}#${me.tagLine}.`)
