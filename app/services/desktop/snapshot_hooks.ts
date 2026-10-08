import logger from '@adonisjs/core/services/logger'

/**
 * Where the rest of core tells the player snapshot pipeline that it learned
 * whose a Riot ID or a raw PUUID is (docs/desktop-sync.md §6.3), so a staged
 * snapshot can be applied.
 *
 * The callers (Riot ID resolution, participant upserts, verified match
 * uploads) must never wait on or fail because of this: the work runs in the
 * background, errors are logged, and the pipeline is imported lazily, which
 * also keeps `summoner_service` free of an import cycle with it.
 */

const pending = new Set<Promise<void>>()

function track(name: string, task: () => Promise<void>) {
  const run: Promise<void> = Promise.resolve()
    .then(task)
    .catch((error) => logger.warn({ err: error }, `staged player snapshots: ${name} failed`))
    .finally(() => pending.delete(run))
  pending.add(run)
}

export interface LearnedRiotId {
  gameName: string
  tagLine: string
  platform: string
}

/** Core now holds the `riot_player` row (and so the API PUUID) of these Riot IDs. */
export function riotIdsLearned(players: LearnedRiotId[]) {
  const known = players.filter((p) => p.gameName && p.tagLine && p.platform)
  if (!known.length) return
  track('Riot ID lookup', async () => {
    const { default: snapshots } = await import('#services/desktop/player_snapshot_service')
    await snapshots.applyStagedByRiotId(known)
  })
}

/** match-v5 proved these raw PUUIDs' API PUUIDs. */
export function aliasesVerified(rawPuuids: string[]) {
  if (!rawPuuids.length) return
  track('verified aliases', async () => {
    const { default: snapshots } = await import('#services/desktop/player_snapshot_service')
    await snapshots.applyStagedByRawPuuid(rawPuuids)
  })
}

/** Resolves when every hook started so far has finished; for tests and shutdown. */
export async function settled() {
  while (pending.size) await Promise.allSettled([...pending])
}
