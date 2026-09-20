import { reactive } from 'vue'

/**
 * Every game asset is served by our own /cdn proxy, which resolves the id
 * against Community Dragon's manifests, mirrors the bytes, and always
 * answers with an image. Nothing here talks to Riot directly, and nothing
 * is pinned to a patch number that goes stale.
 */
const CDN = '/cdn'

/* ── Asset URLs ─────────────────────────────────────────────── */
export function profileIcon(id: number | null | undefined) {
  return `${CDN}/profile-icon/${id || 29}.png`
}

export function championSplash(id: number) {
  return `${CDN}/splash/${id}.jpg`
}

export function champIcon(id: number) {
  return `${CDN}/champion/${id}.png`
}

export function spellIcon(id: number) {
  return `${CDN}/spell/${id}.png`
}

export function itemIcon(id: number) {
  return `${CDN}/item/${id}.png`
}

export function runeIcon(id: number) {
  return `${CDN}/perk/${id}.png`
}

export function runeStyleIcon(id: number) {
  return `${CDN}/perkstyle/${id}.png`
}

export function rankCrest(tier: string) {
  return `${CDN}/rank/${tier.toLowerCase()}.png`
}

/* ── Display names ──────────────────────────────────────────── */
const champions = reactive<Record<number, string>>({})
const items = reactive<Record<number, string>>({})
const runes = reactive<Record<number, string>>({})
const styles = reactive<Record<number, string>>({})
let runePromise: Promise<unknown> | null = null
export function loadRunes() {
  return (runePromise ||= Promise.all([loadNames('perk', runes), loadNames('perkstyle', styles)]))
}
export function runeName(id: number) {
  return runes[id] || styles[id] || `Rune ${id}`
}

let championsPromise: Promise<void> | null = null
let itemsPromise: Promise<void> | null = null

function loadNames(kind: string, into: Record<number, string>) {
  return fetch(`${CDN}/names/${kind}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      if (!json) return
      for (const [id, name] of Object.entries<string>(json)) into[Number(id)] = name
    })
    .catch(() => {})
}

/** Numeric champion id to display name, e.g. 266 to "Aatrox". */
export function loadChampions() {
  championsPromise ||= loadNames('champion', champions)
  return championsPromise
}

/** Numeric item id to display name, used for hover titles. */
export function loadItems() {
  itemsPromise ||= loadNames('item', items)
  return itemsPromise
}

export function championName(id: number) {
  return champions[id] || `Champion ${id}`
}

export function itemName(id: number) {
  return items[id] || `Item ${id}`
}

/* ── Labels ─────────────────────────────────────────────────── */
export const QUEUE_NAMES: Record<number, string> = {
  400: 'Normal Draft',
  420: 'Ranked Solo',
  430: 'Normal Blind',
  440: 'Ranked Flex',
  450: 'ARAM',
  700: 'Clash',
  900: 'URF',
  1700: 'Arena',
}

export function queueName(id: number) {
  return QUEUE_NAMES[id] || 'Custom'
}

export const POSITION_NAMES: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'Bot',
  UTILITY: 'Support',
}

export const POSITION_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']

export const TIER_NAMES: Record<string, string> = {
  IRON: 'Iron',
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
  EMERALD: 'Emerald',
  DIAMOND: 'Diamond',
  MASTER: 'Master',
  GRANDMASTER: 'Grandmaster',
  CHALLENGER: 'Challenger',
}

export const QUEUE_LABELS: Record<string, string> = {
  RANKED_SOLO_5x5: 'Solo/Duo',
  RANKED_FLEX_SR: 'Flex',
}
