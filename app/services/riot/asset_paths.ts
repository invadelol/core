import {
  CDRAGON_GAME_DATA,
  CDRAGON_STATIC_ASSETS,
  DDRAGON,
  PLACEHOLDER_COLORS,
  type AssetKind,
} from '#constants/assets'

/**
 * Pure URL and label helpers for the asset proxy.
 *
 * Kept free of Adonis services so the resolution rules can be unit tested
 * without a database, a cache or a network.
 */

export interface ManifestEntry {
  /** Fully-qualified upstream URLs to try, best first. */
  sources: string[]
  name?: string
}

export type Manifest = Record<string, ManifestEntry>

/**
 * Community Dragon reports icons as `/lol-game-data/assets/<PATH>`. The
 * served URL is that path, lowercased, under the game-data root.
 */
export function gameDataUrl(iconPath: string) {
  const relative = iconPath
    .replace(/^\/+/, '')
    .replace(/^lol-game-data\/assets\//i, '')
    .toLowerCase()
  return `${CDRAGON_GAME_DATA}/${relative}`
}

/**
 * Conventional paths for an id the manifest doesn't list, which happens for
 * an asset added mid-patch or removed from the game but still in old matches.
 */
export function fallbackSources(kind: AssetKind, id: string): string[] {
  switch (kind) {
    case 'splash':
      return [`https://cdn.communitydragon.org/latest/champion/${id}/splash-art`]
    case 'champion':
      return [`${CDRAGON_GAME_DATA}/v1/champion-icons/${id}.png`]
    case 'item':
      return [
        `${CDRAGON_GAME_DATA}/assets/items/icons2d/${id}.png`,
        `${DDRAGON}/cdn/img/item/${id}.png`,
      ]
    case 'profile-icon':
      return [
        `${CDRAGON_GAME_DATA}/v1/profile-icons/${id}.jpg`,
        // 29 is the generic default portrait Riot ships for unknown icons.
        `${CDRAGON_GAME_DATA}/v1/profile-icons/29.jpg`,
      ]
    case 'spell':
      return [`${CDRAGON_GAME_DATA}/v1/summoner-spell-icons/${id}.png`]
    case 'perk':
    case 'perkstyle':
      return [
        `${CDRAGON_GAME_DATA}/v1/perk-images/styles/${id}.png`,
        `${CDRAGON_GAME_DATA}/v1/perk-images/${id}.png`,
      ]
    case 'rank':
      return rankSources(id)
    default:
      return []
  }
}

/** Ranked crests live outside the game-data plugin, so they resolve by tier. */
export function rankSources(id: string): string[] {
  const tier = id.toLowerCase().replace(/[^a-z]/g, '')
  return [
    `${CDRAGON_STATIC_ASSETS}/images/ranked-mini-crests/${tier}.svg`,
    `${CDRAGON_STATIC_ASSETS}/images/ranked-emblem/emblem-${tier}.png`,
  ]
}

/** Data Dragon equivalents, tried after Community Dragon's own path. */
export function legacySources(kind: AssetKind, row: any): string[] {
  if (kind === 'champion') {
    return [`${CDRAGON_GAME_DATA}/v1/champion-icons/${row.id}.png`]
  }
  if (kind === 'item') {
    return [`${DDRAGON}/cdn/img/item/${row.id}.png`]
  }
  return []
}

/** Turns one of Community Dragon's manifests into id to sources plus name. */
export function parseManifest(kind: AssetKind, raw: any): Manifest {
  // perkstyles nests its list; every other manifest is a bare array.
  const rows: any[] = Array.isArray(raw) ? raw : (raw?.styles ?? [])
  const manifest: Manifest = {}

  for (const row of rows) {
    const id = String(row?.id ?? '')
    // Champion id -1 is the "none" entry Riot ships in the summary.
    if (!id || id === '-1') continue

    const iconPath: string | undefined = row.squarePortraitPath ?? row.iconPath
    const sources: string[] = []

    if (iconPath) sources.push(gameDataUrl(iconPath))
    sources.push(...legacySources(kind, row))
    // Always keep the conventional path as a last resort.
    for (const source of fallbackSources(kind, id)) {
      if (!sources.includes(source)) sources.push(source)
    }

    manifest[id] = {
      sources,
      name: typeof row.name === 'string' && row.name ? row.name : undefined,
    }
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
  const text = initials(label || id)
  const [background, foreground] =
    PLACEHOLDER_COLORS[hash(`${kind}${id}`) % PLACEHOLDER_COLORS.length]

  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="${escapeXml(id)}">
  <rect width="64" height="64" fill="${background}"/>
  <text x="32" y="33" fill="${foreground}" font-family="system-ui, -apple-system, sans-serif" font-size="21" font-weight="600" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>
</svg>`
}

export function guessContentType(pathOrUrl: string) {
  if (pathOrUrl.endsWith('.svg')) return 'image/svg+xml'
  if (pathOrUrl.endsWith('.jpg') || pathOrUrl.endsWith('.jpeg')) return 'image/jpeg'
  if (pathOrUrl.endsWith('.webp')) return 'image/webp'
  return 'image/png'
}
