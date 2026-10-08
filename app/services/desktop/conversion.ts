import { createHash } from 'node:crypto'
import type { RiotAPITypes } from '#services/riot/api'
import type { Completeness } from '#models/match_source'
import type {
  LcuEvent,
  LcuParticipant,
  LcuParticipantFrame,
  LcuStats,
  LcuTimeline,
  MatchUpload,
} from '#types/desktop'
import { ARENA_MAP } from '#services/desktop/match_validation'

type MatchDTO = RiotAPITypes.MatchV5.MatchDTO
type MatchTimelineDTO = RiotAPITypes.MatchV5.MatchTimelineDTO

/**
 * League client match history → match-v5 (docs/desktop-sync.md §4.2).
 *
 * The output only has to satisfy the existing row builders
 * (`buildMatchRow`, `buildParticipantRows`, `buildTimelineRows`), so a
 * desktop game and a Riot game land in ClickHouse through exactly the same
 * code. Anything the client does not report is left out rather than made up;
 * the builders store it as 0 and `completenessOf` records that it is missing.
 */

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function stat(stats: LcuStats | undefined, key: string): number {
  return number(stats?.[key])
}

/** The rune page: perk0–3 are the primary tree, perk4–5 the secondary one. */
function perksOf(stats: LcuStats) {
  const selection = (slot: number) => ({
    perk: stat(stats, `perk${slot}`),
    var1: stat(stats, `perk${slot}Var1`),
    var2: stat(stats, `perk${slot}Var2`),
    var3: stat(stats, `perk${slot}Var3`),
  })
  return {
    // Stat shards are not part of the client's match history.
    styles: [
      {
        description: 'primaryStyle',
        style: stat(stats, 'perkPrimaryStyle'),
        selections: [0, 1, 2, 3].map(selection),
      },
      {
        description: 'subStyle',
        style: stat(stats, 'perkSubStyle'),
        selections: [4, 5].map(selection),
      },
    ],
  }
}

/** Raw PUUID (lower case) → API PUUID; participants missing from it convert with an empty puuid. */
export type PuuidMap = ReadonlyMap<string, string>

export function toMatchDto(upload: MatchUpload, puuids: PuuidMap): MatchDTO {
  const { game } = upload
  const identities = new Map(game.participantIdentities.map((i) => [i.participantId, i.player]))
  const participants = [...game.participants].sort((a, b) => a.participantId - b.participantId)

  const converted = participants.map((participant) => {
    const player = identities.get(participant.participantId)
    const stats = participant.stats ?? {}
    // The client and match-v5 share almost every stat name; the one that
    // differs is renamed, the rest pass through untouched.
    const { magicalDamageTaken, ...shared } = stats
    const position = participant.position ?? ''
    return {
      ...shared,
      ...(magicalDamageTaken === undefined ? {} : { magicDamageTaken: magicalDamageTaken }),
      participantId: participant.participantId,
      teamId: participant.teamId,
      championId: participant.championId,
      puuid: (player && puuids.get(player.puuid.toLowerCase())) ?? '',
      riotIdGameName: player?.gameName ?? '',
      riotIdTagline: player?.tagLine ?? '',
      profileIcon: number(player?.profileIcon),
      summoner1Id: number(participant.spell1Id),
      summoner2Id: number(participant.spell2Id),
      // Inferred by the app; match-v5 would have Riot's own assignment here.
      teamPosition: position,
      individualPosition: position,
      lane: participant.timeline?.lane ?? '',
      role: participant.timeline?.role ?? '',
      win: stats.win === true,
      perks: perksOf(stats),
    }
  })

  const teamKills = (teamId: number) =>
    participants
      .filter((participant) => participant.teamId === teamId)
      .reduce((sum, participant) => sum + stat(participant.stats, 'kills'), 0)

  const teams = game.teams.map((team) => ({
    teamId: team.teamId,
    win: team.win === 'Win',
    bans: (team.bans ?? []).map((ban) => ({ championId: ban.championId, pickTurn: ban.pickTurn })),
    objectives: {
      baron: { first: team.firstBaron === true, kills: number(team.baronKills) },
      champion: { first: team.firstBlood === true, kills: teamKills(team.teamId) },
      dragon: { first: team.firstDargon === true, kills: number(team.dragonKills) },
      horde: { first: false, kills: number(team.hordeKills) },
      inhibitor: { first: team.firstInhibitor === true, kills: number(team.inhibitorKills) },
      riftHerald: { first: team.firstRiftHerald === true, kills: number(team.riftHeraldKills) },
      tower: { first: team.firstTower === true, kills: number(team.towerKills) },
    },
  }))

  return {
    metadata: {
      dataVersion: 'desktop-1',
      matchId: upload.matchId,
      participants: converted.map((participant) => participant.puuid),
    },
    info: {
      gameId: game.gameId,
      platformId: game.platformId,
      // The client reports when the game was created, not when it started;
      // the row builders fall back to this, and nothing here pretends otherwise.
      gameCreation: game.gameCreation,
      gameDuration: game.gameDuration,
      gameMode: game.gameMode,
      gameType: game.gameType,
      gameVersion: game.gameVersion,
      mapId: game.mapId,
      queueId: game.queueId,
      participants: converted,
      teams,
    },
  } as unknown as MatchDTO
}

const FRAME_FIELDS = [
  'totalGold',
  'currentGold',
  'goldPerSecond',
  'xp',
  'level',
  'minionsKilled',
  'jungleMinionsKilled',
  'timeEnemySpentControlled',
] as const

const EVENT_TYPES = new Set([
  'CHAMPION_KILL',
  'ELITE_MONSTER_KILL',
  'BUILDING_KILL',
  'SKILL_LEVEL_UP',
  'ITEM_PURCHASED',
  'ITEM_SOLD',
  'ITEM_UNDO',
  'ITEM_DESTROYED',
  'WARD_PLACED',
  'WARD_KILL',
])
const EVENT_NUMBERS = [
  'participantId',
  'killerId',
  'victimId',
  'teamId',
  'itemId',
  'afterId',
  'beforeId',
  'skillSlot',
  'creatorId',
] as const
const EVENT_STRINGS = [
  'monsterType',
  'monsterSubType',
  'buildingType',
  'towerType',
  'laneType',
  'levelUpType',
  'wardType',
] as const

function pointOf(value: unknown) {
  const point = value as { x?: unknown; y?: unknown } | null | undefined
  return point && typeof point === 'object' ? { x: number(point.x), y: number(point.y) } : undefined
}

function frameOf(key: string, frame: LcuParticipantFrame) {
  const out: Record<string, unknown> = { participantId: number(frame.participantId ?? Number(key)) }
  for (const field of FRAME_FIELDS) {
    if (typeof frame[field] === 'number') out[field] = frame[field]
  }
  const at = pointOf(frame.position)
  if (at) out.position = at
  return out
}

function eventOf(event: LcuEvent) {
  const out: Record<string, unknown> = { type: event.type, timestamp: number(event.timestamp) }
  for (const field of EVENT_NUMBERS) {
    if (typeof event[field] === 'number') out[field] = event[field]
  }
  for (const field of EVENT_STRINGS) {
    if (typeof event[field] === 'string') out[field] = event[field]
  }
  if (Array.isArray(event.assistingParticipantIds)) {
    out.assistingParticipantIds = event.assistingParticipantIds.filter(
      (id): id is number => typeof id === 'number'
    )
  }
  const at = pointOf(event.position)
  if (at) out.position = at
  return out
}

/**
 * The client's timeline in match-v5's envelope. Participant ids are the
 * game's own (1–10 in team order on both sides), so frames keep their keys
 * and `participants` ties them to whichever PUUIDs the match was stored with.
 */
export function toTimelineDto(
  timeline: LcuTimeline,
  matchId: string,
  gameId: number,
  participants: Array<{ participantId: number; puuid: string }>
): MatchTimelineDTO {
  return {
    metadata: {
      dataVersion: 'desktop-1',
      matchId,
      participants: participants.map((participant) => participant.puuid),
    },
    info: {
      gameId,
      frameInterval: number(timeline.frameInterval),
      participants,
      frames: (timeline.frames ?? []).map((frame) => ({
        timestamp: number(frame.timestamp),
        participantFrames: Object.fromEntries(
          Object.entries(frame.participantFrames ?? {}).map(([key, value]) => [
            key,
            frameOf(key, value ?? {}),
          ])
        ),
        events: (frame.events ?? [])
          .filter((event) => event && EVENT_TYPES.has(event.type))
          .map(eventOf),
      })),
    },
  } as unknown as MatchTimelineDTO
}

/** What a desktop game lacks compared with match-v5 (`match_source.completeness`). */
export function completenessOf(upload: MatchUpload): Completeness {
  const positions = upload.game.participants.every((participant) => Boolean(participant.position))
  return {
    pings: false,
    summonerLevel: false,
    statPerks: false,
    timeline: Boolean(upload.timeline?.frames?.length),
    position: positions ? 'inferred' : 'absent',
  }
}

/** A Riot game is complete; only its timeline can be missing. */
export function riotCompleteness(timeline: boolean): Completeness {
  return { pings: true, summonerLevel: true, statPerks: true, timeline, position: 'riot' }
}

/* ── Comparison ─────────────────────────────────────────────────
   Two sources describe the same game when they agree on what the contract
   names: champions, kills, deaths, assists, results and duration. Players
   are compared as a multiset, which needs no identity mapping and holds in
   One for All, where a team shares one champion.
   ────────────────────────────────────────────────────────────── */

export interface PlayerFacts {
  teamId: number
  championId: number
  kills: number
  deaths: number
  assists: number
  win: boolean
}

export interface GameFacts {
  duration: number
  /** Arena teams are subteams the two sources number differently. */
  arena: boolean
  players: PlayerFacts[]
}

export function uploadFacts(upload: MatchUpload): GameFacts {
  return {
    duration: upload.game.gameDuration,
    arena: upload.game.mapId === ARENA_MAP,
    players: upload.game.participants.map((participant: LcuParticipant) => ({
      teamId: participant.teamId,
      championId: participant.championId,
      kills: stat(participant.stats, 'kills'),
      deaths: stat(participant.stats, 'deaths'),
      assists: stat(participant.stats, 'assists'),
      win: participant.stats?.win === true,
    })),
  }
}

export function riotFacts(info: RiotAPITypes.MatchV5.MatchInfoDTO): GameFacts {
  return {
    duration: number(info.gameDuration),
    arena: info.mapId === ARENA_MAP,
    players: (info.participants ?? []).map((participant) => ({
      teamId: number(participant.teamId),
      championId: number(participant.championId),
      kills: number(participant.kills),
      deaths: number(participant.deaths),
      assists: number(participant.assists),
      win: participant.win === true,
    })),
  }
}

function factKey(player: PlayerFacts, arena: boolean) {
  const team = arena ? '' : `${player.teamId}:`
  return `${team}${player.championId}:${player.kills}/${player.deaths}/${player.assists}:${player.win ? 'W' : 'L'}`
}

/** Every way `a` and `b` disagree; empty when they describe the same game. */
export function compareFacts(a: GameFacts, b: GameFacts): string[] {
  const differences: string[] = []
  // The client and match-v5 report the same whole seconds; allow a rounding step.
  if (Math.abs(a.duration - b.duration) > 1) {
    differences.push(`duration ${a.duration} vs ${b.duration}`)
  }
  if (a.players.length !== b.players.length) {
    differences.push(`${a.players.length} vs ${b.players.length} players`)
    return differences
  }
  const arena = a.arena || b.arena
  const left = a.players.map((player) => factKey(player, arena)).sort()
  const right = b.players.map((player) => factKey(player, arena)).sort()
  for (const [index, entry] of left.entries()) {
    if (entry !== right[index]) differences.push(`player ${entry} vs ${right[index]}`)
  }
  return differences
}

/**
 * Identity of the game an upload describes, independent of who sent it and
 * when: two honest devices in the same game produce the same hash.
 */
export function canonicalHash(upload: MatchUpload): string {
  const { game } = upload
  const identities = new Map(game.participantIdentities.map((i) => [i.participantId, i.player]))
  const players = [...game.participants]
    .sort((a, b) => a.participantId - b.participantId)
    .map((participant) => [
      participant.participantId,
      identities.get(participant.participantId)?.puuid.toLowerCase() ?? '',
      participant.championId,
      participant.teamId,
      ...[
        'kills',
        'deaths',
        'assists',
        'goldEarned',
        'totalMinionsKilled',
        'neutralMinionsKilled',
        'item0',
        'item1',
        'item2',
        'item3',
        'item4',
        'item5',
        'item6',
      ].map((name) => stat(participant.stats, name)),
      participant.stats?.win === true,
    ])
  const canonical = JSON.stringify([
    upload.matchId,
    game.gameCreation,
    game.gameDuration,
    game.queueId,
    players,
  ])
  return createHash('sha256').update(canonical).digest('hex')
}

/**
 * The client's timeline can only be stored against Riot's participants when
 * both number the players the same way.
 */
export function timelineFits(upload: MatchUpload, info: RiotAPITypes.MatchV5.MatchInfoDTO) {
  const riot = new Map((info.participants ?? []).map((p) => [p.participantId, p.championId]))
  return (
    riot.size === upload.game.participants.length &&
    upload.game.participants.every(
      (participant) => riot.get(participant.participantId) === participant.championId
    )
  )
}
