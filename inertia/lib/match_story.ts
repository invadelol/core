/**
 * The game as a story, shared by the Timeline and the Gold tabs: every kill and objective in order
 * with its tags (first blood, multi-kills), fights (kills a few seconds apart), the three phases of
 * the game, and the state of the game at any second (kill score, gold lead). Pure data: the
 * wording lives in the components. The same logic as the desktop app's `src/profile/story.ts`.
 */
import type { Kill, MatchView, Objective, PlayerView, TimelineView } from './match_view.js'

/** Kills chained less than this many seconds apart are one fight. */
export const FIGHT_GAP = 15
/** The same killer again within this many seconds continues a multi-kill. */
const MULTI_GAP = 10
/** The same objective taken again by the same team within this window is one mark (voidgrubs). */
const MERGE_GAP = 45
/** Laning ends when turret plating falls; the late game starts at 25 minutes. */
export const PHASES = [
  { id: 'early', from: 0, to: 14 * 60 },
  { id: 'mid', from: 14 * 60, to: 25 * 60 },
  { id: 'late', from: 25 * 60, to: Infinity },
] as const
export type PhaseId = (typeof PHASES)[number]['id']

export interface KillEvent {
  kind: 'kill'
  key: string
  t: number
  kill: Kill
  /** Team the kill counts for: the killer's, or the victim's enemies when executed. */
  team: number
  /** 1 = first blood; 2‥5 = the kill that made a double … penta. */
  first: boolean
  multi: number
  /** Index into `fights`, or -1 when the kill stands alone. */
  fight: number
}
export interface ObjectiveEvent {
  kind: 'objective'
  key: string
  t: number
  obj: Objective
  team: number
  /** Same objective merged (three voidgrubs in one go = 3). */
  count: number
}
export type GameEvent = KillEvent | ObjectiveEvent

export interface Fight {
  start: number
  end: number
  /** Kills per team id. */
  kills: Map<number, number>
}

export interface Story {
  events: GameEvent[]
  fights: Fight[]
  /** Participant id → player. */
  byId: Map<number, PlayerView>
}

const otherSide = (team: number) => (team === 100 ? 200 : 100)

export function storyOf(detail: MatchView, timeline: TimelineView): Story {
  const byId = new Map(detail.players.map((p) => [p.participantId, p]))
  const teamOf = (pid: number) => byId.get(pid)?.teamId ?? 0

  // Multi-kills: the same killer again within MULTI_GAP seconds.
  const kills = [...timeline.kills].sort((a, b) => a.t - b.t)
  const multi = new Map<number, number>()
  const streak = new Map<number, { n: number; at: number }>()
  kills.forEach((k, i) => {
    if (!k.killer) return
    const s = streak.get(k.killer)
    if (s && k.t - s.at <= MULTI_GAP) {
      s.n++
      s.at = k.t
      multi.set(i, Math.min(5, s.n))
    } else streak.set(k.killer, { n: 1, at: k.t })
  })

  // Fights: two or more kills chained FIGHT_GAP seconds apart.
  const fights: Fight[] = []
  const fightOf = new Map<number, number>()
  let group: number[] = []
  const close = () => {
    if (group.length >= 2) {
      const f: Fight = {
        start: kills[group[0]].t,
        end: kills[group[group.length - 1]].t,
        kills: new Map(),
      }
      for (const i of group) {
        const team = killTeam(kills[i])
        f.kills.set(team, (f.kills.get(team) ?? 0) + 1)
        fightOf.set(i, fights.length)
      }
      fights.push(f)
    }
    group = []
  }
  function killTeam(k: Kill) {
    return teamOf(k.killer) || otherSide(teamOf(k.victim))
  }
  kills.forEach((k, i) => {
    if (group.length && k.t - kills[group[group.length - 1]].t > FIGHT_GAP) close()
    group.push(i)
  })
  close()

  const events: GameEvent[] = kills.map((kill, i) => ({
    kind: 'kill',
    key: `k${i}`,
    t: kill.t,
    kill,
    team: killTeam(kill),
    first: i === 0,
    multi: multi.get(i) ?? 0,
    fight: fightOf.get(i) ?? -1,
  }))

  const objectives = [...timeline.objectives].sort((a, b) => a.t - b.t)
  let last: ObjectiveEvent | undefined
  objectives.forEach((obj, i) => {
    if (
      last &&
      last.obj.kind === obj.kind &&
      obj.kind !== 'tower' &&
      obj.kind !== 'inhibitor' &&
      last.team === obj.team &&
      obj.t - last.t <= MERGE_GAP
    ) {
      last.count++
      return
    }
    last = { kind: 'objective', key: `o${i}`, t: obj.t, obj, team: obj.team, count: 1 }
    events.push(last)
  })

  events.sort((a, b) => a.t - b.t || (a.kind === b.kind ? 0 : a.kind === 'kill' ? -1 : 1))
  return { events, fights, byId }
}

/** Whether a player took part in an event: killed, died, assisted, or took the objective. */
export function involves(e: GameEvent, pid: number): boolean {
  if (e.kind === 'objective') return e.obj.killer === pid
  return e.kill.killer === pid || e.kill.victim === pid || e.kill.assists.includes(pid)
}

/** Objectives worth showing as context in a single player's story: the map-changing ones. */
export const isEpic = (e: GameEvent) => e.kind === 'objective' && e.obj.kind !== 'tower'

/** Kill score (per team id) after everything up to and including second `t`. */
export function scoreAt(story: Story, t: number): Map<number, number> {
  const out = new Map<number, number>()
  for (const e of story.events) {
    if (e.t > t) break
    if (e.kind === 'kill') out.set(e.team, (out.get(e.team) ?? 0) + 1)
  }
  return out
}

/**
 * A per-frame series read at second `t`, linearly between the two frames around it (frames are
 * one minute apart, so a fight at 12:40 reads two thirds of the way to the 13:00 frame).
 */
export function valueAt(times: number[], values: number[], t: number): number {
  if (!values.length) return 0
  if (t <= times[0]) return values[0]
  for (let i = 1; i < times.length && i < values.length; i++) {
    if (t <= times[i]) {
      const span = times[i] - times[i - 1] || 1
      return values[i - 1] + ((values[i] - values[i - 1]) * (t - times[i - 1])) / span
    }
  }
  return values[Math.min(times.length, values.length) - 1]
}

/** Gold lead of `team` (blue minus red as the client gives it, flipped for red). */
export const leadFor = (timeline: TimelineView, team: number) =>
  team === 200 ? timeline.goldDiff.map((v) => -v) : timeline.goldDiff
