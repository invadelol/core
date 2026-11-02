import env from '#start/env'

/**
 * Whether core takes what the desktop app read from the League client: the
 * games it uploads (docs/desktop-sync.md §2.5), the games it saw others play
 * (§2.5, v1.3) and player snapshots (§6).
 *
 * Off unless the environment switches it on (`DESKTOP_UPLOADS_ENABLED`,
 * `DESKTOP_OBSERVED_ENABLED`): the website reads games and players through
 * the Riot API, the source Riot supports. While off, `GET /config` says so and
 * the routes answer 503 `E_UPLOADS_PAUSED`, which every app since the first
 * sync release takes as a pause rather than an error, and snapshots staged
 * earlier are never applied.
 */

let forced: { uploads?: boolean; observed?: boolean } = {}

export function uploadsEnabled(): boolean {
  return forced.uploads ?? env.get('DESKTOP_UPLOADS_ENABLED', false)
}

/** Observed games have their own switch, and need uploads on too. */
export function observedEnabled(): boolean {
  return uploadsEnabled() && (forced.observed ?? env.get('DESKTOP_OBSERVED_ENABLED', false))
}

/** Tests only: set the switches without the environment; `{}` restores it. */
export function forceSwitches(next: { uploads?: boolean; observed?: boolean }) {
  forced = { ...next }
}
