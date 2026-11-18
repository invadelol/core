import type { HttpContext } from '@adonisjs/core/http'
import summonerService from '#services/summoner_service'
import riotAssets from '#services/riot/assets'
import { profileCard } from '#services/og/profile_card'
import { RENDERER } from '#services/og/version'
import { ByteCache } from '#utils/byte_cache'
import { STATS_WINDOW } from '#config/constants'
import { serverLabel } from '#constants/riot'

const cards = new ByteCache<Buffer>(24 * 1024 * 1024, 256)
const pending = new Map<string, Promise<{ body: Buffer; complete: boolean }>>()

/** The queue a profile card ranks the player in: Solo/Duo, else Flex. */
const QUEUES = ['RANKED_SOLO_5x5', 'RANKED_FLEX_SR']

/** A stored rank as the ranks service serializes it. */
interface RankRow {
  queueType: string
  tier: string | null
  division: string | null
  leaguePoints: number | null
}

/** A game shorter than this is a remake: it breaks no streak. */
const REMAKE_SECONDS = 300

async function bytes(kind: Parameters<typeof riotAssets.get>[0], id: string | number) {
  const asset = await riotAssets.get(kind, String(id)).catch(() => null)
  return asset && !asset.placeholder ? asset.body : null
}

/** Wins (positive) or losses (negative) in a row, newest first, from the stored games. */
export function streakOf(results: boolean[]) {
  if (!results.length) return 0
  const first = results[0]
  let n = 0
  for (const win of results) {
    if (win !== first) break
    n++
  }
  return first ? n : -n
}

export default class SocialCardsController {
  /**
   * `/og/:summoner`: the profile's link preview (`og/profile_card`), drawn from what is stored
   * (no Riot call): the rank, the recent win rate and streak, the most played champion. Kept five
   * minutes; a card missing its art is sent but not kept.
   */
  async show({ params, response }: HttpContext) {
    const profile = await summonerService.findStoredProfile(params.summoner)
    if (!profile) return response.notFound()
    const key = `${RENDERER}:${profile.puuid}:${profile.gameName}:${profile.tagLine}`
    let body = cards.get(key)
    let complete = true
    if (!body) {
      let job = pending.get(key)
      if (!job) {
        job = (async () => {
          const [stats, champions, ranks, matches] = await Promise.all([
            summonerService.getStats(profile.puuid, { count: STATS_WINDOW }).catch(() => null),
            summonerService.getChampionStats(profile.puuid, STATS_WINDOW).catch(() => null),
            summonerService.getRanks(profile.puuid).catch(() => null),
            summonerService
              .getMatches(profile.puuid, { view: 'summary', count: 10 })
              .catch(() => null),
          ])
          const champion = champions?.[0]?.championId
          const current = (ranks?.current ?? []) as unknown as RankRow[]
          const rank =
            QUEUES.map((q) => current.find((r) => r.queueType === q && r.tier)).find(Boolean) ??
            null
          const results = ((matches ?? []) as any[])
            .filter((m) => Number(m.duration) >= REMAKE_SECONDS)
            .map((m) => m.participants?.find((p: any) => p.puuid === profile.puuid))
            .filter(Boolean)
            .map((p: any) => Boolean(p.win))
          const [splash, icon, emblem] = await Promise.all([
            champion ? bytes('centered', champion) : null,
            profile.profileIconId ? bytes('profile-icon', profile.profileIconId) : null,
            rank?.tier ? bytes('emblem', rank.tier.toLowerCase()) : null,
          ])
          const global = stats?.global
          const rendered = await profileCard({
            gameName: profile.gameName,
            tagLine: profile.tagLine,
            region: serverLabel(profile.platform),
            icon,
            splash,
            rank: rank?.tier
              ? { tier: rank.tier, division: rank.division, lp: rank.leaguePoints ?? 0 }
              : null,
            emblem,
            games: global?.total ?? 0,
            winRate: global?.total ? global.winrate : null,
            streak: streakOf(results),
          })
          const ready = Boolean(stats && champions && (!champion || splash))
          if (ready) cards.set(key, rendered, rendered.byteLength, 300_000)
          return { body: rendered, complete: ready }
        })().finally(() => pending.delete(key))
        pending.set(key, job)
      }
      const result = await job
      body = result.body
      complete = result.complete
    }
    response.header('Content-Type', 'image/jpeg')
    response.header('Cache-Control', complete ? 'public, max-age=300' : 'no-store')
    return response.send(body)
  }
}
