import type { Clip, ClipEvent } from './clip_types.js'

/** "9:12": a moment of a game. */
export const clipClock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** "0:21": a clip's length. */
export const clipSeconds = (ms: number) => clipClock(Math.round(ms / 1000))

/** What the recorder caught, as the clip page says it. Invade names the event, never judges it. */
export const EVENT_WORD: Record<ClipEvent, string> = {
  kill: 'Kill',
  death: 'Death',
  assist: 'Assist',
  objective: 'Objective',
  manual: 'Clip',
}

/** The public clips of a match or a player, as `GET /api/clips` answers them. */
export async function fetchClips(query: { match?: string; puuid?: string }): Promise<Clip[]> {
  const params = new URLSearchParams(query as Record<string, string>)
  const response = await fetch(`/api/clips?${params}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) return []
  const data = (await response.json().catch(() => null)) as { clips?: Clip[] } | null
  return data?.clips ?? []
}
