import app from '@adonisjs/core/services/app'
import { startCellCounter } from '#services/stats_cells'
import { startStatsWarmer } from '#services/stats_warmer'

/**
 * The patches are counted into the stats cells (the next one before it is shown), and the
 * default champion pages answered before the first visitor asks (production only).
 */
if (app.inProduction) {
  startCellCounter()
  startStatsWarmer()
}
