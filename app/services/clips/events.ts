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

/**
 * The clip's moment in a few words, from the side of the champion who posted it: its biggest
 * event ("Triple kill", "Solo kill on Lee Sin", "Baron"). Invade names what happened, never
 * judges it. Null without events.
 */
export function momentOf(
  events: ClipEvent[],
  championId: number,
  name: (id: number) => string
): string | null {
  const mine = (e: ClipEvent) => e.killer === championId
  const multi = events
    .filter((e) => e.kind === 'multikill' && mine(e))
    .map((e) => Number(e.detail))
    .filter((n) => n >= 2 && n <= 5)
  if (multi.length) return MULTI[Math.max(...multi)]
  if (events.some((e) => e.kind === 'ace' && mine(e))) return 'Ace'
  const first = events.find((e) => e.kind === 'first_blood' && mine(e) && e.victim !== null)
  if (first) return `First blood on ${name(first.victim!)}`
  const objective = events.find((e) => e.kind === 'objective' && e.detail)
  if (objective) return objective.detail
  const kill = events.find((e) => e.kind === 'kill' && mine(e) && e.victim !== null)
  if (kill) return `${kill.assisters.length ? 'Kill' : 'Solo kill'} on ${name(kill.victim!)}`
  const assist = events.find((e) => e.kind === 'assist' && e.victim !== null)
  if (assist) return `Assist on ${name(assist.victim!)}`
  const death = events.find((e) => e.kind === 'death' && e.killer !== null)
  if (death) return `Death to ${name(death.killer!)}`
  return null
}
