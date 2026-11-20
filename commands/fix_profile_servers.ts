import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

import riotApiService from '#services/riot/api'
import { inBackground } from '#services/riot/client'
import { normalizePlatform, type RiotPlatform } from '#services/riot/routing'
import { riotErrorStatus } from '#utils/riot_errors'

type Row = { puuid: string; platform: string; game_name: string; tag_line: string }

/**
 * Moves stored profiles to the server their account plays on.
 *
 * A lookup used to keep the first server whose summoner-v4 answered, and one account can hold a
 * summoner on several servers (an old one left behind by a transfer). Those profiles opened on
 * the old server: the wrong level, no rank, none of the games. Only profiles made by a lookup are
 * at risk (`last_refresh_at` set); the ones learned from a game carry that game's server.
 *
 * One account-v1 call per profile, behind every visitor's request; a moved profile also costs a
 * summoner-v4 and a league-v4 call. Its games load on the next Update. Safe to re-run.
 */
export default class FixProfileServers extends BaseCommand {
  static commandName = 'profiles:fix-servers'
  static description = 'Move profiles stored on a server their account does not play on'

  static options: CommandOptions = { startApp: true }

  @flags.boolean({ description: 'Report what would move, change nothing' })
  declare dryRun: boolean

  @flags.boolean({ description: 'Only the profiles pro data places on another server' })
  declare pros: boolean

  @flags.number({ description: 'Check at most this many profiles' })
  declare limit?: number

  @flags.number({ description: 'Riot calls per second (default 5)' })
  declare rate?: number

  async run() {
    const rows = await this.candidates()
    const gap = 1000 / Math.max(1, this.rate ?? 5)
    const tally = { checked: 0, right: 0, moved: 0, unknown: 0, noSummoner: 0, nameTaken: 0 }
    this.logger.info(`${rows.length} profiles to check${this.dryRun ? ' (dry run)' : ''}`)

    for (const row of rows) {
      tally.checked++
      const started = Date.now()
      const outcome = await inBackground(() => this.check(row)).catch((error) => {
        this.logger.warning(`${row.game_name}#${row.tag_line}: ${describe(error)}`)
        return 'unknown' as const
      })
      tally[outcome]++
      if (tally.checked % 100 === 0)
        this.logger.info(`${tally.checked}/${rows.length} ${line(tally)}`)
      const wait = gap - (Date.now() - started)
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    }

    this.logger.success(line(tally))
  }

  private async candidates(): Promise<Row[]> {
    const query = db
      .from('riot_player as r')
      .select('r.puuid', 'r.platform', 'r.game_name', 'r.tag_line')
      .whereNotNull('r.last_refresh_at')
      .orderBy('r.view_count', 'desc')
    if (this.pros) {
      query.whereExists((pro) =>
        pro
          .from('pro_account as a')
          .whereRaw('a.game_name = r.game_name and a.tag_line = r.tag_line')
          .whereRaw('a.platform <> r.platform')
      )
    }
    if (this.limit) query.limit(this.limit)
    return query
  }

  private async check(
    row: Row
  ): Promise<'right' | 'moved' | 'unknown' | 'noSummoner' | 'nameTaken'> {
    let active: RiotPlatform
    try {
      active = normalizePlatform(await riotApiService.accountRegion('europe', row.puuid))
    } catch (error) {
      if (riotErrorStatus(error) === 404 || riotErrorStatus(error) === 400) return 'unknown'
      throw error
    }
    if (active === row.platform) return 'right'

    const name = `${row.game_name}#${row.tag_line}`
    let details
    try {
      details = await riotApiService.client.summoner.getByPUUID({
        region: active.toLowerCase() as never,
        puuid: row.puuid,
      })
    } catch (error) {
      if (riotErrorStatus(error) === 404) return 'noSummoner'
      throw error
    }

    // The Riot ID is unique on a server: another stored profile holding it there is a renamed
    // account we have not seen since. Left for a lookup of either to sort out.
    const holder = await db
      .from('riot_player')
      .where({ platform: active, game_name: row.game_name, tag_line: row.tag_line })
      .whereNot('puuid', row.puuid)
      .first()
    if (holder) {
      this.logger.warning(`${name}: ${row.platform} → ${active} skipped, name held there`)
      return 'nameTaken'
    }

    this.logger.info(`${name}: ${row.platform} → ${active}`)
    if (this.dryRun) return 'moved'

    await db.from('riot_player').where('puuid', row.puuid).update({
      platform: active,
      profile_icon_id: details.profileIconId,
      summoner_level: details.summonerLevel,
    })
    const { default: summonerService } = await import('#services/summoner_service')
    await summonerService
      .updateRanks(row.puuid, active)
      .catch((error) => this.logger.warning(`${name}: rank not refreshed, ${describe(error)}`))
    const { invalidateResponseCache } = await import('#services/http_response_cache')
    await invalidateResponseCache([`summoner:${row.puuid}`]).catch(() => {})
    return 'moved'
  }
}

function describe(error: unknown) {
  const status = riotErrorStatus(error)
  return status ? `Riot ${status}` : error instanceof Error ? error.message : String(error)
}

function line(tally: Record<string, number>) {
  return Object.entries(tally)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ')
}
