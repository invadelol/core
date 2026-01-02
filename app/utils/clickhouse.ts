import type { ClickhouseMatchRow, ClickhouseParticipantRow } from '#types/clickhouse'

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
      }
    })
    .filter((row) => row.puuid)
}
