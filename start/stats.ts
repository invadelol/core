import app from '@adonisjs/core/services/app'
import { startStatsWarmer } from '#services/stats_warmer'

/** The default champion pages are answered before the first visitor asks (production only). */
if (app.inProduction) startStatsWarmer()
