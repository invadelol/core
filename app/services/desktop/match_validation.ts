import { normalizePlatform } from '#services/riot/routing'
import type { LcuParticipant, MatchUpload } from '#types/desktop'

/**
 * Structural checks on an upload (docs/desktop-sync.md §4.1). Pure: the clock
 * and the champion list come in as arguments, so every rule is testable.
 *
 * These rules cannot prove a game happened; match-v5 does that. They make a
 * forged or corrupted upload expensive to produce and cheap to reject, and
 * they guarantee the row builders never see a shape they were not written for.
 */

/** Matchmade queues the website shows (§4.3). Nexus Blitz (1300) is played on map 21: excluded. */
export const DESKTOP_QUEUES = new Set([
  400, 420, 430, 440, 450, 480, 490, 700, 720, 900, 1020, 1700, 1710, 1900, 2300, 2400,
])

/** Summoner's Rift, Howling Abyss, Rings of Wrath (Arena). */
export const DESKTOP_MAPS = new Set([11, 12, 30])
export const ARENA_MAP = 30

const SKEW = 5 * 60 * 1000
const MAX_AGE = 7 * 24 * 60 * 60 * 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Upper bounds a real game stays well under. */
const LIMITS: Array<[keys: string[], max: number]> = [
  [['kills', 'deaths', 'assists'], 100],
  [['totalMinionsKilled', 'neutralMinionsKilled'], 2000],
  [['goldEarned'], 150_000],
  [
    [
      'totalDamageDealtToChampions',
      'physicalDamageDealtToChampions',
      'magicDamageDealtToChampions',
      'trueDamageDealtToChampions',
      'totalDamageTaken',
    ],
    500_000,
  ],
]

const REQUIRED_STATS = ['kills', 'deaths', 'assists'] as const

export interface ValidationContext {
  now: number
  /**
   * Champion ids the website knows. Null when the list could not be loaded,
   * in which case any id in the range Riot uses is accepted.
   */
  championIds: ReadonlySet<number> | null
}

function stat(participant: LcuParticipant, key: string): number {
  const value = participant.stats?.[key]
  return typeof value === 'number' ? value : 0
}

/** The first rule the upload breaks, or null when it passes them all. */
export function validateStructure(upload: MatchUpload, context: ValidationContext): string | null {
  const { game } = upload

  // Identity of the match.
  if (!/^[A-Z0-9]+_[0-9]+$/.test(upload.matchId)) return 'matchId is malformed'
  if (upload.matchId !== `${game.platformId}_${game.gameId}`) {
    return 'matchId does not match platformId and gameId'
  }
  try {
    if (normalizePlatform(game.platformId) !== game.platformId) return 'platform is not canonical'
  } catch {
    return `platform ${game.platformId} is not supported`
  }

  // What kind of game.
  if (game.gameType !== 'MATCHED_GAME') return 'not a matchmade game'
  if (!DESKTOP_QUEUES.has(game.queueId)) return `queue ${game.queueId} is not accepted`
  if (!DESKTOP_MAPS.has(game.mapId)) return `map ${game.mapId} is not accepted`

  // When.
  if (game.gameCreation > context.now + SKEW) return 'game is in the future'
  if (context.now - game.gameCreation > MAX_AGE) return 'game is older than 7 days'
  if (!Number.isInteger(game.gameDuration) || game.gameDuration < 0 || game.gameDuration > 7200) {
    return 'gameDuration is out of range'
  }
  const gameEnd = game.gameCreation + game.gameDuration * 1000
  if (upload.capturedAt < gameEnd - SKEW) return 'captured before the game ended'
  if (upload.capturedAt > context.now + SKEW) return 'capturedAt is in the future'

  // Who.
  const arena = game.mapId === ARENA_MAP
  const participants = game.participants
  if (arena ? participants.length < 2 || participants.length > 16 : participants.length !== 10) {
    return `${participants.length} participants`
  }

  const ids = new Set<number>()
  for (const participant of participants) ids.add(participant.participantId)
  if (ids.size !== participants.length) return 'participantIds are not unique'

  const identities = new Map<number, (typeof game.participantIdentities)[number]>()
  for (const identity of game.participantIdentities) {
    identities.set(identity.participantId, identity)
  }
  const raws = new Set<string>()
  for (const participant of participants) {
    const identity = identities.get(participant.participantId)
    if (!identity?.player) return `participant ${participant.participantId} has no identity`
    const { puuid, gameName, tagLine } = identity.player
    if (typeof puuid !== 'string' || !UUID.test(puuid)) {
      return `participant ${participant.participantId} has no raw PUUID`
    }
    if (!gameName || !tagLine) return `participant ${participant.participantId} has no Riot ID`
    raws.add(puuid.toLowerCase())
  }
  if (raws.size !== participants.length) return 'raw PUUIDs are not unique'
  if (!raws.has(upload.uploader.toLowerCase())) return 'the uploader is not a participant'

  for (const participant of participants) {
    const { championId } = participant
    const known = context.championIds
      ? context.championIds.has(championId)
      : Number.isInteger(championId) && championId > 0 && championId < 2000
    if (!known) return `champion ${championId} is unknown`

    for (const [key, value] of Object.entries(participant.stats ?? {})) {
      if (typeof value === 'boolean') continue
      if (typeof value !== 'number' || !Number.isFinite(value))
        return `stats.${key} is not a number`
    }
    for (const key of REQUIRED_STATS) {
      if (typeof participant.stats?.[key] !== 'number') return `stats.${key} is missing`
    }
    if (typeof participant.stats?.win !== 'boolean') return 'stats.win is missing'
    for (const [keys, max] of LIMITS) {
      for (const key of keys) {
        const value = stat(participant, key)
        if (value < 0 || value > max) return `stats.${key} is out of range`
      }
    }
  }

  // The scoreboard has to add up.
  if (!arena) {
    const teams = new Map<number, LcuParticipant[]>()
    for (const participant of participants) {
      const team = teams.get(participant.teamId) ?? []
      team.push(participant)
      teams.set(participant.teamId, team)
    }
    if (teams.size !== 2 || teams.get(100)?.length !== 5 || teams.get(200)?.length !== 5) {
      return 'teams are not two teams of five'
    }

    const total = (teamId: number, key: string) =>
      teams.get(teamId)!.reduce((sum, participant) => sum + stat(participant, key), 0)
    for (const [team, enemy] of [
      [100, 200],
      [200, 100],
    ]) {
      // Executions die without a killer, so deaths can exceed kills, never the reverse.
      const kills = total(team, 'kills')
      if (kills > total(enemy, 'deaths')) return `team ${team} kills exceed enemy deaths`
      for (const participant of teams.get(team)!) {
        if (stat(participant, 'assists') > kills) return `team ${team} assists exceed its kills`
      }
    }

    const winners = game.teams.filter((team) => team.win === 'Win')
    if (winners.length !== 1 || game.teams.length !== 2) return 'not exactly one winning team'
    const winner = winners[0].teamId
    for (const participant of participants) {
      if (participant.stats.win !== (participant.teamId === winner)) {
        return `participant ${participant.participantId} result disagrees with the team result`
      }
    }
  }

  return null
}
