import type {
  ClickhouseEventRow,
  ClickhouseMatchRow,
  ClickhouseParticipantRow,
  ClickhouseTimelineRow,
} from '#types/clickhouse'
import { UNKNOWN_QUEUE } from '@invadelol/ui/logic'

/** An absent or invalid queue is unknown; only an explicit zero means Custom. */
function matchQueueId(value: unknown): number {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) {
    return UNKNOWN_QUEUE
  }
  const id = Number(value)
  return Number.isInteger(id) && id >= 0 && id < UNKNOWN_QUEUE ? id : UNKNOWN_QUEUE
}

export function toInt(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.trunc(n)
}

/**
 * `toInt` held inside an unsigned column's range. Riot's frames now and then
 * report a value just below zero (current gold around a purchase), and
 * ClickHouse rejects the whole insert over a single such row.
 */
export function toUInt(value: unknown, max = 0xffffffff): number {
  return Math.min(max, Math.max(0, toInt(value, 0)))
}

export function toBool01(value: unknown): 0 | 1 {
  if (value === true) return 1
  if (value === false) return 0
  const n = toInt(value, 0)
  return n ? 1 : 0
}

export function patchFromGameVersion(version: unknown): string {
  if (typeof version !== 'string' || !version.trim()) return ''
  const [major, minor] = version.split('.', 3)
  if (!major || !minor) return version
  return `${major}.${minor}`
}

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return fallback
  return String(value)
}

export function escapeClickhouseString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export function platformFromMatchId(matchId: string): string {
  const idx = matchId.indexOf('_')
  return idx === -1 ? matchId : matchId.slice(0, idx)
}

export function buildMatchRow(
  matchId: string,
  platform: string,
  gameStartMs: number,
  info: any
): ClickhouseMatchRow {
  const teams: any[] = Array.isArray(info.teams) ? info.teams : []
  const team100 = teams.find((t) => toInt(t.teamId) === 100) ?? {}
  const team200 = teams.find((t) => toInt(t.teamId) === 200) ?? {}

  const objectives100 = team100.objectives ?? {}
  const objectives200 = team200.objectives ?? {}

  const bans100: number[] = Array.isArray(team100.bans)
    ? team100.bans.map((b: any) => toInt(b.championId, 0)).filter((n: number) => n > 0)
    : []
  const bans200: number[] = Array.isArray(team200.bans)
    ? team200.bans.map((b: any) => toInt(b.championId, 0)).filter((n: number) => n > 0)
    : []

  return {
    match_id: matchId,
    platform,
    queue_id: matchQueueId(info.queueId),
    patch: patchFromGameVersion(info.gameVersion),
    game_start_ms: gameStartMs,
    duration_sec: toInt(info.gameDuration ?? 0, 0),
    map_id: toInt(info.mapId ?? 0, 0),

    t1_win: toBool01(team100.win),
    t2_win: toBool01(team200.win),

    t1_towers: toInt(objectives100.tower?.kills ?? 0, 0),
    t2_towers: toInt(objectives200.tower?.kills ?? 0, 0),
    t1_inhibs: toInt(objectives100.inhibitor?.kills ?? 0, 0),
    t2_inhibs: toInt(objectives200.inhibitor?.kills ?? 0, 0),
    t1_dragons: toInt(objectives100.dragon?.kills ?? 0, 0),
    t2_dragons: toInt(objectives200.dragon?.kills ?? 0, 0),
    t1_barons: toInt(objectives100.baron?.kills ?? 0, 0),
    t2_barons: toInt(objectives200.baron?.kills ?? 0, 0),
    t1_heralds: toInt(objectives100.riftHerald?.kills ?? 0, 0),
    t2_heralds: toInt(objectives200.riftHerald?.kills ?? 0, 0),

    t1_bans: bans100,
    t2_bans: bans200,
  }
}

/**
 * A player's rune page as match-v5 describes it: both trees (the first two styles when Riot leaves
 * out their descriptions), the four primary runes, the two secondary ones and the three shards.
 */
function perkColumns(p: any) {
  const styles: any[] = Array.isArray(p?.perks?.styles) ? p.perks.styles : []
  const primary = styles.find((s) => s?.description === 'primaryStyle') ?? styles[0] ?? {}
  const sub = styles.find((s) => s?.description === 'subStyle') ?? styles[1] ?? {}
  const primarySelections: any[] = Array.isArray(primary?.selections) ? primary.selections : []
  const subSelections: any[] = Array.isArray(sub?.selections) ? sub.selections : []
  const statPerks = p?.perks?.statPerks ?? {}

  return {
    primary_style: toInt(primary?.style ?? 0, 0),
    keystone: toInt(primarySelections?.[0]?.perk ?? 0, 0),
    secondary_style: toInt(sub?.style ?? 0, 0),
    rune1: toInt(primarySelections?.[0]?.perk ?? 0, 0),
    rune2: toInt(primarySelections?.[1]?.perk ?? 0, 0),
    rune3: toInt(primarySelections?.[2]?.perk ?? 0, 0),
    rune4: toInt(primarySelections?.[3]?.perk ?? 0, 0),
    rune5: toInt(subSelections?.[0]?.perk ?? 0, 0),
    rune6: toInt(subSelections?.[1]?.perk ?? 0, 0),
    stat_offense: toInt(statPerks.offense ?? 0, 0),
    stat_flex: toInt(statPerks.flex ?? 0, 0),
    stat_defense: toInt(statPerks.defense ?? 0, 0),
  }
}

/** A `SKILL_LEVEL_UP` event's player and skill slot (1 Q, 2 W, 3 E, 4 R), or null. */
function skillUp(event: any): [participantId: number, slot: number] | null {
  if (asString(event?.type) !== 'SKILL_LEVEL_UP') return null
  const participantId = toInt(event?.participantId ?? 0, 0)
  const skillSlot = toInt(event?.skillSlot ?? 0, 0)
  return participantId && skillSlot ? [participantId, skillSlot] : null
}

/**
 * Every player's skill points in the order they were spent, by participant id: the whole game's
 * order, stored once per player (`participants.skill_order`). A timeline frame's order is its
 * first `skill_points` entries.
 */
export function skillOrders(timeline: any): Map<number, number[]> {
  const frames: any[] = Array.isArray(timeline?.info?.frames) ? timeline.info.frames : []
  const orders = new Map<number, number[]>()
  for (const frame of frames) {
    const events: any[] = Array.isArray(frame?.events) ? frame.events : []
    for (const event of events) {
      const up = skillUp(event)
      if (!up) continue
      const order = orders.get(up[0]) ?? []
      order.push(up[1])
      orders.set(up[0], order)
    }
  }
  return orders
}

/**
 * `orders` (`skillOrders`) comes from the game's timeline when there is one by the time the game
 * is stored; without it the players' skill orders stay empty.
 */
export function buildParticipantRows(
  matchId: string,
  platform: string,
  gameStartMs: number,
  info: any,
  orders?: Map<number, number[]>
): ClickhouseParticipantRow[] {
  const participants: any[] = Array.isArray(info.participants) ? info.participants : []
  const queueId = matchQueueId(info.queueId)

  return participants
    .map((p) => {
      const participantId = toUInt(p.participantId, 0xff)

      return {
        match_id: matchId,
        platform,
        game_start_ms: gameStartMs,
        queue_id: queueId,

        participant_id: participantId,
        puuid: asString(p.puuid),
        riot_id_game_name: asString(p.riotIdGameName),
        riot_id_tag_line: asString(p.riotIdTagline),
        profile_icon_id: toInt(p.profileIcon ?? 0, 0),
        summoner_level: toInt(p.summonerLevel ?? 0, 0),

        team_id: toInt(p.teamId ?? 0, 0),
        win: toBool01(p.win),

        champion_id: toInt(p.championId ?? 0, 0),
        team_position: asString(p.teamPosition ?? p.individualPosition),
        lane: asString(p.lane),

        kills: toInt(p.kills ?? 0, 0),
        deaths: toInt(p.deaths ?? 0, 0),
        assists: toInt(p.assists ?? 0, 0),
        champ_level: toInt(p.champLevel ?? 0, 0),

        total_cs: toInt(p.totalMinionsKilled ?? 0, 0) + toInt(p.neutralMinionsKilled ?? 0, 0),
        gold_earned: toInt(p.goldEarned ?? 0, 0),
        dmg_to_champ: toInt(p.totalDamageDealtToChampions ?? 0, 0),
        dmg_taken: toInt(p.totalDamageTaken ?? 0, 0),
        vision_score: toInt(p.visionScore ?? 0, 0),
        wards_placed: toInt(p.wardsPlaced ?? 0, 0),
        wards_killed: toInt(p.wardsKilled ?? 0, 0),

        item0: toInt(p.item0 ?? 0, 0),
        item1: toInt(p.item1 ?? 0, 0),
        item2: toInt(p.item2 ?? 0, 0),
        item3: toInt(p.item3 ?? 0, 0),
        item4: toInt(p.item4 ?? 0, 0),
        item5: toInt(p.item5 ?? 0, 0),
        item6: toInt(p.item6 ?? 0, 0),
        role_item: toUInt((p as any).roleBoundItem, 0xffff),

        spell1: toInt(p.summoner1Id ?? 0, 0),
        spell2: toInt(p.summoner2Id ?? 0, 0),

        ...perkColumns(p),
        skill_order: (participantId && orders?.get(participantId)) || [],

        dmg_to_turrets: toInt(p.damageDealtToTurrets ?? 0, 0),
        dmg_to_objectives: toInt(p.damageDealtToObjectives ?? 0, 0),
        physical_dmg_dealt: toInt(p.physicalDamageDealt ?? 0, 0),
        magic_dmg_dealt: toInt(p.magicDamageDealt ?? 0, 0),
        true_dmg_dealt: toInt(p.trueDamageDealt ?? 0, 0),
        physical_dmg_to_champ: toInt(p.physicalDamageDealtToChampions ?? 0, 0),
        magic_dmg_to_champ: toInt(p.magicDamageDealtToChampions ?? 0, 0),
        true_dmg_to_champ: toInt(p.trueDamageDealtToChampions ?? 0, 0),
        neutral_minions_killed: toInt(p.neutralMinionsKilled ?? 0, 0),
        vision_wards_bought: toInt(p.visionWardsBoughtInGame ?? 0, 0),

        all_in_pings: toInt(p.allInPings ?? 0, 0),
        assist_pings: toInt(p.assistPings ?? 0, 0),
        command_pings: toInt(p.commandPings ?? 0, 0),
        danger_pings: toInt(p.dangerPings ?? 0, 0),
        enemy_missing_pings: toInt(p.enemyMissingPings ?? 0, 0),
        enemy_vision_pings: toInt(p.enemyVisionPings ?? 0, 0),
        get_back_pings: toInt(p.getBackPings ?? 0, 0),
        need_vision_pings: toInt(p.needVisionPings ?? 0, 0),
        on_my_way_pings: toInt(p.onMyWayPings ?? 0, 0),
        push_pings: toInt(p.pushPings ?? 0, 0),
        vision_cleared_pings: toInt(p.visionClearedPings ?? 0, 0),
        bait_pings: toInt(p.baitPings ?? 0, 0),
        hold_pings: toInt(p.holdPings ?? 0, 0),
      }
    })
    .filter((row) => row.puuid)
}

/**
 * One row per player per timeline frame: the frame's own numbers only. What a player keeps for the
 * whole game (spells, runes, the skill order) lives on their `participants` row, joined by
 * `(match_id, participant_id)`; `skill_points` counts the points spent by the frame (its skill
 * order is that prefix of the player's).
 */
export function buildTimelineRows(
  matchId: string,
  platform: string,
  gameStartMs: number,
  info: any,
  timeline: any
): ClickhouseTimelineRow[] {
  const participants: any[] = Array.isArray(info?.participants) ? info.participants : []
  const teams = new Map<number, number>()

  for (const p of participants) {
    const participantId = toInt(p.participantId ?? 0, 0)
    // Players without a puuid are not stored, here as in `participants`.
    if (!participantId || !asString(p.puuid)) continue
    teams.set(participantId, toInt(p.teamId ?? 0, 0))
  }

  const frames: any[] = Array.isArray(timeline?.info?.frames) ? timeline.info.frames : []

  const skillPoints = new Map<number, number>()
  const kills = new Map<number, number>()
  const deaths = new Map<number, number>()
  const assists = new Map<number, number>()

  const rows: ClickhouseTimelineRow[] = []

  for (const frame of frames) {
    const events: any[] = Array.isArray(frame?.events) ? frame.events : []

    for (const event of events) {
      const eventType = asString(event?.type)

      const up = skillUp(event)
      if (up) skillPoints.set(up[0], (skillPoints.get(up[0]) ?? 0) + 1)

      if (eventType === 'CHAMPION_KILL') {
        const killerId = toInt(event?.killerId ?? 0, 0)
        const victimId = toInt(event?.victimId ?? 0, 0)
        const assistingIds: number[] = Array.isArray(event?.assistingParticipantIds)
          ? event.assistingParticipantIds.map((id: any) => toInt(id ?? 0, 0))
          : []

        if (killerId) {
          kills.set(killerId, (kills.get(killerId) ?? 0) + 1)
        }
        if (victimId) {
          deaths.set(victimId, (deaths.get(victimId) ?? 0) + 1)
        }
        for (const assistId of assistingIds) {
          if (!assistId) continue
          assists.set(assistId, (assists.get(assistId) ?? 0) + 1)
        }
      }
    }

    const participantFrames = frame?.participantFrames ?? {}
    for (const [key, participantFrame] of Object.entries(participantFrames)) {
      const participantId = toInt((participantFrame as any)?.participantId ?? key, 0)
      if (!participantId || !teams.has(participantId)) continue

      const position = (participantFrame as any)?.position ?? {}

      rows.push({
        match_id: matchId,
        platform,
        game_start_ms: gameStartMs,
        frame_ms: toUInt(frame?.timestamp),

        participant_id: participantId,
        team_id: teams.get(participantId) ?? 0,

        skill_points: toUInt(skillPoints.get(participantId), 0xff),

        level: toUInt((participantFrame as any)?.level, 0xff),
        xp: toUInt((participantFrame as any)?.xp),
        gold_current: toUInt((participantFrame as any)?.currentGold),
        gold_total: toUInt((participantFrame as any)?.totalGold),
        gold_per_sec: Number((participantFrame as any)?.goldPerSecond ?? 0) || 0,

        cs: toUInt((participantFrame as any)?.minionsKilled, 0xffff),
        jungle_cs: toUInt((participantFrame as any)?.jungleMinionsKilled, 0xffff),

        kills: toInt(kills.get(participantId) ?? 0, 0),
        deaths: toInt(deaths.get(participantId) ?? 0, 0),
        assists: toInt(assists.get(participantId) ?? 0, 0),

        pos_x: toUInt(position?.x, 0xffff),
        pos_y: toUInt(position?.y, 0xffff),

        time_cc: toUInt((participantFrame as any)?.timeEnemySpentControlled),
      })
    }
  }

  return rows
}

const MONSTERS: Record<string, string> = {
  DRAGON: 'dragon',
  BARON_NASHOR: 'baron',
  RIFTHERALD: 'herald',
  HORDE: 'grubs',
}

/**
 * Kill, objective and shop events of a match-v5 timeline, as `match_events` rows. Shop rows
 * (`buy` / `sell`) carry the player in `killer` and the item id in `sub`; undos are taken back
 * here, and `victim` numbers the same item bought twice in one millisecond so the table's key
 * keeps both. `teamOf` maps a
 * participant id to its team (100 / 200): from the match's participants when a match is
 * ingested, from the stored participants when its events are backfilled.
 */
export function buildEventRows(
  matchId: string,
  platform: string,
  gameStartMs: number,
  timeline: any,
  teamOf: Map<number, number>
): ClickhouseEventRow[] {
  const frames: any[] = Array.isArray(timeline?.info?.frames) ? timeline.info.frames : []
  const rows: ClickhouseEventRow[] = []
  const base = { match_id: matchId, platform, game_start_ms: gameStartMs }
  const position = (event: any) => ({
    pos_x: Math.max(0, Math.min(65535, toInt(event?.position?.x ?? 0, 0))),
    pos_y: Math.max(0, Math.min(65535, toInt(event?.position?.y ?? 0, 0))),
  })

  const shop: { t: number; player: number; item: number; sold: boolean }[] = []
  /** Takes back the player's last `sold` action on `item`. */
  const undo = (player: number, item: number, sold: boolean) => {
    for (let k = shop.length - 1; k >= 0; k--) {
      const a = shop[k]
      if (a.player === player && a.item === item && a.sold === sold) {
        shop.splice(k, 1)
        return
      }
    }
  }

  for (const frame of frames) {
    const events: any[] = Array.isArray(frame?.events) ? frame.events : []
    for (const event of events) {
      const type = asString(event?.type)
      const t = Math.max(0, toInt(event?.timestamp ?? 0, 0))
      const killer = Math.max(0, toInt(event?.killerId ?? 0, 0))

      if (type === 'ITEM_PURCHASED' || type === 'ITEM_SOLD' || type === 'ITEM_UNDO') {
        const player = toInt(event?.participantId ?? 0, 0)
        if (player < 1 || player > 255) continue
        if (type === 'ITEM_UNDO') {
          // `beforeId`: the item a purchase gave; `afterId`: the item a sale took (it comes back).
          const bought = toInt(event?.beforeId ?? 0, 0)
          const sold = toInt(event?.afterId ?? 0, 0)
          if (bought > 0) undo(player, bought, false)
          if (sold > 0) undo(player, sold, true)
          continue
        }
        const item = toInt(event?.itemId ?? 0, 0)
        if (item > 0) shop.push({ t, player, item, sold: type === 'ITEM_SOLD' })
      } else if (type === 'CHAMPION_KILL') {
        const victim = Math.max(0, toInt(event?.victimId ?? 0, 0))
        // Executed (tower, minions): the kill counts for the victim's enemies.
        const victimTeam = teamOf.get(victim) ?? 0
        const team = teamOf.get(killer) ?? (victimTeam === 100 ? 200 : victimTeam === 200 ? 100 : 0)
        rows.push({
          ...base,
          t_ms: t,
          kind: 'kill',
          sub: '',
          lane: '',
          team_id: team,
          killer,
          victim,
          assists: Array.isArray(event?.assistingParticipantIds)
            ? event.assistingParticipantIds
                .map((id: any) => toInt(id, 0))
                .filter((id: number) => id > 0)
            : [],
          ...position(event),
        })
      } else if (type === 'ELITE_MONSTER_KILL') {
        // `killerTeamId` is set even when a minion or a pet lands the last hit.
        const team = toInt(event?.killerTeamId ?? 0, 0) || teamOf.get(killer) || 0
        if (team !== 100 && team !== 200) continue
        const monster = asString(event?.monsterType)
        const kind = MONSTERS[monster] ?? 'monster'
        rows.push({
          ...base,
          t_ms: t,
          kind,
          sub:
            kind === 'dragon' ? asString(event?.monsterSubType) : kind === 'monster' ? monster : '',
          lane: '',
          team_id: team,
          killer,
          victim: 0,
          assists: [],
          ...position(event),
        })
      } else if (type === 'BUILDING_KILL') {
        // `teamId` is the side that lost the building.
        const lost = toInt(event?.teamId ?? 0, 0)
        if (lost !== 100 && lost !== 200) continue
        const inhibitor = asString(event?.buildingType) === 'INHIBITOR_BUILDING'
        rows.push({
          ...base,
          t_ms: t,
          kind: inhibitor ? 'inhibitor' : 'tower',
          sub: inhibitor ? '' : asString(event?.towerType),
          lane: asString(event?.laneType),
          team_id: lost === 100 ? 200 : 100,
          killer,
          victim: 0,
          assists: [],
          ...position(event),
        })
      }
    }
  }

  const seen = new Map<string, number>()
  for (const a of shop) {
    const kind = a.sold ? 'sell' : 'buy'
    const key = `${a.t}:${kind}:${a.player}`
    const n = seen.get(key) ?? 0
    seen.set(key, n + 1)
    if (n > 255) continue
    rows.push({
      ...base,
      t_ms: a.t,
      kind,
      sub: String(a.item),
      lane: '',
      team_id: teamOf.get(a.player) ?? 0,
      killer: a.player,
      victim: n,
      assists: [],
      pos_x: 0,
      pos_y: 0,
    })
  }
  return rows
}
