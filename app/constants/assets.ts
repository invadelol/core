/**
 * Upstream hosts. Community Dragon mirrors every live patch under its own
 * directory (`/16.20/…`) and the current one under `/latest/`, so the proxy can
 * pin an asset to a patch; Data Dragon is the fallback for the few files it
 * serves without a version (champion art) or only with one (minimaps).
 */
export const CDRAGON = 'https://raw.communitydragon.org'
export const CDRAGON_CDN = 'https://cdn.communitydragon.org/latest'
export const DDRAGON = 'https://ddragon.leagueoflegends.com'

/**
 * The asset families the proxy serves, and the only ones: the kind is a path
 * segment, so anything outside this list is a 404, never an upstream fetch.
 * docs/cdn.md maps each to its upstream.
 */
export const ASSET_KINDS = [
  'champion',
  'splash',
  'centered',
  'loading',
  'ability',
  'item',
  'spell',
  'perk',
  'perkstyle',
  'profile-icon',
  'augment',
  'rank',
  'emblem',
  'map',
  'mastery',
] as const

export type AssetKind = (typeof ASSET_KINDS)[number]

export const TIERS = [
  'iron',
  'bronze',
  'silver',
  'gold',
  'platinum',
  'emerald',
  'diamond',
  'master',
  'grandmaster',
  'challenger',
] as const

/**
 * Champion mastery levels with their own crest. Levels go on past ten; every
 * level from ten up wears the level-ten crest, so a URL names at most this.
 */
export const MASTERY_CREST_MAX = 10

/** Ability slots, `p` being the passive. */
export const ABILITY_KEYS = ['p', 'q', 'w', 'e', 'r'] as const

const NUMERIC = /^\d{1,7}$/
const TIER = new RegExp(`^(${TIERS.join('|')}|unranked)$`)

/**
 * The exact id each kind accepts. Strict on purpose: an id ends up in an
 * upstream URL and a mirror key, so nothing but these shapes may reach either.
 */
export const ASSET_IDS: Record<AssetKind, RegExp> = {
  'champion': NUMERIC,
  'splash': NUMERIC,
  'centered': NUMERIC,
  'loading': NUMERIC,
  'ability': new RegExp(`^\\d{1,4}-[${ABILITY_KEYS.join('')}]$`),
  'item': NUMERIC,
  'spell': NUMERIC,
  'perk': NUMERIC,
  'perkstyle': NUMERIC,
  'profile-icon': NUMERIC,
  'augment': NUMERIC,
  'rank': TIER,
  'emblem': TIER,
  'map': NUMERIC,
  'mastery': /^(?:\d|10)$/,
}

/** A patch in a URL: `16.20`, Community Dragon's granularity. */
export const PATCH = /^\d{1,2}\.\d{1,2}$/

/**
 * How many recent patches may be pinned in a URL. Older ones (an app left
 * un-updated for months) are served the current art under a short cache,
 * which keeps the mirror bounded to this many copies of the game's art.
 */
export const PINNED_PATCHES = 6

/**
 * Community Dragon manifests, each mapping a numeric id to an icon path, under
 * a patch's game-data root. Resolving through these beats hand-building URLs:
 * the shape of the asset paths changes between patches, the manifests do not.
 */
export const MANIFESTS: Partial<Record<AssetKind, string>> = {
  'champion': 'v1/champion-summary.json',
  'item': 'v1/items.json',
  'spell': 'v1/summoner-spells.json',
  'perk': 'v1/perks.json',
  'perkstyle': 'v1/perkstyles.json',
  'profile-icon': 'v1/profile-icons.json',
  'augment': 'v1/cherry-augments.json',
}

/** How long a parsed manifest stays cached; a pinned patch's never changes. */
export const MANIFEST_TTL = '12h'

/** How often the list of live patches is read again, i.e. how soon a new patch is noticed. */
export const VERSIONS_TTL_MS = 60 * 60 * 1000

/** Bucket prefix for mirrored asset bytes: `riot-assets/<patch>/<kind>/<id>`. */
export const ASSET_PREFIX = 'riot-assets'

/** A URL with a patch in it never describes different bytes. */
export const PINNED_CACHE_SECONDS = 60 * 60 * 24 * 365

/**
 * A URL without a patch follows the live one, so it is fresh for a day and
 * then revalidated in the background (a 304, thanks to the ETag).
 */
export const LATEST_CACHE_SECONDS = 60 * 60 * 24
export const LATEST_STALE_SECONDS = 60 * 60 * 24 * 7

/**
 * A generated placeholder is cached briefly, by browsers and by any CDN in
 * front, so the moment upstream serves the real asset the page picks it up.
 */
export const PLACEHOLDER_CACHE_SECONDS = 60

/**
 * Id-to-name maps are derived from a manifest that changes once a patch, and
 * every profile page asks for two of them. An hour of browser caching, and of
 * holding the encoded bytes in the process, costs nothing in freshness.
 */
export const NAMES_CACHE_SECONDS = 60 * 60

/** The largest file the proxy will take from upstream (a full splash is ~1 MB). */
export const MAX_ASSET_BYTES = 8 * 1024 * 1024

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
