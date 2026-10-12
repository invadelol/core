import { reactive } from 'vue'
import type { AssetKind, NameKind } from '@invadelol/ui'

/**
 * Every game asset is served by our own /cdn proxy, which resolves the id
 * against Community Dragon's manifests, mirrors the bytes, and always
 * answers with an image. Nothing here talks to Riot directly, and nothing
 * is pinned to a patch number that goes stale.
 */
const PATHS: Record<AssetKind, string> = {
  champion: 'champion',
  splash: 'splash',
  item: 'item',
  spell: 'spell',
  rune: 'perk',
  runeStyle: 'perkstyle',
  profileIcon: 'profile-icon',
  rank: 'emblem',
}

/** The URL of a game asset, for the shared views and the site's own. */
export function assetUrl(kind: AssetKind, id: number | string) {
  const key = kind === 'rank' ? String(id).toLowerCase() : kind === 'profileIcon' ? id || 29 : id
  return `/cdn/${PATHS[kind]}/${key}.${kind === 'splash' ? 'jpg' : 'png'}`
}

export const profileIcon = (id: number | null | undefined) => assetUrl('profileIcon', id ?? 0)
export const championSplash = (id: number) => assetUrl('splash', id)
export const champIcon = (id: number) => assetUrl('champion', id)

/* ── Display names ──────────────────────────────────────────── */

/**
 * Names arrive per kind from /cdn/names, the first time something asks for
 * one: a page that never shows an item never downloads the item map. The
 * maps are reactive, so whatever asked re-renders once they land.
 */
const names = {
  champion: reactive<Record<number, string>>({}),
  item: reactive<Record<number, string>>({}),
  spell: reactive<Record<number, string>>({}),
  rune: reactive<Record<number, string>>({}),
  runeStyle: reactive<Record<number, string>>({}),
} satisfies Record<NameKind, Record<number, string>>
const requested = new Set<NameKind>()

function load(kind: NameKind) {
  if (requested.has(kind) || typeof window === 'undefined') return
  requested.add(kind)
  fetch(`/cdn/names/${PATHS[kind]}`)
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, string>>) : null))
    .then((json) => {
      if (json) for (const [id, name] of Object.entries(json)) names[kind][Number(id)] = name
      else requested.delete(kind)
    })
    .catch(() => requested.delete(kind))
}

/** A champion, item, spell or rune name; undefined until its map has loaded. */
export function nameOf(kind: NameKind, id: number): string | undefined {
  load(kind)
  return names[kind][id]
}

/** Numeric champion id to display name, e.g. 266 to "Aatrox". */
export function championName(id: number) {
  return nameOf('champion', id) || (id ? `Champion ${id}` : '')
}

/* ── Labels ─────────────────────────────────────────────────── */

/** Riot's platform ids as players say them: "EUW1" → "EUW". */
const REGION_LABELS: Record<string, string> = {
  EUW1: 'EUW',
  EUN1: 'EUNE',
  NA1: 'NA',
  BR1: 'BR',
  LA1: 'LAN',
  LA2: 'LAS',
  OC1: 'OCE',
  JP1: 'JP',
  KR: 'KR',
  TR1: 'TR',
  ME1: 'ME',
  RU: 'RU',
  SG2: 'SEA',
  TW2: 'TW',
  VN2: 'VN',
}

export function regionLabel(platform: string | null | undefined) {
  if (!platform) return ''
  const key = platform.toUpperCase()
  return REGION_LABELS[key] ?? key.replace(/\d+$/, '')
}
