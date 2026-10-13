import matchRepository from '#services/analytics/match_repository'
import lensRepository from '#services/analytics/lens_repository'
import { QUEUE_IDS, type RiotQueueType } from '#constants/riot'
import { LENS_ROLES, readLens, type LensPayload, type LensRole } from '../../inertia/lib/lens.js'
import type { Match } from '../../inertia/lib/types.js'

/** The windows the Lens reads, newest games first. */
export const LENS_WINDOWS = [20, 50] as const
export const DEFAULT_LENS_WINDOW = 20

/** `SUPPORT` is what the site's filters say; `UTILITY` is what Riot stores. */
export function lensRole(role: string | undefined): LensRole | null {
  const upper = role?.toUpperCase()
  const riot = upper === 'SUPPORT' ? 'UTILITY' : upper
  return (LENS_ROLES as readonly string[]).includes(riot ?? '') ? (riot as LensRole) : null
}

/** The role played most among the counted games; lane order breaks a tie. */
export function mainRole(roles: Array<{ role: string; games: number }>): LensRole | null {
  let best: { role: LensRole; games: number } | null = null
  for (const role of LENS_ROLES) {
    const games = roles.find((r) => r.role === role)?.games ?? 0
    if (games && (!best || games > best.games)) best = { role, games }
  }
  return best?.role ?? null
}

/**
 * A player's performance in one role, domain by domain (lib/lens.ts). With no role asked, the
 * role they played most lately in the queue. Reads stored games only, never Riot.
 */
class LensService {
  async get(
    puuid: string,
    options: { role?: string; type?: RiotQueueType; count?: number } = {}
  ): Promise<LensPayload> {
    const queue = options.type ?? 'all'
    const queueIds = queue === 'all' ? [] : [...(QUEUE_IDS[queue] ?? [])]
    const count = Math.min(Math.max(Math.trunc(options.count ?? DEFAULT_LENS_WINDOW), 1), 50)

    const counted = lensRepository.roles(puuid, queueIds)
    const asked = lensRole(options.role)
    const role = asked ?? mainRole(await counted)

    const roles = async () => {
      const list = await counted
      return list
        .map((r) => ({ role: lensRole(r.role)!, games: r.games }))
        .filter((r) => r.role)
        .sort(
          (a, b) => b.games - a.games || LENS_ROLES.indexOf(a.role) - LENS_ROLES.indexOf(b.role)
        )
    }

    if (!role) {
      return {
        role: null,
        roles: await roles(),
        queue,
        window: count,
        games: [],
        timelineGames: 0,
        score: null,
        champions: [],
        duel: null,
        objectives: null,
        domains: [],
      }
    }

    const window = { puuid, queueIds, role, count }
    const [matches, frames, events, played] = await Promise.all([
      matchRepository.getByPuuid(puuid, { view: 'summary', queueIds, role, count }),
      lensRepository.frames(window),
      lensRepository.events(window),
      roles(),
    ])
    const lens = readLens({ puuid, role, matches: matches as Match[], frames, events })
    return { ...lens, roles: played, queue, window: count }
  }
}

export default new LensService()
