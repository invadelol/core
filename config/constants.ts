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
