import type {
  ClickhouseMatchRow,
  ClickhouseParticipantRow,
  ClickhouseTimelineRow,
} from '#types/clickhouse'

export function toInt(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.trunc(n)
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
    queue_id: toInt(info.queueId ?? 0, 0),
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

export function buildParticipantRows(
  matchId: string,
  platform: string,
  gameStartMs: number,
  info: any
): ClickhouseParticipantRow[] {
  const participants: any[] = Array.isArray(info.participants) ? info.participants : []
  const queueId = toInt(info.queueId ?? 0, 0)

  return participants
    .map((p) => {
      const styles: any[] = Array.isArray(p?.perks?.styles) ? p.perks.styles : []
      const primary = styles.find((s) => s?.description === 'primaryStyle') ?? {}
      const sub = styles.find((s) => s?.description === 'subStyle') ?? {}
      const selections: any[] = Array.isArray(primary?.selections) ? primary.selections : []

      return {
        match_id: matchId,
        platform,
        game_start_ms: gameStartMs,
        queue_id: queueId,

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

        spell1: toInt(p.summoner1Id ?? 0, 0),
        spell2: toInt(p.summoner2Id ?? 0, 0),

        primary_style: toInt(primary.style ?? 0, 0),
        keystone: toInt(selections?.[0]?.perk ?? 0, 0),
        secondary_style: toInt(sub.style ?? 0, 0),

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

export function buildTimelineRows(
  matchId: string,
  platform: string,
  gameStartMs: number,
  info: any,
  timeline: any
): ClickhouseTimelineRow[] {
  const participants: any[] = Array.isArray(info?.participants) ? info.participants : []
  const participantMap = new Map<number, any>()

  for (const p of participants) {
    const participantId = toInt(p.participantId ?? 0, 0)
    if (!participantId) continue

    const styles: any[] = Array.isArray(p?.perks?.styles) ? p.perks.styles : []
    const primary =
      styles.find((s) => s?.description === 'primaryStyle') ?? styles[0] ?? {}
    const sub = styles.find((s) => s?.description === 'subStyle') ?? styles[1] ?? {}
    const primarySelections: any[] = Array.isArray(primary?.selections)
      ? primary.selections
      : []
    const subSelections: any[] = Array.isArray(sub?.selections) ? sub.selections : []
    const statPerks = p?.perks?.statPerks ?? {}

    participantMap.set(participantId, {
      puuid: asString(p.puuid),
      teamId: toInt(p.teamId ?? 0, 0),
      spell1: toInt(p.summoner1Id ?? 0, 0),
      spell2: toInt(p.summoner2Id ?? 0, 0),
      primaryStyle: toInt(primary?.style ?? 0, 0),
      secondaryStyle: toInt(sub?.style ?? 0, 0),
      keystone: toInt(primarySelections?.[0]?.perk ?? 0, 0),
      rune1: toInt(primarySelections?.[0]?.perk ?? 0, 0),
      rune2: toInt(primarySelections?.[1]?.perk ?? 0, 0),
      rune3: toInt(primarySelections?.[2]?.perk ?? 0, 0),
      rune4: toInt(primarySelections?.[3]?.perk ?? 0, 0),
      rune5: toInt(subSelections?.[0]?.perk ?? 0, 0),
      rune6: toInt(subSelections?.[1]?.perk ?? 0, 0),
      statOffense: toInt(statPerks.offense ?? 0, 0),
      statFlex: toInt(statPerks.flex ?? 0, 0),
      statDefense: toInt(statPerks.defense ?? 0, 0),
    })
  }

  const frames: any[] = Array.isArray(timeline?.info?.frames) ? timeline.info.frames : []

  const skillOrders = new Map<number, number[]>()
  const kills = new Map<number, number>()
  const deaths = new Map<number, number>()
  const assists = new Map<number, number>()

  const rows: ClickhouseTimelineRow[] = []

  for (const frame of frames) {
    const events: any[] = Array.isArray(frame?.events) ? frame.events : []

    for (const event of events) {
      const eventType = asString(event?.type)

      if (eventType === 'SKILL_LEVEL_UP') {
        const participantId = toInt(event?.participantId ?? 0, 0)
        const skillSlot = toInt(event?.skillSlot ?? 0, 0)
        if (participantId && skillSlot) {
          const order = skillOrders.get(participantId) ?? []
          order.push(skillSlot)
          skillOrders.set(participantId, order)
        }
      }

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
      const participantId = toInt(
        (participantFrame as any)?.participantId ?? key,
        0
      )
      if (!participantId) continue

      const base = participantMap.get(participantId) ?? {}
      const position = (participantFrame as any)?.position ?? {}

      rows.push({
        match_id: matchId,
        platform,
        game_start_ms: gameStartMs,
        frame_ms: toInt(frame?.timestamp ?? 0, 0),

        participant_id: participantId,
        puuid: asString(base.puuid),
        team_id: toInt(base.teamId ?? 0, 0),

        spell1: toInt(base.spell1 ?? 0, 0),
        spell2: toInt(base.spell2 ?? 0, 0),

        primary_style: toInt(base.primaryStyle ?? 0, 0),
        secondary_style: toInt(base.secondaryStyle ?? 0, 0),
        keystone: toInt(base.keystone ?? 0, 0),
        rune1: toInt(base.rune1 ?? 0, 0),
        rune2: toInt(base.rune2 ?? 0, 0),
        rune3: toInt(base.rune3 ?? 0, 0),
        rune4: toInt(base.rune4 ?? 0, 0),
        rune5: toInt(base.rune5 ?? 0, 0),
        rune6: toInt(base.rune6 ?? 0, 0),

        stat_offense: toInt(base.statOffense ?? 0, 0),
        stat_flex: toInt(base.statFlex ?? 0, 0),
        stat_defense: toInt(base.statDefense ?? 0, 0),

        skill_order: skillOrders.get(participantId) ?? [],

        level: toInt((participantFrame as any)?.level ?? 0, 0),
        xp: toInt((participantFrame as any)?.xp ?? 0, 0),
        gold_current: toInt((participantFrame as any)?.currentGold ?? 0, 0),
        gold_total: toInt((participantFrame as any)?.totalGold ?? 0, 0),
        gold_per_sec: Number((participantFrame as any)?.goldPerSecond ?? 0) || 0,

        cs: toInt((participantFrame as any)?.minionsKilled ?? 0, 0),
        jungle_cs: toInt((participantFrame as any)?.jungleMinionsKilled ?? 0, 0),

        kills: toInt(kills.get(participantId) ?? 0, 0),
        deaths: toInt(deaths.get(participantId) ?? 0, 0),
        assists: toInt(assists.get(participantId) ?? 0, 0),

        pos_x: toInt(position?.x ?? 0, 0),
        pos_y: toInt(position?.y ?? 0, 0),

        time_cc: toInt((participantFrame as any)?.timeEnemySpentControlled ?? 0, 0),
      })
    }
  }

  return rows.filter((row) => row.puuid)
}
