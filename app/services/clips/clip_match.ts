import matchRepository from '#services/analytics/match_repository'
import type { Clip, ClipMatch } from '../../../inertia/lib/clip_types.js'
import type { Match, MatchEvent, TimelineEntry } from '../../../inertia/lib/types.js'

/** The objectives the gold line marks, as Riot's glyphs name them. */
const MARKED = new Set(['dragon', 'baron', 'herald', 'grubs', 'tower', 'inhibitor'])

/** The minute-by-minute gold lead of a team, from the timeline's frames. */
function goldLead(frames: TimelineEntry[], teamId: number): [number, number][] {
  const byMinute = new Map<number, number>()
  for (const frame of frames) {
    const minute = Math.round(frame.frameMs / 60_000)
    const sign = frame.teamId === teamId ? 1 : -1
    byMinute.set(minute, (byMinute.get(minute) ?? 0) + sign * frame.goldTotal)
  }
  return [...byMinute].sort((a, b) => a[0] - b[0])
}

/**
 * The stored game of a clip for its match card, or null when the game is not stored (or no longer
 * readable): the card is then left out.
 */
export async function clipMatch(clip: Clip): Promise<ClipMatch | null> {
  const full = await matchRepository.getById(clip.matchId).catch(() => null)
  if (!full) return null
  const timeline = (full.timeline ?? []) as TimelineEntry[]
  const events = (full.events ?? []) as MatchEvent[]
  // The card reads the scoreboard only: the frames and events stay here.
  const match = { ...full, timeline: undefined, events: undefined, shop: undefined } as Match
  const me = match.participants.find((p) => p.championId === clip.championId)
  if (!me) return null
  const objectives = events
    .filter((e) => MARKED.has(e.kind))
    .map((e) => ({ minute: Math.round(e.t / 6) / 10, kind: e.kind, ours: e.team === me.teamId }))
  return {
    match,
    puuid: me.puuid,
    gold: goldLead(timeline, me.teamId),
    objectives,
  }
}
