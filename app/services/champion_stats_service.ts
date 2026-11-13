import riotAssetsService from '#services/riot/assets'
import { AnswerCache, BRACKETS, type Bracket } from '#services/ranked_stats'
import {
  latestPatch,
  rangeStart,
  rows,
  shownPatches,
  statsCache,
  type StoredPatch,
} from '#services/ranked_games_service'
import {
  REGIONS,
  averages,
  byLength,
  byRank,
  detailSql,
  details,
  early,
  earlyFromCellsSql,
  earlySql,
  firstBlood,
  firstBloodFromCellsSql,
  firstBloodSql,
  laneOpponentsSql,
  lanePairs,
  lanePairsSql,
  laneSql,
  matchups,
  objectives,
  opponentsOf,
  profileSql,
  skillOrderSql,
  skillOrders,
  summarize,
  summaryByRankCellsSql,
  summaryByRankSql,
  summaryCellsSql,
  summarySql,
  teammates,
  totalsCellsSql,
  totalsSql,
  trend,
  trendDaysSql,
  trendGamesSql,
  trendRows,
  type Filter,
  type Position,
  type Summary,
} from '#services/champion_stats'
import { matchupReport } from '#services/matchup_stats'
import { tierListReport } from '#services/tier_list_stats'
import { areEventsCounted, isCounted } from '#services/stats_cells'
import { championSlug } from '../../inertia/lib/champions.js'
import { patchRange, patchValue, previousRange } from '../../inertia/lib/patches.js'

/** The bracket a page shows unless the address names another. */
export const DEFAULT_BRACKET: Bracket = 'emerald_plus'
const TREND_DAYS = 30
/**
 * The timeline and event blocks read a sample, but stay bounded on a busy server: ClickHouse
 * stops them past this, and stops them too if the request that asked has gone.
 */
const EVENT_LIMITS = {
  max_execution_time: 20,
  max_threads: 2,
  cancel_http_readonly_queries_on_client_close: 1,
} as const
const DAY_MS = 86_400_000

const num = (v: unknown) => Number(v)

/**
 * Champion statistics from our own crawled ranked games (`champion_stats.ts` counts them): the
 * champion list and tier list, and a champion's page. Answers are kept a day, in this process
 * and in Redis (`stats_cache.ts`), and computed again when a new patch becomes the default.
 */
export class ChampionStatsService {
  // Every champion at once (~100 kB each): few kept in this process, all of them in Redis.
  #summaries = statsCache('summary', 64)
  #byRank = statsCache('by-rank', 16)
  #champion = statsCache('champion')
  #trendDays = statsCache('trend-days', 16)
  // Every lane pair of a patch (~1.5 MB each): few kept in this process, all of them in Redis.
  #pairs = statsCache('lane-pairs', 4)
  /** One champion's opponents from the counted cells: a burst of asks reads them once. */
  #opponents = new AnswerCache(2048, 10 * 60_000)

  /**
   * The filters of an address: `?rank=emerald_plus&patch=16.20&region=euw`, defaults filled. The
   * patch is one offered patch or a range of them (`16.20-16.22`, `patchRange`); anything else
   * reads the newest.
   */
  async filter(input: {
    rank?: unknown
    patch?: unknown
    region?: unknown
  }): Promise<Filter | null> {
    const rank = String(input.rank ?? '')
    const bracket = (rank in BRACKETS ? rank : DEFAULT_BRACKET) as Bracket
    const region = String(input.region ?? '').toLowerCase()
    const shown = await this.patches()
    const offered = shown.map((p) => p.patch)
    const latest = await latestPatch()
    const patches = patchRange(input.patch, offered) ?? (latest ? [latest] : null)
    if (!patches) return null
    return {
      patch: patchValue(patches),
      patches,
      bracket,
      region: region in REGIONS ? region : null,
    }
  }

  /** The patch menu: patches with enough crawled games, newest first (`shownPatches`). */
  patches(): Promise<StoredPatch[]> {
    return shownPatches()
  }

  /** Every champion in every role, ranked within each role (from the counted cells once the patch is counted). */
  summary(filter: Filter): Promise<Summary> {
    return this.#summaries.get(key(filter), async () => {
      const params = { patches: filter.patches }
      const cells = await isCounted(filter.patches)
      const [found, totals] = await Promise.all([
        rows(cells ? summaryCellsSql(filter) : summarySql(filter), params),
        rows(cells ? totalsCellsSql(filter) : totalsSql(filter), params),
      ])
      return summarize(
        filter,
        found.map(([c, p, g, w]) => [num(c), String(p), num(g), num(w)]),
        totals.map(([kind, id, n]) => [String(kind), num(id), num(n)])
      )
    })
  }

  /**
   * The previous patch's summary (it is in the menu: it has enough games), to show how each rank
   * moved; for a range, the same number of patches just before it (`previousRange`), null when
   * the menu does not hold that many.
   */
  async previous(filter: Filter): Promise<Summary | null> {
    const shown = await this.patches()
    const offered = shown.map((p) => p.patch)
    const before = previousRange(filter.patches, offered)
    if (!before) return null
    return this.summary({ ...filter, patch: patchValue(before), patches: before })
  }

  /**
   * The desktop app's tier list: the summary, each row with its place in the role on the patch
   * before (same bracket and region), and the patches that can be asked for.
   */
  async tierList(filter: Filter) {
    const [summary, previous, patches] = await Promise.all([
      this.summary(filter),
      this.previous(filter),
      this.patches(),
    ])
    return tierListReport(summary, previous, patches)
  }

  /** One champion's record at each rank group. */
  async byRank(filter: Filter, champion: number, position: Position) {
    const all = await this.#byRank.get(`${filter.patch}:${filter.region ?? ''}`, async () => {
      const cells = await isCounted(filter.patches)
      const found = await rows(cells ? summaryByRankCellsSql(filter) : summaryByRankSql(filter), {
        patches: filter.patches,
      })
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
  async matchups(filter: Filter, champion: number, position: Position) {
    const lane = await this.lane(filter, champion, position)
    return lane.matchups
  }

  /**
   * The desktop app's matchups: every lane opponent with its share of the games and its gap to
   * the champion's own win rate, the champion's row of the tier list and the patches that can be
   * asked for. The same games and pairs as the Matchups tab, counted for every champion at once.
   */
  async report(filter: Filter, champion: number, position: Position) {
    const [opponents, summary, patches] = await Promise.all([
      this.opponents(filter, champion, position),
      this.summary(filter),
      this.patches(),
    ])
    const stat = summary.roles.find((r) => r.champion === champion && r.position === position)
    return matchupReport(filter, champion, position, opponents, stat ?? null, patches)
  }

  /**
   * One champion's lane opponents: a few thousand counted rows once the patch is counted
   * (milliseconds), else its slice of every lane pair of the filter.
   */
  private async opponents(
    filter: Filter,
    champion: number,
    position: Position
  ): Promise<[number, number, number][]> {
    if (!(await isCounted(filter.patches))) {
      return opponentsOf(await this.lanePairs(filter), champion, position)
    }
    return this.#opponents.get(`${key(filter)}:${champion}:${position}`, async () => {
      const found = await rows(laneOpponentsSql(filter), {
        patches: filter.patches,
        champion,
        position,
      })
      return found.map(([o, g, w]) => [num(o), num(g), num(w)] as [number, number, number])
    })
  }

  /** Every lane pair of the filter, read in one pass (~10 s for a whole patch at all ranks). */
  lanePairs(filter: Filter): Promise<Record<string, number[]>> {
    return this.#pairs.get(key(filter), async () => {
      const found = await rows(lanePairsSql(filter), { patches: filter.patches })
      return lanePairs(
        found.map(
          ([p, c, o, g, w]) =>
            [String(p), num(c), num(o), num(g), num(w)] as [string, number, number, number, number]
        )
      )
    })
  }

  /** Teammates by role. */
  async teammates(filter: Filter, champion: number, position: Position) {
    const lane = await this.lane(filter, champion, position)
    return lane.teammates
  }

  /** Lane opponents and teammates, from one read of the games' lineups. */
  private lane(filter: Filter, champion: number, position: Position) {
    return this.one('lane', filter, champion, position, async (params) => {
      const found = await rows(laneSql(filter), params)
      const opponents: [number, number, number][] = []
      const mates: [string, number, number, number][] = []
      for (const [kind, pos, c, g, w] of found) {
        if (kind === 'opponent') opponents.push([num(c), num(g), num(w)])
        else mates.push([String(pos), num(c), num(g), num(w)])
      }
      return { matchups: matchups(opponents), teammates: teammates(mates) }
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

  /** Win rate by game length, the averages of a game, and the objectives of the two teams. */
  async profile(filter: Filter, champion: number, position: Position) {
    return this.one('profile', filter, champion, position, async (params) => {
      const result = await rows(profileSql(filter), params)
      const found = result.map((r) => r.map(num))
      return {
        length: byLength(found.map((r) => r.slice(0, 3) as [number, number, number])),
        averages: averages(found),
        objectives: objectives(found),
      }
    })
  }

  /** What the participant rows hold beyond the averages: damage taken, wards, levels, damage split. */
  details(filter: Filter, champion: number, position: Position) {
    return this.one('details', filter, champion, position, async (params) => {
      const [row] = await rows(detailSql(filter), params)
      return details((row ?? []).map(num))
    })
  }

  /**
   * CS, gold and experience at 10 and 15 minutes, and the gaps to the lane opponent: from the
   * counted cells once the patch's events are counted (every game), else a sample of the games.
   */
  async early(filter: Filter, champion: number, position: Position) {
    const cells = await areEventsCounted(filter.patches)
    return this.one(cells ? 'early-cells' : 'early', filter, champion, position, async (params) => {
      const found = cells
        ? await rows(earlyFromCellsSql(filter), params)
        : await rows(earlySql(filter), params, EVENT_LIMITS)
      return early(found.map((r) => r.map(num)))
    })
  }

  /** How often the champion takes first blood, helps it or gives it (counted cells, else a sample). */
  async firstBlood(filter: Filter, champion: number, position: Position) {
    const cells = await areEventsCounted(filter.patches)
    const kind = cells ? 'first-blood-cells' : 'first-blood'
    return this.one(kind, filter, champion, position, async (params) => {
      const [row] = cells
        ? await rows(firstBloodFromCellsSql(filter), params)
        : await rows(firstBloodSql(filter), params, EVENT_LIMITS)
      return firstBlood((row ?? []).map(num))
    })
  }

  /**
   * The 30 days before today (UTC), a day at a time, any patch. Whole days only, so the games of
   * every champion that day (asked once for all of them, `#trendDays`) and this champion's games
   * cover the same hours.
   */
  trend(filter: Filter, champion: number, position: Position) {
    return this.one('trend', filter, champion, position, async (params) => {
      const until = Math.floor(Date.now() / DAY_MS) * DAY_MS
      const window = { since: until - TREND_DAYS * DAY_MS, until }
      const [days, mine] = await Promise.all([
        this.trendDays(filter, window),
        rows(trendGamesSql(filter), { ...params, ...window }),
      ])
      return trend(
        trendRows(
          days,
          mine.map(([d, g, w]) => [String(d), num(g), num(w)]),
          champion
        )
      )
    })
  }

  /** Every champion's side of the trend's days: games that day and bans per champion. */
  private trendDays(filter: Filter, window: { since: number; until: number }) {
    const at = `${filter.bracket}:${filter.region ?? ''}:${window.since}`
    return this.#trendDays.get(at, async () => {
      const found = await rows(trendDaysSql(filter), window)
      return found.map((row) => {
        const [d, total, [ids, bans]] = row as [unknown, unknown, [unknown[], unknown[]]]
        return [String(d), num(total), [ids.map(num), bans.map(num)]]
      }) as [string, number, [number[], number[]]][]
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
    return this.#champion.get(`${kind}:${key(filter)}:${champion}:${position}`, async () =>
      load({
        patches: filter.patches,
        champion,
        position,
        patchStart: await rangeStart(filter.patches),
      })
    )
  }
}

const key = (filter: Filter) => `${filter.patch}:${filter.bracket}:${filter.region ?? ''}`

export default new ChampionStatsService()
