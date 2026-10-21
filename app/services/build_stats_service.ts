import { DDRAGON, FETCH_TIMEOUT_MS } from '#constants/assets'
import { AnswerCache, ROLES, type Bracket, type Role } from '#services/ranked_stats'
import { latestPatch, rows } from '#services/ranked_games_service'
import {
  buildRowsSql,
  itemKinds,
  summarizeBuilds,
  type BuildRow,
  type BuildStats,
  type ItemKinds,
} from '#services/build_stats'

/** The patch's item data could not be read from Data Dragon: the app asks again later. */
export class ItemDataUnavailable extends Error {}

/**
 * Item builds players really buy, per champion and role, from the ranked games in our own
 * ClickHouse: the app's source of starting items, boots, core and later items for every
 * champion in every role. The counting is in `build_stats.ts`; which ids are boots, legendary
 * items or trinkets comes from the patch's Data Dragon items.
 */
export class BuildStatsService {
  #cache = new AnswerCache()
  #items = new AnswerCache(8)

  async forRole(
    champion: number,
    role: Role,
    bracket: Bracket = 'all',
    patch?: string
  ): Promise<BuildStats | null> {
    const resolvedPatch = patch ?? (await latestPatch())
    if (!resolvedPatch) return null
    const position = ROLES[role]
    const key = `${champion}:${position}:${bracket}:${resolvedPatch}`
    return this.#cache.get(key, async () => {
      const kinds = await this.kinds(resolvedPatch)
      const found = await rows(buildRowsSql(bracket, { champion, position }, kinds), {
        champion,
        position,
        patch: resolvedPatch,
      })
      const parsed = found.map(
        ([kind, items, slot, games, wins]) =>
          [
            String(kind),
            (items as unknown[]).map(Number),
            Number(slot),
            Number(games),
            Number(wins),
          ] as BuildRow
      )
      return {
        champion,
        role: position,
        patch: resolvedPatch,
        bracket,
        ...summarizeBuilds(parsed, kinds),
      }
    })
  }

  /** The item kinds of `patch` (`16.20`), from its newest Data Dragon release. */
  kinds(patch: string): Promise<ItemKinds> {
    return this.#items.get(patch, async () => {
      const versions = await download(`${DDRAGON}/api/versions.json`)
      const list = Array.isArray(versions) ? versions.map(String) : []
      const version = list.find((v) => v.startsWith(`${patch}.`)) ?? list[0]
      const items = version && (await download(`${DDRAGON}/cdn/${version}/data/en_US/item.json`))
      if (!items?.data) throw new ItemDataUnavailable(`no Data Dragon items for ${patch}`)
      return itemKinds(items.data)
    })
  }
}

async function download(url: string): Promise<any | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    return response.ok ? await response.json() : null
  } catch {
    return null
  }
}

export default new BuildStatsService()
