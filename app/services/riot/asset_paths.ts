import {
  ABILITY_KEYS,
  ASSET_IDS,
  ASSET_KINDS,
  CDRAGON,
  CDRAGON_CDN,
  DDRAGON,
  LATEST_CACHE_SECONDS,
  LATEST_STALE_SECONDS,
  MASTERY_CREST_MAX,
  PATCH,
  PINNED_CACHE_SECONDS,
  PINNED_PATCHES,
  PLACEHOLDER_CACHE_SECONDS,
  PLACEHOLDER_COLORS,
  type AssetKind,
} from '#constants/assets'

/**
 * Pure URL and label helpers for the asset proxy.
 *
 * Kept free of Adonis services so the resolution rules can be unit tested
 * without a database, a cache or a network. docs/cdn.md is the table of what
 * each kind resolves to.
 */

export interface ManifestEntry {
  /** Fully-qualified upstream URLs to try, best first. */
  sources: string[]
  name?: string
}

export type Manifest = Record<string, ManifestEntry>

/** Where one patch's files live upstream. */
export interface Release {
  /** Community Dragon's directory: `16.20`, or `latest`. */
  cdragon: string
  /** Data Dragon's version (`16.20.1`), when known: its versioned files need it. */
  ddragon: string | null
}

export const LATEST: Release = { cdragon: 'latest', ddragon: null }

/** One validated `/cdn` request. */
export interface AssetRequest {
  kind: AssetKind
  id: string
  /** The patch the URL pins, if any (`16.20`). */
  patch?: string
}

/**
 * Validates the path segments of a `/cdn` URL. Anything that isn't an allowed
 * kind with an id of that kind's exact shape is refused here, so the proxy
 * can only ever fetch the files this module knows how to name.
 */
export function parseAssetRequest(
  kind: unknown,
  rawId: unknown,
  patch?: unknown
): AssetRequest | null {
  if (!(ASSET_KINDS as readonly unknown[]).includes(kind)) return null
  if (patch !== undefined && !PATCH.test(String(patch))) return null
  // Ids arrive with a file extension so browsers and CDNs treat them as images.
  const id = String(rawId ?? '')
    .replace(/\.(png|jpe?g|svg|webp)$/i, '')
    .toLowerCase()
  if (!ASSET_IDS[kind as AssetKind].test(id)) return null
  return { kind: kind as AssetKind, id, ...(patch !== undefined && { patch: String(patch) }) }
}

/**
 * Data Dragon's version list (newest first) as the releases a URL may pin,
 * keyed by Community Dragon's `major.minor`. Old `lolpatch_*` entries and
 * anything past the pinning window are dropped.
 */
export function recentReleases(versions: unknown): Release[] {
  const releases: Release[] = []
  for (const version of Array.isArray(versions) ? versions : []) {
    const patch = /^(\d+\.\d+)\.\d+$/.exec(String(version))?.[1]
    if (!patch || releases.some((release) => release.cdragon === patch)) continue
    releases.push({ cdragon: patch, ddragon: String(version) })
    if (releases.length === PINNED_PATCHES) break
  }
  return releases
}

/**
 * Pinned URLs never change; unpinned ones follow the live patch; placeholders
 * stand in for an upstream hiccup and must give way quickly.
 */
export function cacheControl(asset: { placeholder: boolean; pinned: boolean }) {
  if (asset.placeholder) return `public, max-age=${PLACEHOLDER_CACHE_SECONDS}`
  if (asset.pinned) return `public, max-age=${PINNED_CACHE_SECONDS}, immutable`
  return `public, max-age=${LATEST_CACHE_SECONDS}, stale-while-revalidate=${LATEST_STALE_SECONDS}`
}

export const gameData = (release: Release) =>
  `${CDRAGON}/${release.cdragon}/plugins/rcp-be-lol-game-data/global/default`

const staticAssets = (release: Release) =>
  `${CDRAGON}/${release.cdragon}/plugins/rcp-fe-lol-static-assets/global/default`

/**
 * Community Dragon reports icons as `/lol-game-data/assets/<PATH>`. The
 * served URL is that path, lowercased, under the game-data root.
 */
export function gameDataUrl(iconPath: string, release: Release = LATEST) {
  const relative = iconPath
    .replace(/^\/+/, '')
    .replace(/^lol-game-data\/assets\//i, '')
    .toLowerCase()
  return `${gameData(release)}/${relative}`
}

/** Data Dragon serves rune art without a version, under the path Community Dragon reports. */
function ddragonPerk(iconPath: string) {
  const path = /perk-images\/.+$/i.exec(iconPath)?.[0]
  return path ? [`${DDRAGON}/cdn/img/${path}`] : []
}

/** Data Dragon's copy of a manifest entry, where it has one. */
function ddragonSources(kind: AssetKind, row: any, release: Release): string[] {
  const version = release.ddragon
  if (kind === 'champion' && version && row.alias) {
    return [`${DDRAGON}/cdn/${version}/img/champion/${row.alias}.png`]
  }
  if ((kind === 'perk' || kind === 'perkstyle') && row.iconPath) return ddragonPerk(row.iconPath)
  return []
}

/**
 * Conventional paths for an id the manifest doesn't list, which happens for
 * an asset added mid-patch or removed from the game but still in old matches.
 */
export function fallbackSources(kind: AssetKind, id: string, release: Release = LATEST): string[] {
  const root = gameData(release)
  const version = release.ddragon
  switch (kind) {
    case 'champion':
      return [`${root}/v1/champion-icons/${id}.png`]
    case 'item':
      return [
        `${root}/assets/items/icons2d/${id}.png`,
        ...(version ? [`${DDRAGON}/cdn/${version}/img/item/${id}.png`] : []),
      ]
    case 'profile-icon':
      return [
        `${root}/v1/profile-icons/${id}.jpg`,
        ...(version ? [`${DDRAGON}/cdn/${version}/img/profileicon/${id}.png`] : []),
        // 29 is the generic default portrait Riot ships for unknown icons.
        `${root}/v1/profile-icons/29.jpg`,
      ]
    case 'spell':
      return [`${root}/v1/summoner-spell-icons/${id}.png`]
    case 'perk':
    case 'perkstyle':
      return [`${root}/v1/perk-images/styles/${id}.png`, `${root}/v1/perk-images/${id}.png`]
    case 'splash':
    case 'centered':
    case 'loading':
    case 'ability':
      return championSources(kind, id, null)
    case 'rank':
      return rankSources(id, release)
    case 'emblem':
      return emblemSources(id, release)
    case 'map':
      return mapSources(id, release)
    case 'mastery':
      return masterySources(id, release)
    default:
      return []
  }
}

/**
 * The 2D minimap for a map id, e.g. 11 for Summoner's Rift and 12 for the
 * Howling Abyss.
 */
export function mapSources(id: string, release: Release = LATEST): string[] {
  const root = `${gameData(release)}/v1/map-assets/map${id}`
  return [
    ...(release.ddragon ? [`${DDRAGON}/cdn/${release.ddragon}/img/map/map${id}.png`] : []),
    `${root}/2dlevelminimap.png`,
    `${root}/2dlevelminimap.jpg`,
  ]
}

/** Ranked crests live outside the game-data plugin, so they resolve by tier. */
export function rankSources(tier: string, release: Release = LATEST): string[] {
  const root = `${staticAssets(release)}/images`
  return [`${root}/ranked-mini-crests/${tier}.svg`, `${root}/ranked-emblem/emblem-${tier}.png`]
}

/** A tier's full emblem: a 1280×720 frame with the crest in its middle (large crests). */
export function emblemSources(tier: string, release: Release = LATEST): string[] {
  return [`${staticAssets(release)}/images/ranked-emblem/emblem-${tier}.png`]
}

/**
 * A champion mastery crest by level (`0` to `10`; every level past ten wears the tenth). The
 * game's own crests (256×256) exist for 0 and 4 to 10; the client's shared copies (800×900, the
 * crest in the middle) cover 1 to 10 and stand behind them.
 */
export function masterySources(level: string, release: Release = LATEST): string[] {
  const n = Math.min(Number(level), MASTERY_CREST_MAX)
  const game = `${CDRAGON}/${release.cdragon}/game/assets/ux/mastery/legendarychampionmastery`
  const shared = `${CDRAGON}/${release.cdragon}/plugins/rcp-fe-lol-shared-components/global/default`
  return [
    ...(n === 0 || n >= 4 ? [`${game}/masterycrest_level${n}.png`] : []),
    ...(n >= 1 ? [`${shared}/mastery-${n}.png`] : []),
  ]
}

/** What one champion's own file (`v1/champions/<id>.json`) says about its art. */
export interface ChampionArt {
  /** Data Dragon's name for the champion (`MonkeyKing`). */
  alias?: string
  /** Icon paths as Community Dragon reports them. */
  splash?: string
  centered?: string
  loading?: string
  abilities: Partial<Record<(typeof ABILITY_KEYS)[number], string>>
}

/** The fields of a champion file the proxy needs, so only those are cached. */
export function parseChampion(raw: any): ChampionArt | null {
  if (!raw || typeof raw !== 'object') return null
  const skins: any[] = Array.isArray(raw.skins) ? raw.skins : []
  const base = skins.find((skin) => skin?.isBase) ?? skins[0]
  const abilities: ChampionArt['abilities'] = {}
  if (typeof raw.passive?.abilityIconPath === 'string') abilities.p = raw.passive.abilityIconPath
  for (const spell of Array.isArray(raw.spells) ? raw.spells : []) {
    const key = String(spell?.spellKey ?? '').toLowerCase() as (typeof ABILITY_KEYS)[number]
    if (ABILITY_KEYS.includes(key) && typeof spell.abilityIconPath === 'string') {
      abilities[key] = spell.abilityIconPath
    }
  }
  return {
    alias: typeof raw.alias === 'string' ? raw.alias : undefined,
    splash: base?.uncenteredSplashPath,
    centered: base?.splashPath,
    loading: base?.loadScreenPath,
    abilities,
  }
}

/** Data Dragon's and Community Dragon's CDN names for each piece of champion art. */
const ART = {
  splash: { ddragon: 'splash', cdn: 'splash-art' },
  centered: { ddragon: 'centered', cdn: 'splash-art/centered' },
  loading: { ddragon: 'loading', cdn: 'portrait' },
} as const

/**
 * Splash, centred splash, loading art and ability icons, from the champion's
 * own file, then the unversioned copies both CDNs keep. `id` is the champion
 * id, or `<champion id>-<p|q|w|e|r>` for an ability.
 */
export function championSources(
  kind: 'splash' | 'centered' | 'loading' | 'ability',
  id: string,
  art: ChampionArt | null,
  release: Release = LATEST
): string[] {
  if (kind === 'ability') {
    const [champion, key] = id.split('-') as [string, (typeof ABILITY_KEYS)[number]]
    const path = art?.abilities[key]
    return [
      ...(path ? [gameDataUrl(path, release)] : []),
      `${CDRAGON_CDN}/champion/${champion}/ability-icon/${key}`,
    ]
  }
  const path = art?.[kind]
  return [
    ...(path ? [gameDataUrl(path, release)] : []),
    ...(art?.alias ? [`${DDRAGON}/cdn/img/champion/${ART[kind].ddragon}/${art.alias}_0.jpg`] : []),
    `${CDRAGON_CDN}/champion/${id}/${ART[kind].cdn}`,
  ]
}

/** Turns one of Community Dragon's manifests into id to sources plus name. */
export function parseManifest(kind: AssetKind, raw: any, release: Release = LATEST): Manifest {
  // perkstyles nests its list; every other manifest is a bare array.
  const rows: any[] = Array.isArray(raw) ? raw : (raw?.styles ?? [])
  const manifest: Manifest = {}

  for (const row of rows) {
    const id = String(row?.id ?? '')
    // Champion id -1 is the "none" entry Riot ships in the summary.
    if (!id || id === '-1') continue

    const iconPath: string | undefined =
      row.squarePortraitPath ?? row.iconPath ?? row.augmentSmallIconPath
    const sources: string[] = []

    if (iconPath) sources.push(gameDataUrl(iconPath, release))
    sources.push(...ddragonSources(kind, row, release))
    // Always keep the conventional path as a last resort.
    for (const source of fallbackSources(kind, id, release)) {
      if (!sources.includes(source)) sources.push(source)
    }

    const name = row.name || row.nameTRA
    manifest[id] = { sources, name: typeof name === 'string' && name ? name : undefined }
  }

  if (kind === 'item') {
    // Existing ClickHouse item columns are UInt16. Recover only unambiguous
    // wrapped IDs from real manifest entries; never overwrite a real item.
    const aliases = new Map<string, ManifestEntry | null>()
    for (const [id, entry] of Object.entries(manifest)) {
      const numeric = Number(id)
      if (!Number.isInteger(numeric) || numeric <= 65535) continue
      const wrapped = String(numeric % 65536)
      if (wrapped === '0' || manifest[wrapped]) continue
      aliases.set(wrapped, aliases.has(wrapped) ? null : entry)
    }
    for (const [id, entry] of aliases) if (entry) manifest[id] = entry
  }
  return manifest
}

/** A short label for the placeholder tile. */
export function initials(value: string) {
  const text = String(value ?? '').trim()
  if (!text) return '?'

  // Numeric ids have no initials worth taking; show the tail instead.
  if (/^\d+$/.test(text)) return text.slice(-3)

  const words = text.split(/[\s'&.-]+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return text.slice(0, 2).toUpperCase()
}

function hash(value: string) {
  let result = 0
  for (let i = 0; i < value.length; i++) result = (result * 31 + value.charCodeAt(i)) >>> 0
  return result
}

function escapeXml(value: string) {
  return String(value).replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/**
 * A deterministic tile carrying the asset's initials. The same id always
 * draws the same tile, so a page that falls back looks intentional rather
 * than broken, and the slot keeps its shape.
 */
export function placeholderSvg(kind: AssetKind, id: string, label?: string) {
  // A crest that could not be fetched is its level alone, on nothing: it sits on any surface.
  if (kind === 'mastery') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="${escapeXml(id)}">
  <text x="32" y="33" fill="${PLACEHOLDER_COLORS[1][1]}" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="600" text-anchor="middle" dominant-baseline="middle">${escapeXml(id)}</text>
</svg>`
  }
  const text = initials(label || id)
  const [background, foreground] =
    PLACEHOLDER_COLORS[hash(`${kind}${id}`) % PLACEHOLDER_COLORS.length]

  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="${escapeXml(id)}">
  <rect width="64" height="64" fill="${background}"/>
  <text x="32" y="33" fill="${foreground}" font-family="system-ui, -apple-system, sans-serif" font-size="21" font-weight="600" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>
</svg>`
}

/**
 * The upstream's type when it says it is an image, else one guessed from the
 * URL: whatever upstream answers, the proxy only ever serves an image type.
 */
export function contentTypeOf(header: string | null | undefined, url: string) {
  const type = header?.split(';')[0].trim().toLowerCase()
  if (type?.startsWith('image/')) return type
  if (url.endsWith('.svg')) return 'image/svg+xml'
  if (url.endsWith('.jpg') || url.endsWith('.jpeg')) return 'image/jpeg'
  if (url.endsWith('.webp')) return 'image/webp'
  return 'image/png'
}
