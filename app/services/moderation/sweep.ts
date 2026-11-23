import logger from '@adonisjs/core/services/logger'
import clipService from '#services/clips/clip_service'
import commentService from '#services/clips/comments'
import moderation from '#services/moderation/moderation'

/**
 * How long a clip or a comment the team took down is kept, hidden, before it is deleted: the time
 * to restore one taken down by mistake.
 */
export const REMOVAL_GRACE_MS = 7 * 86_400_000
const SWEEP_MS = 3_600_000

/**
 * Deletes for good what the team took down more than seven days ago and was not restored: clips
 * with their files, GGs and saved copies, comments with their replies and GGs. The team's record
 * of the removal stays in its dashboard.
 */
export async function purgeRemoved(now = Date.now()) {
  const due = await moderation.removedBefore(new Date(now - REMOVAL_GRACE_MS))
  await clipService.purge(due.clips)
  await commentService.purge(due.comments)
  return { clips: due.clips.length, comments: due.comments.length }
}

/** Runs the deletion a minute after the server starts, then every hour. */
export function startRemovalSweep() {
  const run = () =>
    purgeRemoved()
      .then((done) => {
        if (done.clips || done.comments) logger.info(done, 'removed content deleted')
      })
      .catch((error) => logger.warn({ err: error }, 'removed content sweep failed'))
  setTimeout(run, 60_000).unref()
  setInterval(run, SWEEP_MS).unref()
}
