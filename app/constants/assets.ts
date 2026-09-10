/**
 * Community Dragon serves the live game data for whatever patch is current,
 * so nothing here is pinned to a patch number that goes stale.
 */
export const CDRAGON_GAME_DATA =
  'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default'

export const CDRAGON_STATIC_ASSETS =
  'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default'

export const DDRAGON = 'https://ddragon.leagueoflegends.com'

/** The asset families the proxy knows how to resolve. */
export const ASSET_KINDS = [
  'champion',
  'item',
  'spell',
  'perk',
  'perkstyle',
  'profile-icon',
  'rank',
] as const

export type AssetKind = (typeof ASSET_KINDS)[number]

/**
 * Community Dragon manifests, each mapping a numeric id to an `iconPath`.
 * Resolving through these beats hand-building URLs: the shape of the asset
 * paths changes between patches, the manifests do not.
 */
export const MANIFESTS: Partial<Record<AssetKind, string>> = {
  'champion': `${CDRAGON_GAME_DATA}/v1/champion-summary.json`,
  'item': `${CDRAGON_GAME_DATA}/v1/items.json`,
  'spell': `${CDRAGON_GAME_DATA}/v1/summoner-spells.json`,
  'perk': `${CDRAGON_GAME_DATA}/v1/perks.json`,
  'perkstyle': `${CDRAGON_GAME_DATA}/v1/perkstyles.json`,
  'profile-icon': `${CDRAGON_GAME_DATA}/v1/profile-icons.json`,
}

/** How long a parsed manifest stays cached before we look for a new patch. */
export const MANIFEST_TTL = '12h'

/** Bucket prefix for mirrored asset bytes. */
export const ASSET_PREFIX = 'riot-assets'

/**
 * Mirrored bytes never change for a given id within a patch, and a new patch
 * changes them rarely enough that a week of browser caching is the right
 * trade for the request volume it saves.
 */
export const BROWSER_CACHE_SECONDS = 60 * 60 * 24 * 7

/**
 * A generated placeholder is cached far more briefly, so the moment upstream
 * starts serving the real asset the page picks it up.
 */
export const PLACEHOLDER_CACHE_SECONDS = 60 * 5

/**
 * Id-to-name maps are derived from a manifest that changes once a patch, and
 * every profile page asks for two of them. An hour of browser caching, and of
 * holding the encoded bytes in the process, costs nothing in freshness.
 */
export const NAMES_CACHE_SECONDS = 60 * 60

/** Upstream is given this long before we fall through to the next source. */
export const FETCH_TIMEOUT_MS = 6000

/**
 * Tiles for generated placeholders. Muted enough to sit inside the UI without
 * shouting, distinct enough that two adjacent slots don't look identical.
 */
export const PLACEHOLDER_COLORS = [
  ['#e7e3da', '#b9b2a4'],
  ['#dfe4ea', '#a9b2bf'],
  ['#e3e0e7', '#b0a9bb'],
  ['#dee6e3', '#a5b5b0'],
  ['#e8e1e1', '#bda9a9'],
  ['#e1e5dd', '#adb5a4'],
] as const

/**
 * Vite writes content-hashed filenames, so a URL under `/assets` never
 * describes different bytes. `immutable` tells the browser exactly that, and
 * saves it a revalidation round trip per asset per page view.
 */
export const ASSET_IMMUTABLE_SECONDS = 60 * 60 * 24 * 365

/**
 * Files we serve under a stable name — the self-hosted fonts — are cached for
 * a month rather than declared immutable, so replacing one still reaches
 * everybody within a month instead of never.
 */
export const ASSET_REVALIDATE_SECONDS = 60 * 60 * 24 * 30
