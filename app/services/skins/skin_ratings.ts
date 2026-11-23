import db from '@adonisjs/lucid/services/db'
import type { Catalogue } from '#services/skins/skin_catalogue'
import type {
  RatedSkin,
  RatingSummary,
  SkinCard,
  SkinFacts,
} from '../../../inertia/lib/skin_types.js'

/**
 * Ratings in half stars (1 to 10) and what they add up to: a skin's average and histogram, a
 * person's, and the best rated skins. Averages are out of five with one decimal.
 */

/** The poster's fields of a catalogue skin. */
export const cardOf = (skin: SkinFacts): SkinCard => ({
  id: skin.id,
  championId: skin.championId,
  num: skin.num,
  name: skin.name,
  championName: skin.championName,
  rarity: skin.rarity,
})

const average = (sum: number, count: number) =>
  count ? Math.round((sum / count / 2) * 10) / 10 : null

/**
 * The prior a best-rated list leans on (a Bayesian average): a skin needs several ratings
 * before a handful of perfect ones lifts it over skins many people rated well.
 */
const PRIOR_WEIGHT = 5
const PRIOR_MEAN = 6.5

export function summaryOf(histogram: number[]): RatingSummary {
  const count = histogram.reduce((n, c) => n + c, 0)
  const sum = histogram.reduce((n, c, i) => n + c * (i + 1), 0)
  return { average: average(sum, count), count, histogram }
}

async function histogramWhere(column: 'skin_id' | 'user_id', value: number | string) {
  const result = await db.rawQuery(
    `SELECT rating, count(*)::int AS n FROM invade_skin_rating WHERE ${column} = ? GROUP BY rating`,
    [value]
  )
  const histogram = Array.from({ length: 10 }, () => 0)
  for (const row of result.rows as { rating: number; n: number }[]) {
    histogram[row.rating - 1] = row.n
  }
  return summaryOf(histogram)
}

export const skinRatings = (skinId: number) => histogramWhere('skin_id', skinId)
export const personRatings = (userId: string) => histogramWhere('user_id', userId)

/** Average and count of each of `ids`. */
export async function averages(ids: number[]) {
  const out = new Map<number, { average: number | null; ratings: number }>()
  if (!ids.length) return out
  const result = await db.rawQuery(
    `SELECT skin_id, sum(rating)::int AS total, count(*)::int AS n
     FROM invade_skin_rating WHERE skin_id = ANY(?) GROUP BY skin_id`,
    [ids]
  )
  for (const row of result.rows as { skin_id: number; total: number; n: number }[]) {
    out.set(row.skin_id, { average: average(row.total, row.n), ratings: row.n })
  }
  return out
}

/** Catalogue skins with their average, in the order given. */
export async function rated(skins: SkinFacts[]): Promise<RatedSkin[]> {
  const found = await averages(skins.map((s) => s.id))
  return skins.map((skin) => ({
    ...cardOf(skin),
    average: found.get(skin.id)?.average ?? null,
    ratings: found.get(skin.id)?.ratings ?? 0,
  }))
}

/**
 * The best rated of `ids` (every rated skin when none are given), by Bayesian average, best first.
 */
export async function bestRated(
  catalogue: Catalogue,
  limit: number,
  ids?: number[]
): Promise<RatedSkin[]> {
  const result = await db.rawQuery(
    `SELECT skin_id, sum(rating)::int AS total, count(*)::int AS n FROM invade_skin_rating
     ${ids ? 'WHERE skin_id = ANY(?)' : ''}
     GROUP BY skin_id
     ORDER BY (sum(rating) + ${PRIOR_WEIGHT * PRIOR_MEAN}) / (count(*) + ${PRIOR_WEIGHT}) DESC,
              count(*) DESC, skin_id
     LIMIT ${Math.trunc(limit * 2)}`,
    ids ? [ids] : []
  )
  const out: RatedSkin[] = []
  for (const row of result.rows as { skin_id: number; total: number; n: number }[]) {
    const skin = catalogue.get(row.skin_id)
    if (!skin) continue
    out.push({ ...cardOf(skin), average: average(row.total, row.n), ratings: row.n })
    if (out.length === limit) break
  }
  return out
}

/** Where a skin stands among its champion's rated skins, best first. */
export async function placeAmongChampion(catalogue: Catalogue, skin: SkinFacts) {
  const ids = (catalogue.byChampion.get(skin.championId) ?? []).map((s) => s.id)
  const best = await bestRated(catalogue, ids.length, ids)
  const rank = best.findIndex((s) => s.id === skin.id)
  return rank < 0 ? null : { rank: rank + 1, of: ids.length }
}
