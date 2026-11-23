import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { rows } from '#services/ranked_games_service'
import { RANKED_SOLO } from '#services/ranked_stats'
import { notRemake } from '#services/analytics/remakes'
import { ladderValue } from '../../../inertia/lib/lp_line.js'
import type { LeaguePlate } from '../../../inertia/lib/invade_profile.js'

const LINE_DAYS = 30
/** Results drawn on a plate that is not the main one. */
const FORM_GAMES = 8
/** Games read per account for its champions and form. */
const RECENT_GAMES = 20

interface ShownAccount {
  puuid: string
  gameName: string
  tagLine: string
  platform: string
  profileIconId: number | null
  main: boolean
}

/**
 * The League accounts a person shows on their profile, the main one first. An account they did
 * not choose to show never leaves this module, nor its rank.
 */
export async function shownAccounts(userId: string): Promise<ShownAccount[]> {
  const result = await db.rawQuery(
    `SELECT p.puuid, p.game_name, p.tag_line, p.platform, p.profile_icon_id,
            (o.puuid = u.main_puuid) AS main
     FROM invade_owned_account o
     JOIN invade_user u ON u.id = o.user_id
     JOIN riot_player p ON p.puuid = o.puuid
     WHERE o.user_id = ? AND o.removed_at IS NULL AND o.shown
     ORDER BY (o.puuid = u.main_puuid) DESC, o.verified_at`,
    [userId]
  )
  return result.rows.map((row: Record<string, any>) => ({
    puuid: row.puuid,
    gameName: row.game_name,
    tagLine: row.tag_line,
    platform: row.platform,
    profileIconId: row.profile_icon_id ?? null,
    main: row.main === true,
  }))
}

/** Each account's newest Solo/Duo rank, and the main one's snapshots of the last 30 days. */
async function ranks(puuids: string[], main: string | null) {
  const [latest, history] = await Promise.all([
    db.rawQuery(
      `SELECT DISTINCT ON (puuid) puuid, tier, division, league_points, wins, losses
       FROM riot_rank WHERE puuid = ANY(?) AND queue_type = 'RANKED_SOLO_5x5'
       ORDER BY puuid, fetched_at DESC`,
      [puuids]
    ),
    main
      ? db.rawQuery(
          `SELECT tier, division, league_points, fetched_at FROM riot_rank
           WHERE puuid = ? AND queue_type = 'RANKED_SOLO_5x5' AND fetched_at >= ?
           ORDER BY fetched_at`,
          [main, new Date(Date.now() - LINE_DAYS * 86_400_000)]
        )
      : null,
  ])
  const line: LeaguePlate['line'] = []
  for (const row of (history?.rows ?? []) as Record<string, any>[]) {
    const value = ladderValue({
      tier: row.tier,
      division: row.division,
      leaguePoints: row.league_points,
    })
    // One point per change: a snapshot that saw the same rank again adds nothing.
    if (value !== null && line.at(-1)?.value !== value) {
      line.push({ at: new Date(row.fetched_at).getTime(), value })
    }
  }
  return { latest: latest.rows as Record<string, any>[], line }
}

/** Each account's last ranked Solo/Duo games, newest first, from the stored games only. */
async function recentGames(puuids: string[]) {
  const games = new Map<string, { champion: number; win: boolean }[]>()
  try {
    const found = await rows(
      `SELECT puuid, champion_id, win FROM participants
       PREWHERE puuid IN {puuids:Array(String)}
       WHERE queue_id = ${RANKED_SOLO} AND ${notRemake(puuids)}
       ORDER BY game_start_ms DESC
       LIMIT ${RECENT_GAMES} BY puuid`,
      { puuids }
    )
    for (const [puuid, champion, win] of found as [string, number, number][]) {
      const list = games.get(puuid) ?? []
      list.push({ champion: Number(champion), win: Number(win) === 1 })
      games.set(puuid, list)
    }
  } catch (error) {
    logger.warn({ err: error }, 'profile plates: games unreadable')
  }
  return games
}

function mostPlayed(games: { champion: number }[], count: number) {
  const tally = new Map<number, number>()
  for (const g of games) tally.set(g.champion, (tally.get(g.champion) ?? 0) + 1)
  return [...tally]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([champion]) => champion)
}

/**
 * The plates under the bio: the main account lit with its 30-day LP line and three champions,
 * the others with their last results. Stored data only: no Riot call.
 */
export async function platesOf(accounts: ShownAccount[]): Promise<LeaguePlate[]> {
  if (!accounts.length) return []
  const puuids = accounts.map((a) => a.puuid)
  const main = accounts.find((a) => a.main)?.puuid ?? null
  const [{ latest, line }, games] = await Promise.all([ranks(puuids, main), recentGames(puuids)])
  return accounts.map((account) => {
    const rank = latest.find((r) => r.puuid === account.puuid)
    const played = games.get(account.puuid) ?? []
    const isMain = account.puuid === main
    return {
      ...account,
      main: isMain,
      rank: rank?.tier
        ? {
            tier: rank.tier,
            division: rank.division ?? null,
            lp: rank.league_points ?? 0,
            wins: rank.wins ?? 0,
            losses: rank.losses ?? 0,
          }
        : null,
      line: isMain ? line : [],
      delta: isMain && line.length > 1 ? line.at(-1)!.value - line[0].value : null,
      champions: mostPlayed(played, isMain ? 3 : 2),
      form: isMain
        ? []
        : played
            .slice(0, FORM_GAMES)
            .reverse()
            .map((g) => g.win),
    }
  })
}
