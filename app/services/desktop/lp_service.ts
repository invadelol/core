import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { LpStatus } from '#models/desktop_match_upload'
import type { MatchUpload } from '#types/desktop'
import { validateLpChange } from '#services/desktop/lp'

/**
 * Stores the uploader's LP change for a game (docs/desktop-sync.md §4.4) and
 * lets the `after` snapshot stand in for a league-v4 read when it is newer
 * than the rank already stored.
 */
class LpService {
  async record(
    upload: MatchUpload,
    context: { matchId: string; puuid: string; deviceId: string }
  ): Promise<LpStatus> {
    if (upload.lp === null || upload.lp === undefined) return 'none'

    const { game } = upload
    const uploader = game.participantIdentities.find(
      (identity) => identity.player.puuid.toLowerCase() === upload.uploader.toLowerCase()
    )
    const participant = game.participants.find((p) => p.participantId === uploader?.participantId)
    const verdict = validateLpChange(upload.lp, {
      queueId: game.queueId,
      gameCreation: game.gameCreation,
      gameDuration: game.gameDuration,
      win: participant?.stats.win === true,
    })
    if (!verdict.ok) {
      logger.info(
        { matchId: context.matchId, reason: verdict.reason },
        'desktop LP change rejected'
      )
      return 'rejected'
    }

    const { before, after, delta, queue } = verdict.change
    // Only the first report of a game counts: a second device of the same
    // player saw the same client and has nothing to add.
    await db
      .knexQuery()
      .table('lp_change')
      .insert({
        match_id: context.matchId,
        puuid: context.puuid,
        queue,
        before_tier: before.tier,
        before_division: before.division,
        before_lp: before.lp,
        before_wins: before.wins,
        before_losses: before.losses,
        before_at: new Date(before.at),
        after_tier: after.tier,
        after_division: after.division,
        after_lp: after.lp,
        after_wins: after.wins,
        after_losses: after.losses,
        after_at: new Date(after.at),
        delta,
        source: 'desktop',
        device_id: context.deviceId,
        status: 'accepted',
        created_at: new Date(),
      })
      .onConflict(['match_id', 'puuid'])
      .ignore()

    await this.storeRank(context.puuid, queue, after).catch((error) =>
      logger.warn({ err: error, matchId: context.matchId }, 'desktop rank snapshot not stored')
    )
    return 'stored'
  }

  /**
   * The snapshot becomes the current rank when it is newer than what league-v4
   * last said. Rows are keyed by time, so an older snapshot arriving late only
   * adds history and never overrides a fresher read.
   */
  private async storeRank(
    puuid: string,
    queue: string,
    after: {
      tier: string
      division?: string | null
      lp: number
      wins: number
      losses: number
      at: number
    }
  ) {
    const latest = await db
      .from('riot_rank')
      .select('fetched_at')
      .where('puuid', puuid)
      .where('queue_type', queue)
      .orderBy('fetched_at', 'desc')
      .first()
    const at = DateTime.fromMillis(after.at)
    if (latest && DateTime.fromJSDate(new Date(latest.fetched_at)) >= at) return

    await db
      .knexQuery()
      .table('riot_rank')
      .insert({
        puuid,
        queue_type: queue,
        tier: after.tier,
        division: after.division ?? null,
        league_points: after.lp,
        wins: after.wins,
        losses: after.losses,
        fetched_at: at.toJSDate(),
        source: 'desktop',
      })
      .onConflict(['puuid', 'queue_type', 'fetched_at'])
      .ignore()
  }
}

export default new LpService()
