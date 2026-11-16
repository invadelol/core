import env from '#start/env'

/**
 * Whether core takes what the desktop app read from the League client, one switch each:
 *
 * - uploads (`DESKTOP_UPLOADS_ENABLED`): the games the app's signed-in account played, with
 *   their LP change (docs/desktop-sync.md §2.5). Since 0.3.9 the app sends only the game just
 *   played; older apps also send the account's games they find in its history;
 * - observed games (`DESKTOP_OBSERVED_ENABLED`, §2.5 v1.3): games the app read that its account
 *   did not play;
 * - player snapshots (`DESKTOP_PLAYERS_ENABLED`, §6): what the client showed about players.
 *
 * Each is off unless the environment switches it on, and the last two need uploads on too: the
 * website reads games and players through the Riot API, the source Riot supports. While one is
 * off, `GET /config` says so and its routes answer 503 `E_UPLOADS_PAUSED`, which every app since
 * the first sync release takes as a pause rather than an error; with player snapshots off,
 * snapshots staged earlier are never applied.
 */

let forced: { uploads?: boolean; observed?: boolean; players?: boolean } = {}

export function uploadsEnabled(): boolean {
  return forced.uploads ?? env.get('DESKTOP_UPLOADS_ENABLED', false)
}

/** Observed games have their own switch, and need uploads on too. */
export function observedEnabled(): boolean {
  return uploadsEnabled() && (forced.observed ?? env.get('DESKTOP_OBSERVED_ENABLED', false))
}

/** Player snapshots have their own switch, and need uploads on too. */
export function playersEnabled(): boolean {
  return uploadsEnabled() && (forced.players ?? env.get('DESKTOP_PLAYERS_ENABLED', false))
}

/** Tests only: set the switches without the environment; `{}` restores it. */
export function forceSwitches(next: { uploads?: boolean; observed?: boolean; players?: boolean }) {
  forced = { ...next }
}
