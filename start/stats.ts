import app from '@adonisjs/core/services/app'
import championStatsService from '#services/champion_stats_service'
import { startCellCounter } from '#services/stats_cells'
import { startStatsWarmer } from '#services/stats_warmer'

/**
 * The patches are counted into the stats cells, and the default champion pages answered before
 * the first visitor asks (production only).
 */
if (app.inProduction) {
  startCellCounter(() => championStatsService.patches())
  startStatsWarmer()
}
