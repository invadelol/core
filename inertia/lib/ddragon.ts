import { reactive } from 'vue'

export const PATCH = '14.24.1'
export const DDRAGON = `https://ddragon.leagueoflegends.com/cdn/${PATCH}`
export const CDRAGON =
  'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1'

/* ── Asset URLs ─────────────────────────────────────────────── */
export function profileIcon(id: number | null | undefined) {
  return `${DDRAGON}/img/profileicon/${id || 1}.png`
}

export function champIcon(id: number) {
  return `${CDRAGON}/champion-icons/${id}.png`
}

export function spellIcon(id: number) {
  return `${CDRAGON}/summoner-spell-icons/${id}.png`
}

export function itemIcon(id: number) {
  return `${DDRAGON}/img/item/${id}.png`
}

export function rankCrest(tier: string) {
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/${tier.toLowerCase()}.svg`
}

/* ── Static data, fetched once per page load ────────────────── */
const champions = reactive<Record<number, string>>({})
const items = reactive<Record<number, string>>({})
const runes = reactive<Record<number, string>>({})

let championsPromise: Promise<void> | null = null
let itemsPromise: Promise<void> | null = null
let runesPromise: Promise<void> | null = null

/** Numeric champion id → display name, e.g. 266 → "Aatrox". */
export function loadChampions() {
  if (!championsPromise) {
    championsPromise = fetch(`${DDRAGON}/data/en_US/champion.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json?.data) return
        for (const entry of Object.values<any>(json.data)) {
          champions[Number(entry.key)] = entry.name
        }
      })
      .catch(() => {})
  }
  return championsPromise
}

/** Numeric item id → display name, used for hover titles. */
export function loadItems() {
  if (!itemsPromise) {
    itemsPromise = fetch(`${DDRAGON}/data/en_US/item.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json?.data) return
        for (const [id, entry] of Object.entries<any>(json.data)) {
          items[Number(id)] = entry.name
        }
      })
      .catch(() => {})
  }
  return itemsPromise
}

/** Rune + rune-style id → icon path, needed to render keystones. */
export function loadRunes() {
  if (!runesPromise) {
    runesPromise = fetch(`${DDRAGON}/data/en_US/runesReforged.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((styles) => {
        if (!Array.isArray(styles)) return
        for (const style of styles) {
          runes[style.id] = style.icon
          for (const slot of style.slots ?? []) {
            for (const rune of slot.runes ?? []) {
              runes[rune.id] = rune.icon
            }
          }
        }
      })
      .catch(() => {})
  }
  return runesPromise
}

export function championName(id: number) {
  return champions[id] || `Champion ${id}`
}

export function itemName(id: number) {
  return items[id] || `Item ${id}`
}

export function runeIcon(id: number) {
  const path = runes[id]
  return path ? `https://ddragon.leagueoflegends.com/cdn/img/${path}` : `${CDRAGON}/perks/${id}.png`
}

export function runeStyleIcon(id: number) {
  const path = runes[id]
  return path
    ? `https://ddragon.leagueoflegends.com/cdn/img/${path}`
    : `${CDRAGON}/perkstyles/${id}.png`
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
