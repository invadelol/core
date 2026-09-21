import { DEFAULT_MATCH_COUNT, STATS_WINDOW } from '#config/constants'

/**
 * The six independent requests a profile page makes, defined once.
 *
 * The page renders each panel the moment its own request lands, so these stay
 * separate rather than being merged into one response that can only be as fast
 * as its slowest part.
 *
 * This list is the single source of truth for both sides. The server uses it
 * to emit preload hints for a profile it already knows, and hands the same
 * list to the page so the requests it issues are exactly the ones that were
 * preloaded. Defining the URLs twice would mean a silent typo turns every hint
 * into a wasted download.
 */
export const ANALYTICS_PANELS = [
  { key: 'matches', path: `matches?count=${DEFAULT_MATCH_COUNT}&view=summary` },
  { key: 'stats', path: `stats?count=${STATS_WINDOW}` },
  { key: 'ranks', path: 'ranks' },
  { key: 'champions', path: 'champions?count=100' },
  { key: 'activity', path: 'activity' },
  { key: 'teammates', path: 'friends' },
] as const

export type AnalyticsPanel = (typeof ANALYTICS_PANELS)[number]
export type AnalyticsPanelKey = AnalyticsPanel['key']

export function analyticsBase(puuid: string) {
  return `/api/summoners/puuid/${puuid}`
}

/** Absolute URLs for one player, in the order the page asks for them. */
export function analyticsUrls(puuid: string) {
  const base = analyticsBase(puuid)
  return ANALYTICS_PANELS.map((panel) => `${base}/${panel.path}`)
}
