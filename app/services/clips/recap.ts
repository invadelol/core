import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
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

interface DamageEntry {
  basic?: boolean
  magicDamage?: number
  physicalDamage?: number
  trueDamage?: number
  participantId?: number
  spellSlot?: number
  type?: string
}

const sourceOf = (entry: DamageEntry) => {
  if (entry.basic) return 'attack'
  const slot = Number(entry.spellSlot)
  return entry.type === 'OTHER' && slot >= 0 && slot < SLOTS.length ? SLOTS[slot] : 'other'
}

/** Damage entries grouped by source, biggest first, named with the champion's abilities. */
function lines(entries: DamageEntry[], abilities: Partial<Record<string, string>>): DamageLine[] {
  const by = new Map<string, DamageLine>()
  for (const entry of entries) {
    const source = sourceOf(entry)
    const damage =
      (Number(entry.physicalDamage) || 0) +
      (Number(entry.magicDamage) || 0) +
      (Number(entry.trueDamage) || 0)
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
  return [...by.values()].filter((l) => l.damage > 0).sort((a, b) => b.damage - a.damage)
}

export interface RecapClip {
  id: string
  matchId: string
  platform: string
  puuid: string
  startMs: number
  durationMs: number
}

/** The kills of the clip's window its player took part in, with their damage both ways. */
export async function readRecap(clip: RecapClip): Promise<KillRecap[]> {
  const cluster = riotApiService.platformToRegion(clip.platform) as never
  const timeline = await inBackground(() =>
    riotApiService.client.matchV5.getMatchTimelineById({ matchId: clip.matchId, cluster })
  )
  const seats = new Map<number, string>(
    (timeline.info?.participants ?? []).map((p) => [p.participantId, p.puuid] as const)
  )
  const player = [...seats].find(([, puuid]) => puuid === clip.puuid)?.[0]
  if (player === undefined) return []
  const from = clip.startMs - EVENT_MARGIN_MS
  const to = clip.startMs + clip.durationMs + EVENT_MARGIN_MS

  const kills = (timeline.info?.frames ?? [])
    .flatMap((frame) => frame.events ?? [])
    .filter((e: Record<string, any>) => e.type === 'CHAMPION_KILL')
    .filter((e: Record<string, any>) => e.timestamp >= from && e.timestamp <= to)
    .filter(
      (e: Record<string, any>) =>
        e.killerId === player ||
        e.victimId === player ||
        (e.assistingParticipantIds ?? []).includes(player)
    ) as Array<Record<string, any>>
  if (!kills.length) return []

  const champions = await championsOf(clip.matchId, seats)
  const text = new Map<number, Partial<Record<string, string>>>()
  for (const id of new Set(champions.values())) {
    const found = await riotAssets.championText(String(id)).catch(() => null)
    text.set(id, found?.abilities ?? {})
  }
  return kills.flatMap((kill) => {
    const killer = champions.get(kill.killerId)
    const victim = champions.get(kill.victimId)
    if (!killer || !victim) return []
    const received = (kill.victimDamageReceived ?? []) as DamageEntry[]
    const dealt = (kill.victimDamageDealt ?? []) as DamageEntry[]
    return [
      {
        t: Number(kill.timestamp),
        killer,
        victim,
        bounty: Number(kill.bounty) + Number(kill.shutdownBounty ?? 0) || 0,
        dealt: lines(
          received.filter((d) => d.participantId === kill.killerId),
          text.get(killer) ?? {}
        ),
        taken: lines(
          dealt.filter((d) => d.participantId === kill.killerId),
          text.get(victim) ?? {}
        ),
      },
    ]
  })
}

/** Each seat's champion, from the stored game. */
async function championsOf(matchId: string, seats: Map<number, string>) {
  const match = await matchRepository.getSummaryById(matchId)
  const byPuuid = new Map<string, number>(
    (match?.participants ?? []).map((p: any) => [String(p.puuid), Number(p.championId)] as const)
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
