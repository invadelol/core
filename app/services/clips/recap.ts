import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { RiotAPITypes } from '@fightmegg/riot-api'
import riotApiService from '#services/riot/api'
import { inBackground } from '#services/riot/client'
import riotAssets from '#services/riot/assets'
import matchRepository from '#services/analytics/match_repository'
import { EVENT_MARGIN_MS } from '#services/clips/events'
import type { DamageLine, KillRecap } from '../../../inertia/lib/clip_types.js'

/**
 * Each kill's damage recap in a clip, from Riot's match timeline: for every champion kill in the
 * clip's window that its player was part of, the damage the killer dealt to the victim and the
 * victim dealt back, by ability, attacks and the rest. Read once per posted clip, after it is
 * ready, behind every visitor's request (`inBackground`, the Riot budget's lowest priority), and
 * kept with the clip: a page never asks Riot.
 */

const SLOTS = ['q', 'w', 'e', 'r'] as const

/** A timeline event, with the shutdown gold Riot sends beside the bounty (missing upstream). */
type TimelineEvent = RiotAPITypes.MatchV5.EventDTO & { shutdownBounty?: number }
/** One entry of a kill's `victimDamageDealt` / `victimDamageReceived` (typed as strings upstream). */
type DamageEntry = Partial<RiotAPITypes.MatchV5.VictimDamageDTO>

type Timeline = RiotAPITypes.MatchV5.MatchTimelineDTO
/** A champion's ability names by key (`q`, `w`, `e`, `r`). */
type Abilities = Partial<Record<string, string>>

const damageOf = (entries: TimelineEvent['victimDamageDealt']) =>
  (entries ?? []) as unknown as DamageEntry[]

const sourceOf = (entry: DamageEntry) => {
  if (entry.basic) return 'attack'
  const slot = Number(entry.spellSlot)
  return entry.type === 'OTHER' && slot >= 0 && slot < SLOTS.length ? SLOTS[slot] : 'other'
}

/** Damage entries grouped by source, biggest first, named with the champion's abilities. */
function lines(entries: DamageEntry[], abilities: Abilities): DamageLine[] {
  const by = new Map<string, DamageLine>()
  for (const entry of entries) {
    const source = sourceOf(entry)
    const damage =
      (Number(entry.physicalDamage) || 0) +
      (Number(entry.magicDamage) || 0) +
      (Number(entry.trueDamage) || 0)
    // A hit that did nothing (a shield took it all) is not one.
    if (damage <= 0) continue
    const line = by.get(source) ?? {
      source,
      name:
        source === 'attack'
          ? 'Attacks'
          : source === 'other'
            ? 'Other'
            : (abilities[source] ?? source.toUpperCase()),
      hits: 0,
      damage: 0,
    }
    line.hits++
    line.damage += damage
    by.set(source, line)
  }
  return [...by.values()].sort((a, b) => b.damage - a.damage)
}

export interface RecapClip {
  id: string
  matchId: string
  platform: string
  puuid: string
  startMs: number
  durationMs: number
}

/** The seats of a timeline and the kills of the clip's window its player took part in. */
function killsOf(timeline: Timeline, clip: RecapClip) {
  const seats = new Map<number, string>(
    (timeline.info?.participants ?? []).map((p) => [p.participantId, p.puuid] as const)
  )
  const player = [...seats].find(([, puuid]) => puuid === clip.puuid)?.[0]
  const from = clip.startMs - EVENT_MARGIN_MS
  const to = clip.startMs + clip.durationMs + EVENT_MARGIN_MS
  const kills =
    player === undefined
      ? []
      : (timeline.info?.frames ?? [])
          .flatMap((frame): TimelineEvent[] => frame.events ?? [])
          .filter((e) => e.type === 'CHAMPION_KILL' && e.timestamp >= from && e.timestamp <= to)
          .filter(
            (e) =>
              e.killerId === player ||
              e.victimId === player ||
              (e.assistingParticipantIds ?? []).includes(player)
          )
  return { seats, kills }
}

/**
 * The recap of a clip from its game's timeline: each kill of the clip's window its player took
 * part in, with the damage both ways. `champions`: each seat's champion; `abilities`: each
 * champion's ability names by key.
 */
export function recapFrom(
  timeline: Timeline,
  clip: RecapClip,
  champions: Map<number, number>,
  abilities: Map<number, Abilities>
): KillRecap[] {
  return killsOf(timeline, clip).kills.flatMap((kill) => {
    const killer = champions.get(kill.killerId ?? 0)
    const victim = champions.get(kill.victimId ?? 0)
    if (!killer || !victim) return []
    const received = damageOf(kill.victimDamageReceived)
    const dealt = damageOf(kill.victimDamageDealt)
    return [
      {
        t: kill.timestamp,
        killer,
        victim,
        bounty: (kill.bounty ?? 0) + (kill.shutdownBounty ?? 0),
        dealt: lines(
          received.filter((d) => d.participantId === kill.killerId),
          abilities.get(killer) ?? {}
        ),
        taken: lines(
          dealt.filter((d) => d.participantId === kill.killerId),
          abilities.get(victim) ?? {}
        ),
      },
    ]
  })
}

/** Reads the clip's game's timeline from Riot (lowest priority), then its recap. */
export async function readRecap(clip: RecapClip): Promise<KillRecap[]> {
  const cluster = riotApiService.platformToRegion(clip.platform) as never
  const timeline = await inBackground(() =>
    riotApiService.client.matchV5.getMatchTimelineById({ matchId: clip.matchId, cluster })
  )
  const { seats, kills } = killsOf(timeline, clip)
  if (!kills.length) return []
  const champions = await championsOf(clip.matchId, seats)
  const abilities = new Map<number, Abilities>()
  for (const id of new Set(champions.values())) {
    const found = await riotAssets.championText(String(id)).catch(() => null)
    abilities.set(id, found?.abilities ?? {})
  }
  return recapFrom(timeline, clip, champions, abilities)
}

/** Each seat's champion, from the stored game. */
async function championsOf(matchId: string, seats: Map<number, string>) {
  const match = await matchRepository.getSummaryById(matchId)
  const byPuuid = new Map<string, number>(
    (match?.participants ?? []).map(
      (p: { puuid: string; championId: number }) => [p.puuid, Number(p.championId)] as const
    )
  )
  const out = new Map<number, number>()
  for (const [seat, puuid] of seats) {
    const champion = byPuuid.get(puuid)
    if (champion) out.set(seat, champion)
  }
  return out
}

/** Reads a clip's recap and keeps it; a failure leaves the clip without one, logged. */
export async function fillRecap(clip: RecapClip) {
  try {
    const recap = await readRecap(clip)
    await db
      .from('invade_clip')
      .where('id', clip.id)
      .update({ recap: JSON.stringify(recap) })
  } catch (error) {
    logger.warn({ err: error, clip: clip.id }, 'clip recap not read')
  }
}
