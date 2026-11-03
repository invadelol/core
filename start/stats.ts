import app from '@adonisjs/core/services/app'
import { startCellCounter } from '#services/stats_cells'
import { startStatsWarmer } from '#services/stats_warmer'
import { startRankSnapshots } from '#services/pro_ladder_service'

/**
 * The patches are counted into the stats cells (the next one before it is shown), the default
 * champion pages answered before the first visitor asks, and the pros' ranks kept an hour at a
 * time for their moves of the last 24 hours (production only).
 */
if (app.inProduction) {
  startCellCounter()
  startStatsWarmer()
  startRankSnapshots()
}
