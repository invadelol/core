import { readFileSync } from 'node:fs'
import { randomBytes, randomUUID } from 'node:crypto'
import type { LcuGame, LcuTimeline, MatchUpload } from '#types/desktop'
import { toMatchDto } from '#services/desktop/conversion'

/**
 * A ranked game as the League client's match history reports it
 * (`/lol-match-history/v1/games/{id}` and `/game-timelines/{id}`, trimmed the
 * way docs/desktop-sync.md §2.5 specifies). Synthesised, but internally
 * consistent: the timeline's kills, deaths and assists add up to the
 * scoreboard, team kills to enemy deaths, objectives to team totals.
 */
const fixture = JSON.parse(readFileSync(new URL('./lcu_game.json', import.meta.url), 'utf8')) as {
  game: LcuGame
  timeline: LcuTimeline
}

/** Participant 3 (Ahri, middle, team 100, the winners). */
export const UPLOADER_PARTICIPANT = 3

export function clone<T>(value: T): T {
  return structuredClone(value)
}

/** An API PUUID: 78 base64url characters, like Riot's. */
export function apiPuuid() {
  return randomBytes(64).toString('base64url').slice(0, 78)
}

export interface UploadOptions {
  /** Epoch ms "now"; the game ends two minutes before it. */
  now?: number
  gameId?: number
  /** Fresh raw PUUIDs and Riot IDs, so tests never collide with each other or real players. */
  fresh?: boolean
  timeline?: boolean
}

/**
 * The fixture as an upload, moved in time so it passes the 7-day rule, and
 * optionally re-identified. Returns a deep copy every time.
 */
export function makeUpload(options: UploadOptions = {}): MatchUpload {
  const now = options.now ?? Date.now()
  const game = clone(fixture.game)
  const end = game.gameCreation + game.gameDuration * 1000
  const shift = now - 2 * 60_000 - end
  game.gameCreation += shift
  if (options.gameId) game.gameId = options.gameId

  if (options.fresh) {
    const suffix = randomBytes(3).toString('hex')
    for (const identity of game.participantIdentities) {
      identity.player.puuid = randomUUID()
      identity.player.gameName = `T${suffix}P${identity.participantId}`
      identity.player.tagLine = 'TST'
    }
  }

  const uploader = game.participantIdentities.find(
    (identity) => identity.participantId === UPLOADER_PARTICIPANT
  )!.player.puuid

  return {
    schema: 1,
    matchId: `${game.platformId}_${game.gameId}`,
    uploader,
    capturedAt: now - 60_000,
    app: '0.2.7',
    game,
    timeline: options.timeline === false ? null : clone(fixture.timeline),
    lp: null,
  }
}

/**
 * What match-v5 would answer for the same game, given each raw PUUID's API
 * PUUID: the converter's output plus the fields only Riot has.
 */
export function riotMatch(upload: MatchUpload, puuids: ReadonlyMap<string, string>) {
  const match = toMatchDto(upload, puuids)
  const info = match.info as any
  info.gameStartTimestamp = upload.game.gameCreation + 45_000
  info.gameEndTimestamp = info.gameStartTimestamp + upload.game.gameDuration * 1000
  info.endOfGameResult = 'GameComplete'
  for (const participant of info.participants) {
    participant.summonerLevel = 412
    participant.allInPings = 2
    participant.enemyMissingPings = 5
    participant.perks.statPerks = { offense: 5005, flex: 5008, defense: 5011 }
  }
  match.metadata.dataVersion = '2'
  return match
}

/** Raw PUUID (lower case) → a fresh API PUUID, for every participant. */
export function apiPuuids(upload: MatchUpload) {
  return new Map(
    upload.game.participantIdentities.map((identity) => [
      identity.player.puuid.toLowerCase(),
      apiPuuid(),
    ])
  )
}
