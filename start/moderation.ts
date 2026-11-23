import app from '@adonisjs/core/services/app'
import { startRemovalSweep } from '#services/moderation/sweep'

/** What the team took down is deleted for good once it can no longer be restored (production). */
if (app.inProduction) {
  startRemovalSweep()
}
