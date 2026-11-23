import {
  CLIP_EVENT_KINDS,
  type ClipEvent,
  type ClipEventKind,
} from '../../../inertia/lib/clip_types.js'

/**
 * What happened in a clip, as the app's recorder kept it from the Live Client Data API (game time
 * in ms, who killed whom): checked, cut to the clip's window, and stored with champions only. The
 * app names players by Riot ID or by champion; a Riot ID is turned into the champion its player
 * played in the game and never kept, so a clip names nobody else.
 */

/** Events kept around the clip: those inside it, and this much either side. */
export const EVENT_MARGIN_MS = 3000
const MAX_EVENTS = 60

/** A player of the clip's game, to turn a Riot ID into their champion. */
export interface GamePlayer {
  gameName: string
  tagLine: string
  championId: number
}

const fold = (value: string) => value.toLowerCase().replace(/[^a-z0-9#]/g, '')

/**
 * The champion a name from the Live Client points at: a Riot ID of the game, or a champion's own
 * name; anything else (a turret, a minion, a monster) is null.
 */
function championOf(
  value: unknown,
  players: Map<string, number>,
  champions: Map<string, number>
): number | null {
  if (typeof value !== 'string' || !value.trim() || value.length > 64) return null
  const key = fold(value)
  return players.get(key) ?? champions.get(key.replace('#', '')) ?? null
}

/**
 * The events of a clip from what the app sent: valid kinds at game times inside the window,
 * newest last, players as champions. Malformed entries are dropped, not refused: the clip still
 * posts without them.
 */
export function cleanEvents(
  input: unknown,
  window: { startMs: number; durationMs: number },
  players: GamePlayer[],
  championNames: Record<string, string>
): ClipEvent[] {
  if (!Array.isArray(input)) return []
  const byRiotId = new Map(players.map((p) => [fold(`${p.gameName}#${p.tagLine}`), p.championId]))
  const byName = new Map(
    Object.entries(championNames).map(([id, name]) => [fold(name), Number(id)] as const)
  )
  const from = window.startMs - EVENT_MARGIN_MS
  const to = window.startMs + window.durationMs + EVENT_MARGIN_MS
  const events: ClipEvent[] = []
  for (const raw of input.slice(0, MAX_EVENTS * 4)) {
    if (!raw || typeof raw !== 'object') continue
    const entry = raw as Record<string, unknown>
    const t = entry.t
    const kind = entry.kind as ClipEventKind
    if (!Number.isInteger(t) || (t as number) < from || (t as number) > to) continue
    if (!CLIP_EVENT_KINDS.includes(kind)) continue
    const assisters = Array.isArray(entry.assisters)
      ? entry.assisters
          .slice(0, 4)
          .map((a) => championOf(a, byRiotId, byName))
          .filter((id): id is number => id !== null)
      : []
    const detail =
      typeof entry.detail === 'string' && entry.detail.trim()
        ? entry.detail.replace(/\s+/g, ' ').trim().slice(0, 32)
        : null
    events.push({
      t: t as number,
      kind,
      killer: championOf(entry.killer, byRiotId, byName),
      victim: championOf(entry.victim, byRiotId, byName),
      assisters,
      detail,
    })
  }
  return events.sort((a, b) => a.t - b.t).slice(0, MAX_EVENTS)
}

const MULTI = ['', '', 'Double kill', 'Triple kill', 'Quadra kill', 'Penta kill']
const multiSize = (e: ClipEvent) => {
  const size = Number(e.detail)
  return size >= 2 && size <= 5 ? size : 0
}

/**
 * The clip's biggest event from the side of the champion who posted it, the one its moment names:
 * a multikill, an ace, first blood, an objective, a kill, an assist, a death, in that order.
 */
export function keyEvent(events: ClipEvent[], championId: number): ClipEvent | null {
  const mine = (e: ClipEvent) => e.killer === championId
  const multi = events
    .filter((e) => e.kind === 'multikill' && mine(e) && multiSize(e))
    .sort((a, b) => multiSize(b) - multiSize(a))[0]
  return (
    multi ??
    events.find((e) => e.kind === 'ace' && mine(e)) ??
    events.find((e) => e.kind === 'first_blood' && mine(e) && e.victim !== null) ??
    events.find((e) => e.kind === 'objective' && e.detail) ??
    events.find((e) => e.kind === 'kill' && mine(e) && e.victim !== null) ??
    events.find((e) => e.kind === 'assist' && e.victim !== null) ??
    events.find((e) => e.kind === 'death' && e.killer !== null) ??
    null
  )
}

/**
 * The clip's moment in a few words ("Triple kill", "Solo kill on Lee Sin", "Baron"), from its key
 * event. Invade names what happened, never judges it. Null without events.
 */
export function momentOf(
  events: ClipEvent[],
  championId: number,
  name: (id: number) => string
): string | null {
  const key = keyEvent(events, championId)
  switch (key?.kind) {
    case 'multikill':
      return MULTI[multiSize(key)]
    case 'ace':
      return 'Ace'
    case 'first_blood':
      return `First blood on ${name(key.victim!)}`
    case 'objective':
      return key.detail
    case 'kill':
      return `${key.assisters.length ? 'Kill' : 'Solo kill'} on ${name(key.victim!)}`
    case 'assist':
      return `Assist on ${name(key.victim!)}`
    case 'death':
      return `Death to ${name(key.killer!)}`
    default:
      return null
  }
}
