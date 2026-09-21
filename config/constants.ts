/**
 * Application-wide constants
 * Centralized location for all magic numbers and default values
 */

// Match retrieval defaults
export const DEFAULT_MATCH_COUNT = 15
export const DEFAULT_STATS_COUNT = 30
export const MAX_MATCH_COUNT = 100

// Friends/social defaults
export const DEFAULT_FRIENDS_LIMIT = 20

// Search defaults
export const DEFAULT_SEARCH_LIMIT = 10
export const MAX_SEARCH_LIMIT = 50

// Champion stats defaults
export const DEFAULT_CHAMPION_STATS_COUNT = 30
export const MAX_CHAMPION_STATS_COUNT = 100

// Pagination
export const DEFAULT_OFFSET = 0

// Cache timing (seconds)
// Redis TTL for server-side HTTP cache. Browser caching is disabled (no-store)
// so Redis invalidation takes effect immediately on next request.
export const CACHE_TTL_SECONDS = 2 * 60 * 60 // 2 hours

// Top champions to show in stats
export const TOP_CHAMPIONS_COUNT = 10

/**
 * The profile's headline window. Small enough that it describes current form
 * rather than a season, and the same size as the window it is compared with.
 */
export const STATS_WINDOW = 30

/**
 * Typeahead fires a request per pause in typing and popular prefixes repeat
 * across visitors, so a short cache removes almost all of the full-text scans
 * without a visible delay before a newly indexed player becomes findable.
 */
export const SEARCH_CACHE_TTL = '60s'

/**
 * Identity fields rendered into the profile HTML. They change only when a
 * player renames or changes icon, and this lookup sits in front of first
 * paint, so it is worth keeping out of Postgres.
 */
export const STORED_PROFILE_CACHE_TTL = '60s'
