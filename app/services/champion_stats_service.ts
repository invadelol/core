import riotAssetsService from '#services/riot/assets'
import { AnswerCache, BRACKETS, type Bracket } from '#services/ranked_stats'
import { latestPatch, rows } from '#services/ranked_games_service'
import {
  REGIONS,
  averages,
  averagesSql,
  byLength,
  byRank,
  lengthSql,
  matchups,
  matchupsSql,
  patchesSql,
  skillOrderSql,
  skillOrders,
  summarize,
  summaryByRankSql,
  summarySql,
  teammates,
  teammatesSql,
  totalsSql,
  trend,
  trendSql,
  type Filter,
  type Position,
  type Summary,
} from '#services/champion_stats'
import { championSlug } from '../../inertia/lib/champions.js'

/** The bracket a page shows unless the address names another. */
export const DEFAULT_BRACKET: Bracket = 'emerald_plus'
/** A patch is offered in the patch menu from this many crawled games. */
const MIN_PATCH_GAMES = 5_000
/** A patch's ranks are compared with the previous patch's from this many games there. */
const MIN_PREVIOUS_GAMES = 20_000
const TREND_DAYS = 30

const num = (v: unknown) => Number(v)

/**
 * Champion statistics from our own crawled ranked games (`champion_stats.ts` counts them): the
 * champion list and tier list, and a champion's page. Answers are kept half an hour.
 */
export class ChampionStatsService {
  #summaries = new AnswerCache(64)
  #byRank = new AnswerCache(16)
  #champion = new AnswerCache()
  #patches = new AnswerCache(1)

  /** The filters of an address: `?rank=emerald_plus&patch=16.20&region=euw`, defaults filled. */
  async filter(input: {
    rank?: unknown
    patch?: unknown
    region?: unknown
  }): Promise<Filter | null> {
    const rank = String(input.rank ?? '')
    const bracket = (rank in BRACKETS ? rank : DEFAULT_BRACKET) as Bracket
    const region = String(input.region ?? '').toLowerCase()
    const patches = await this.patches()
    const wanted = String(input.patch ?? '')
    const patch = patches.some((p) => p.patch === wanted) ? wanted : await latestPatch()
    if (!patch) return null
    return { patch, bracket, region: region in REGIONS ? region : null }
  }

  /** Patches with enough crawled games, newest first. */
  patches(): Promise<{ patch: string; games: number }[]> {
    return this.#patches.get('patches', async () => {
      const found = await rows(patchesSql())
      return found
        .map(([patch, games]) => ({ patch: String(patch), games: num(games) }))
        .filter((p) => p.games >= MIN_PATCH_GAMES)
    })
  }

  /** Every champion in every role, ranked within each role. */
  summary(filter: Filter): Promise<Summary> {
    return this.#summaries.get(key(filter), async () => {
      const params = { patch: filter.patch }
      const [found, totals] = await Promise.all([
        rows(summarySql(filter), params),
        rows(totalsSql(filter), params),
      ])
      return summarize(
        filter,
        found.map(([c, p, g, w]) => [num(c), String(p), num(g), num(w)]),
        totals.map(([kind, id, n]) => [String(kind), num(id), num(n)])
      )
    })
  }

  /** The previous patch's summary when it has enough games, to show how each rank moved. */
  async previous(filter: Filter): Promise<Summary | null> {
    const patches = await this.patches()
    const at = patches.findIndex((p) => p.patch === filter.patch)
    const before = at >= 0 ? patches[at + 1] : undefined
    if (!before || before.games < MIN_PREVIOUS_GAMES) return null
    return this.summary({ ...filter, patch: before.patch })
  }

  /** One champion's record at each rank group. */
  async byRank(filter: Filter, champion: number, position: Position) {
    const all = await this.#byRank.get(`${filter.patch}:${filter.region ?? ''}`, async () => {
      const found = await rows(summaryByRankSql(filter), { patch: filter.patch })
      return found.map(
        ([grp, c, p, g, w]) =>
          [String(grp), num(c), String(p), num(g), num(w)] as [
            string,
            number,
            string,
            number,
            number,
          ]
      )
    })
    return byRank(all, champion, position)
  }

  /** The lane opponents of a champion in a role. */
  matchups(filter: Filter, champion: number, position: Position) {
    return this.one('matchups', filter, champion, position, async (params) => {
      const found = await rows(matchupsSql(filter), params)
      return matchups(found.map((r) => r.map(num) as [number, number, number]))
    })
  }

  /** Teammates by role. */
  teammates(filter: Filter, champion: number, position: Position) {
    return this.one('teammates', filter, champion, position, async (params) => {
      const found = await rows(teammatesSql(filter), params)
      return teammates(
        found.map(
          ([p, c, g, w]) => [String(p), num(c), num(g), num(w)] as [string, number, number, number]
        )
      )
    })
  }

  /** Skill orders, most played first, and the order skills are maxed in. */
  skills(filter: Filter, champion: number, position: Position) {
    return this.one('skills', filter, champion, position, async (params) => {
      const found = await rows(skillOrderSql(filter), params)
      return skillOrders(
        found.map(
          ([order, g, w]) =>
            [(order as unknown[]).map(num), num(g), num(w)] as [number[], number, number]
        )
      )
    })
  }

  /** Win rate by game length, and the averages of a game. */
  async profile(filter: Filter, champion: number, position: Position) {
    return this.one('profile', filter, champion, position, async (params) => {
      const [length, avg] = await Promise.all([
        rows(lengthSql(filter), params),
        rows(averagesSql(filter), params),
      ])
      return {
        length: byLength(length.map((r) => r.map(num) as [number, number, number])),
        averages: averages(avg[0]?.map(num)),
      }
    })
  }

  /** The last 30 days, a day at a time (any patch). */
  trend(filter: Filter, champion: number, position: Position) {
    return this.one('trend', filter, champion, position, async (params) => {
      const since = Date.now() - TREND_DAYS * 86_400_000
      const found = await rows(trendSql(filter), { ...params, since })
      return trend(
        found.map(
          ([d, g, w, t, b]) =>
            [String(d), num(g), num(w), num(t), num(b)] as [string, number, number, number, number]
        )
      )
    })
  }

  /** Every champion of the live patch with its address. */
  async champions() {
    const list = await riotAssetsService.championList()
    return list.map((c) => ({ ...c, slug: championSlug(c.name) }))
  }

  /** The champion an address names (`miss-fortune`, `missfortune`, `21`). */
  async champion(slug: string) {
    const wanted = slug.toLowerCase()
    const list = await this.champions()
    return (
      list.find((c) => c.slug === wanted) ??
      list.find((c) => c.alias.toLowerCase() === wanted) ??
      list.find((c) => String(c.id) === wanted) ??
      null
    )
  }

  private one<T>(
    kind: string,
    filter: Filter,
    champion: number,
    position: Position,
    load: (params: Record<string, unknown>) => Promise<T>
  ): Promise<T> {
    return this.#champion.get(`${kind}:${key(filter)}:${champion}:${position}`, () =>
      load({ patch: filter.patch, champion, position })
    )
  }
}

const key = (filter: Filter) => `${filter.patch}:${filter.bracket}:${filter.region ?? ''}`

export default new ChampionStatsService()
