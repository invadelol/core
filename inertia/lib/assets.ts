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

/** Riot's own 2D minimap for a map id: 11 is the Rift, 12 the Howling Abyss. */
export function mapImage(id: number) {
  return `${CDN}/map/${id || 11}.png`
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

/** The five trees, so a rune panel is labelled before the manifest lands. */
const STYLE_FALLBACK: Record<number, string> = {
  8000: 'Precision',
  8100: 'Domination',
  8200: 'Sorcery',
  8300: 'Inspiration',
  8400: 'Resolve',
}

export function runeName(id: number) {
  return runes[id] || styles[id] || STYLE_FALLBACK[id] || ''
}

let championsPromise: Promise<void> | null = null
let itemsPromise: Promise<void> | null = null

function loadNames(kind: string, into: Record<number, string>) {
  return fetch(`${CDN}/names/${kind}`)
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, string>>) : null))
    .then((json) => {
      if (!json) return
      for (const [id, name] of Object.entries(json)) into[Number(id)] = name
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
  return champions[id] || (id ? `Champion ${id}` : '')
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
  490: 'Quickplay',
  700: 'Clash',
  720: 'ARAM Clash',
  830: 'Co-op vs AI',
  840: 'Co-op vs AI',
  850: 'Co-op vs AI',
  900: 'ARURF',
  1020: 'One for All',
  1300: 'Nexus Blitz',
  1400: 'Ultimate Spellbook',
  1700: 'Arena',
  1900: 'URF',
}

export function queueName(id: number) {
  return QUEUE_NAMES[id] || 'Custom'
}

/** Whether a queue awards LP, which changes how a result should read. */
export function isRankedQueue(id: number) {
  return id === 420 || id === 440
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
