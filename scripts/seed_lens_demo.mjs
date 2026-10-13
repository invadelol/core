#!/usr/bin/env node
/**
 * Local development only: gives part of the fictional demo profile Briar Signal#5555 the minute
 * frames and events a Riot timeline would have, so the profile's Lens can show its Laning domain.
 *
 *   node scripts/seed_lens_demo.mjs [--reseed]
 *
 * The demo games are synthetic and stored without timelines. For about half of the profile's
 * recent laned games, this writes `match_timeline` frames for all ten players (CS, gold, XP and
 * levels drawn towards each player's final line, kills, deaths and assists from the events) and
 * `match_events` kills and epic monsters consistent with the stored game. Everything is drawn from
 * a generator seeded by the match id, so a game always gets the same timeline, and games that
 * already have frames or events are left alone: running it twice changes nothing. `--reseed`
 * deletes what it wrote for the chosen games first, to draw them again after a change here.
 *
 * Reads CLICKHOUSE_* from .env. Refuses to run with NODE_ENV=production or against a ClickHouse
 * that is not on this machine.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8')
    .split('\n')
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.replace(/^['"]|['"]$/g, '')])
)
const setting = (key) => process.env[key] ?? env[key]

const url = new URL(setting('CLICKHOUSE_URL') ?? 'http://127.0.0.1:8123')
if (
  (setting('NODE_ENV') ?? '') === 'production' ||
  !['127.0.0.1', 'localhost', '::1'].includes(url.hostname)
) {
  console.error('seed_lens_demo: local development databases only.')
  process.exit(1)
}

/** The fictional demo profile. */
const DEMO = { gameName: 'Briar Signal', tagLine: '5555' }
/** Recent laned games considered, and the share of them that get a timeline. */
const RECENT = 120
const SHARE = 0.55

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

const select = async (query) =>
  (await clickhouse(`${query} FORMAT JSONEachRow`))
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))

const quote = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/* ── A generator seeded by the match id ────────────────────────── */
function seeded(text) {
  let h = 2166136261
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const gauss = (rand) => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
const pick = (rand, list) => list[Math.floor(rand() * list.length)]
function weighted(rand, list, weight) {
  const total = list.reduce((s, x) => s + weight(x), 0)
  if (total <= 0) return null
  let r = rand() * total
  for (const x of list) if ((r -= weight(x)) <= 0) return x
  return list[list.length - 1]
}

const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']
/** Experience needed for each level, 1 to 18. */
const XP = [
  0, 280, 660, 1140, 1720, 2400, 3180, 4060, 5040, 6120, 7300, 8580, 9960, 11440, 13020, 14700,
  16480, 18360,
]
const levelOf = (xp) => XP.filter((need) => xp >= need).length
const SKILLS = [1, 2, 3, 1, 1, 4, 1, 2, 1, 2, 4, 2, 2, 3, 3, 4, 3, 3]
/** Where each role spends its laning phase, as map ranges [x0, x1, y0, y1]. */
const LANE_AREA = {
  TOP: [900, 4200, 9800, 13900],
  JUNGLE: [3000, 11800, 3000, 11800],
  MIDDLE: [5600, 9200, 5600, 9200],
  BOTTOM: [9800, 13900, 900, 4200],
  UTILITY: [9800, 13900, 900, 4200],
}
const DRAGONS = [
  'FIRE_DRAGON',
  'WATER_DRAGON',
  'EARTH_DRAGON',
  'AIR_DRAGON',
  'HEXTECH_DRAGON',
  'CHEMTECH_DRAGON',
]

function timelineOf(match, players, rand, demoPuuid) {
  const D = match.duration_sec / 60
  const end = match.duration_sec * 1000
  const byTeam = { 100: [], 200: [] }
  players
    .sort(
      (a, b) =>
        a.team_id - b.team_id || ROLES.indexOf(a.team_position) - ROLES.indexOf(b.team_position)
    )
    .forEach((p, i) => {
      p.id = i + 1
      p.left = { kills: p.kills, deaths: p.deaths, assists: p.assists }
      byTeam[p.team_id]?.push(p)
    })
  const enemyOf = (team) => (team === 100 ? 200 : 100)
  const laneOpponent = (p) =>
    byTeam[enemyOf(p.team_id)].find((o) => o.team_position === p.team_position)

  /* Deaths first, each with its time; the demo player dies early a little more often. */
  const events = []
  const when = (early) => 2.5 + (D - 2.5) * rand() ** (early ? 0.8 : 0.65)
  for (const team of [100, 200]) {
    const enemies = byTeam[enemyOf(team)]
    for (const victim of byTeam[team]) {
      for (let n = 0; n < victim.deaths; n++) {
        const t = when(victim.puuid === demoPuuid)
        const opponent = laneOpponent(victim)
        let killer =
          t < 14 && opponent?.left.kills > 0 && rand() < 0.55
            ? opponent
            : weighted(rand, enemies, (e) => e.left.kills)
        if (killer) killer.left.kills--
        events.push({ t, kind: 'kill', team: enemyOf(team), killer, victim, assists: [] })
      }
    }
  }
  /* Kills the deaths did not use: late fights. */
  for (const team of [100, 200]) {
    for (const killer of byTeam[team]) {
      while (killer.left.kills > 0) {
        killer.left.kills--
        const victim = pick(rand, byTeam[enemyOf(team)])
        events.push({ t: 14 + (D - 15) * rand(), kind: 'kill', team, killer, victim, assists: [] })
      }
    }
  }
  /* Assists: early kills are often solo, later ones are fights. */
  for (const e of events.filter((x) => x.killer)) {
    const mates = byTeam[e.team].filter((m) => m !== e.killer)
    const odds = e.t < 14 ? [0.35, 0.35, 0.2, 0.1] : [0.1, 0.25, 0.3, 0.2, 0.15]
    let n = 0
    for (let r = rand(); n < odds.length - 1 && (r -= odds[n]) > 0; ) n++
    for (let i = 0; i < n; i++) {
      const helper = weighted(
        rand,
        mates.filter((m) => !e.assists.includes(m)),
        (m) => m.left.assists
      )
      if (!helper) break
      helper.left.assists--
      e.assists.push(helper)
    }
  }
  for (const p of players) {
    const fights = events.filter(
      (e) => e.team === p.team_id && e.killer && e.killer !== p && !e.assists.includes(p)
    )
    while (p.left.assists > 0 && fights.length) {
      fights.splice(Math.floor(rand() * fights.length), 1)[0].assists.push(p)
      p.left.assists--
    }
  }

  /* Epic monsters and buildings, as the stored game counts them. */
  const jungler = (team) =>
    byTeam[team].find((p) => p.team_position === 'JUNGLE') ?? byTeam[team][0]
  const objective = (kind, team, t, sub = '', lane = '') =>
    events.push({
      t,
      kind,
      team,
      killer: rand() < 0.85 ? jungler(team) : pick(rand, byTeam[team]),
      victim: null,
      assists: [],
      sub,
      lane,
    })
  const dragons = [...Array(match.t1_dragons).fill(100), ...Array(match.t2_dragons).fill(200)].sort(
    () => rand() - 0.5
  )
  let t = 5.5 + rand() * 2
  for (const team of dragons) {
    objective('dragon', team, Math.min(t, D - 0.5), pick(rand, DRAGONS))
    t += 5 + rand() * 2.5
  }
  for (const [team, n] of [
    [100, match.t1_heralds],
    [200, match.t2_heralds],
  ])
    for (let i = 0; i < n; i++) objective('herald', team, Math.min(14 + rand() * 5, D - 0.5))
  for (const [team, n] of [
    [100, match.t1_barons],
    [200, match.t2_barons],
  ])
    for (let i = 0; i < n; i++)
      objective('baron', team, Math.min(21 + rand() * Math.max(1, D - 22), D - 0.5))
  for (const [team, towers] of [
    [100, match.t1_towers],
    [200, match.t2_towers],
  ]) {
    const lanes = { TOP_LANE: 0, MID_LANE: 0, BOT_LANE: 0 }
    const types = ['OUTER_TURRET', 'INNER_TURRET', 'BASE_TURRET']
    for (let i = 0; i < towers; i++) {
      const open = Object.keys(lanes).filter((l) => lanes[l] < 3)
      const lane = open.length ? pick(rand, open) : 'MID_LANE'
      const sub = open.length ? types[lanes[lane]++] : 'NEXUS_TURRET'
      events.push({
        t: Math.min(11 + ((D - 12) * (i + rand())) / Math.max(1, towers), D - 0.3),
        kind: 'tower',
        team,
        killer: pick(rand, byTeam[team]),
        victim: null,
        assists: [],
        sub,
        lane,
      })
    }
  }
  events.sort((a, b) => a.t - b.t)

  /* Minute frames: each player's line drawn towards its final values, with an early lean. */
  const frames = []
  const minutes = Math.floor(match.duration_sec / 60)
  for (const p of players) {
    const lean = 1 + gauss(rand) * 0.07 + (p.puuid === demoPuuid ? 0.05 : 0)
    const goldLean = 1 + (lean - 1) * 0.6 + gauss(rand) * 0.04
    const xpLean = 1 + (lean - 1) * 0.5 + gauss(rand) * 0.03
    const start = p.team_position === 'JUNGLE' ? 1.5 : 1.1
    const finalXp = XP[Math.min(17, Math.max(0, p.champ_level - 1))] + rand() * 600
    const area = LANE_AREA[p.team_position] ?? LANE_AREA.JUNGLE
    let cc = 0
    for (let m = 0; m <= minutes + 1; m++) {
      const ms = m > minutes ? end : m * 60000 + Math.floor(rand() * 300)
      if (ms > end) continue
      const x = Math.min(1, ms / end)
      const f = Math.min(1, Math.max(0, (ms / 60000 - start) / (D - start)))
      const farm = f * (1 + (lean - 1) * (1 - f))
      const lane = Math.round((p.total_cs - p.neutral_minions_killed) * farm)
      const jungle = Math.round(p.neutral_minions_killed * farm)
      const gold = Math.round(500 + p.gold_earned * x ** 1.12 * (1 + (goldLean - 1) * (1 - x)))
      const xp = Math.round(finalXp * x ** 0.85 * (1 + (xpLean - 1) * (1 - x)))
      const done = events.filter((e) => e.t * 60000 <= ms)
      const level = Math.max(1, Math.min(18, levelOf(xp)))
      cc += Math.floor(rand() * 12)
      const laning = ms < 14 * 60000
      frames.push({
        match_id: match.match_id,
        platform: match.platform,
        game_start_ms: match.game_start_ms,
        frame_ms: ms,
        participant_id: p.id,
        puuid: p.puuid,
        team_id: p.team_id,
        spell1: p.spell1,
        spell2: p.spell2,
        primary_style: p.primary_style,
        secondary_style: p.secondary_style,
        keystone: p.keystone,
        rune1: p.keystone,
        rune2: 0,
        rune3: 0,
        rune4: 0,
        rune5: 0,
        rune6: 0,
        stat_offense: 0,
        stat_flex: 0,
        stat_defense: 0,
        skill_order: SKILLS.slice(0, level),
        level,
        xp,
        gold_current: Math.floor(rand() * 1400),
        gold_total: gold,
        gold_per_sec: 0,
        cs: lane,
        jungle_cs: jungle,
        kills: done.filter((e) => e.kind === 'kill' && e.killer === p).length,
        deaths: done.filter((e) => e.kind === 'kill' && e.victim === p).length,
        assists: done.filter((e) => e.kind === 'kill' && e.assists.includes(p)).length,
        pos_x: Math.round(laning ? area[0] + rand() * (area[1] - area[0]) : 600 + rand() * 13600),
        pos_y: Math.round(laning ? area[2] + rand() * (area[3] - area[2]) : 600 + rand() * 13600),
        time_cc: cc,
      })
    }
  }

  const rows = events.map((e) => {
    const area = LANE_AREA[e.victim?.team_position] ?? [2000, 12800, 2000, 12800]
    return {
      match_id: match.match_id,
      platform: match.platform,
      game_start_ms: match.game_start_ms,
      t_ms: Math.round(e.t * 60000),
      kind: e.kind,
      sub: e.sub ?? '',
      lane: e.lane ?? '',
      team_id: e.team,
      killer: e.killer?.id ?? 0,
      victim: e.victim?.id ?? 0,
      assists: e.assists.map((a) => a.id),
      pos_x: Math.round(area[0] + rand() * (area[1] - area[0])),
      pos_y: Math.round(area[2] + rand() * (area[3] - area[2])),
    }
  })
  return { frames, events: rows }
}

const [demo] = await select(
  `SELECT puuid FROM participants WHERE riot_id_game_name = ${quote(DEMO.gameName)} AND riot_id_tag_line = ${quote(DEMO.tagLine)} LIMIT 1`
)
if (!demo) {
  console.error(`seed_lens_demo: ${DEMO.gameName}#${DEMO.tagLine} has no stored games here.`)
  process.exit(1)
}

const recent = await select(`
  SELECT match_id FROM participants
  PREWHERE puuid = ${quote(demo.puuid)}
  WHERE team_position != ''
  ORDER BY game_start_ms DESC, match_id DESC
  LIMIT ${RECENT}
`)
const chosen = recent.map((r) => r.match_id).filter((id) => seeded(`pick:${id}`)() < SHARE)
const ids = chosen.map(quote).join(',')
if (process.argv.includes('--reseed')) {
  for (const table of ['match_timeline', 'match_events'])
    await clickhouse(
      `ALTER TABLE ${table} DELETE WHERE match_id IN (${ids}) SETTINGS mutations_sync = 1`
    )
}
const held = new Set(
  (await select(`SELECT DISTINCT match_id FROM match_timeline WHERE match_id IN (${ids})`)).map(
    (r) => r.match_id
  )
)
const heldEvents = new Set(
  (await select(`SELECT DISTINCT match_id FROM match_events WHERE match_id IN (${ids})`)).map(
    (r) => r.match_id
  )
)
const todo = chosen.filter((id) => !held.has(id))
if (!todo.length) {
  console.log(`seed_lens_demo: all ${chosen.length} chosen games already have a timeline.`)
  process.exit(0)
}

const list = todo.map(quote).join(',')
const matches = await select(`
  SELECT match_id, platform, game_start_ms, duration_sec,
         t1_dragons, t2_dragons, t1_heralds, t2_heralds, t1_barons, t2_barons, t1_towers, t2_towers
  FROM matches WHERE match_id IN (${list})
`)
const participants = await select(`
  SELECT match_id, puuid, team_id, team_position, kills, deaths, assists, champ_level, total_cs,
         neutral_minions_killed, gold_earned, spell1, spell2, primary_style, secondary_style, keystone
  FROM participants WHERE match_id IN (${list})
`)

const frames = []
const events = []
for (const match of matches) {
  for (const key of Object.keys(match))
    if (/^(t[12]_|duration|game_start)/.test(key)) match[key] = Number(match[key])
  const players = participants
    .filter((p) => p.match_id === match.match_id)
    .map((p) =>
      Object.fromEntries(
        Object.entries(p).map(([k, v]) => [
          k,
          typeof v === 'string' && /^\d+$/.test(v) && !['match_id', 'puuid'].includes(k)
            ? Number(v)
            : v,
        ])
      )
    )
  if (players.length !== 10) continue
  const made = timelineOf(match, players, seeded(match.match_id), demo.puuid)
  frames.push(...made.frames)
  if (!heldEvents.has(match.match_id)) events.push(...made.events)
}

const lines = (rows) => rows.map((row) => JSON.stringify(row)).join('\n')
await clickhouse('INSERT INTO match_timeline FORMAT JSONEachRow', lines(frames))
if (events.length) await clickhouse('INSERT INTO match_events FORMAT JSONEachRow', lines(events))
console.log(
  `seed_lens_demo: ${matches.length} games of ${DEMO.gameName}#${DEMO.tagLine} now have a timeline (${frames.length} frames, ${events.length} events).`
)
