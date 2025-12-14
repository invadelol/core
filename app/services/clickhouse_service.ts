import clickhouse from 'adonisjs-clickhouse/services/main'
import { toInt, toBool01, patchFromGameVersion } from '#services/clickhouse_utils'
import type { ClickhouseMatchRow, ClickhouseParticipantRow } from '#types/clickhouse'

export type IngestedMatchMeta = {
  platform: string
  gameStartMs: number
}

export class ClickhouseService {
  async ingestMatch(matchId: string, matchData: unknown): Promise<IngestedMatchMeta> {
    const info: any = (matchData as any)?.info ?? {}
    const platform =
      (typeof info.platformId === 'string' && info.platformId) || matchId.split('_', 1)[0] || ''

    const gameStartMs = toInt(info.gameStartTimestamp ?? info.gameCreation ?? 0, 0)
    const queueId = toInt(info.queueId ?? 0, 0)
    const mapId = toInt(info.mapId ?? 0, 0)
    const durationSec = toInt(info.gameDuration ?? 0, 0)
    const patch = patchFromGameVersion(info.gameVersion)

    const teams: any[] = Array.isArray(info.teams) ? info.teams : []
    const team100 = teams.find((t) => toInt(t?.teamId) === 100) ?? {}
    const team200 = teams.find((t) => toInt(t?.teamId) === 200) ?? {}

    const objectives100 = team100.objectives ?? {}
    const objectives200 = team200.objectives ?? {}

    const bans100: number[] = Array.isArray(team100.bans)
      ? team100.bans.map((b: any) => toInt(b?.championId, 0)).filter((n: number) => n > 0)
      : []
    const bans200: number[] = Array.isArray(team200.bans)
      ? team200.bans.map((b: any) => toInt(b?.championId, 0)).filter((n: number) => n > 0)
      : []

    const matchRow: ClickhouseMatchRow = {
      match_id: matchId,
      platform,
      queue_id: queueId,
      patch,
      game_start_ms: gameStartMs,
      duration_sec: durationSec,
      map_id: mapId,

      t1_win: toBool01(team100.win),
      t2_win: toBool01(team200.win),

      t1_towers: toInt(objectives100?.tower?.kills ?? 0, 0),
      t2_towers: toInt(objectives200?.tower?.kills ?? 0, 0),
      t1_inhibs: toInt(objectives100?.inhibitor?.kills ?? 0, 0),
      t2_inhibs: toInt(objectives200?.inhibitor?.kills ?? 0, 0),
      t1_dragons: toInt(objectives100?.dragon?.kills ?? 0, 0),
      t2_dragons: toInt(objectives200?.dragon?.kills ?? 0, 0),
      t1_barons: toInt(objectives100?.baron?.kills ?? 0, 0),
      t2_barons: toInt(objectives200?.baron?.kills ?? 0, 0),
      t1_heralds: toInt(objectives100?.riftHerald?.kills ?? 0, 0),
      t2_heralds: toInt(objectives200?.riftHerald?.kills ?? 0, 0),

      t1_bans: bans100,
      t2_bans: bans200,
    }

    const participants: any[] = Array.isArray(info.participants) ? info.participants : []
    const participantRows: ClickhouseParticipantRow[] = participants
      .map((p) => {
        const styles: any[] = Array.isArray(p?.perks?.styles) ? p.perks.styles : []
        const primary = styles.find((s) => s?.description === 'primaryStyle') ?? {}
        const sub = styles.find((s) => s?.description === 'subStyle') ?? {}
        const selections: any[] = Array.isArray(primary?.selections) ? primary.selections : []

        const totalCs =
          toInt(p?.totalMinionsKilled ?? 0, 0) + toInt(p?.neutralMinionsKilled ?? 0, 0)

        return {
          match_id: matchId,
          platform,
          game_start_ms: gameStartMs,

          puuid: String(p?.puuid ?? ''),
          team_id: toInt(p?.teamId ?? 0, 0),
          win: toBool01(p?.win),

          champion_id: toInt(p?.championId ?? 0, 0),
          team_position: String(p?.teamPosition ?? p?.individualPosition ?? ''),
          lane: String(p?.lane ?? ''),

          kills: toInt(p?.kills ?? 0, 0),
          deaths: toInt(p?.deaths ?? 0, 0),
          assists: toInt(p?.assists ?? 0, 0),
          champ_level: toInt(p?.champLevel ?? 0, 0),

          total_cs: totalCs,
          gold_earned: toInt(p?.goldEarned ?? 0, 0),
          dmg_to_champ: toInt(p?.totalDamageDealtToChampions ?? 0, 0),
          dmg_taken: toInt(p?.totalDamageTaken ?? 0, 0),
          vision_score: toInt(p?.visionScore ?? 0, 0),
          wards_placed: toInt(p?.wardsPlaced ?? 0, 0),
          wards_killed: toInt(p?.wardsKilled ?? 0, 0),

          item0: toInt(p?.item0 ?? 0, 0),
          item1: toInt(p?.item1 ?? 0, 0),
          item2: toInt(p?.item2 ?? 0, 0),
          item3: toInt(p?.item3 ?? 0, 0),
          item4: toInt(p?.item4 ?? 0, 0),
          item5: toInt(p?.item5 ?? 0, 0),
          item6: toInt(p?.item6 ?? 0, 0),

          spell1: toInt(p?.summoner1Id ?? 0, 0),
          spell2: toInt(p?.summoner2Id ?? 0, 0),

          primary_style: toInt(primary?.style ?? 0, 0),
          keystone: toInt(selections?.[0]?.perk ?? 0, 0),
          secondary_style: toInt(sub?.style ?? 0, 0),
        }
      })
      .filter((row) => row.puuid)

    await clickhouse.insert({
      table: 'matches',
      values: [matchRow],
      format: 'JSONEachRow',
    })

    if (participantRows.length) {
      await clickhouse.insert({
        table: 'participants',
        values: participantRows,
        format: 'JSONEachRow',
      })
    }

    return { platform, gameStartMs }
  }
}

export default new ClickhouseService()