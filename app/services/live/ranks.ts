import { ByteCache } from '#utils/byte_cache'
import { SyncGuard } from '#utils/sync_guard'
import type { LobbyRank } from '#services/live/live_game'

export type RankStatus = 'ranked' | 'unranked' | 'unavailable'

interface LeagueEntry {
  queueType: string
  tier: string
  rank: string
  leaguePoints: number
  wins: number
  losses: number
}

/** Undefined means no successful lookup; null means Riot confirmed no Solo/Duo rank. */
export interface LiveRankRead {
  rank: LobbyRank | null | undefined
  status: RankStatus
}

/** Shared across lobbies, including successful empty answers for unranked players. The reader
 * uses the application's rate-limited Riot client, without looking up ten full profiles. */
export class LiveRanks {
  private guard = new SyncGuard()
  private cache: ByteCache<{ rank: LobbyRank | null }>

  constructor(
    private read: (puuid: string, platform: string) => Promise<readonly LeagueEntry[]>,
    now = Date.now
  ) {
    this.cache = new ByteCache(2000, 2000, now)
  }

  async get(puuid: string, platform: string, refresh = false): Promise<LiveRankRead> {
    const key = `${platform}:${puuid}`
    const cached = this.cache.get(key)
    if (cached && !refresh) return this.result(cached.rank)
    try {
      const rank = await this.guard.run(key, async () => {
        const entries = await this.read(puuid, platform)
        if (!Array.isArray(entries)) throw new Error('Invalid league response')
        const solo = entries.find((entry) => entry.queueType === 'RANKED_SOLO_5x5')
        const value: LobbyRank | null =
          solo?.tier && solo.rank
            ? {
                puuid,
                tier: solo.tier,
                division: solo.rank,
                leaguePoints: solo.leaguePoints,
                wins: solo.wins,
                losses: solo.losses,
              }
            : null
        this.cache.set(key, { rank: value }, 1, 60_000)
        return value
      })
      return this.result(rank)
    } catch {
      // Keep the last successful read if an explicit refresh fails. Never cache an error
      // as Unranked, or let one failed player hide the rest of the lobby.
      return { rank: cached?.rank, status: 'unavailable' }
    }
  }

  private result(rank: LobbyRank | null): LiveRankRead {
    return { rank, status: rank ? 'ranked' : 'unranked' }
  }
}
