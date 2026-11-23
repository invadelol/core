import type { SkinCard, SkinRarity } from './skin_types.js'

/**
 * Skins on the site's pages: their art through `/cdn` (the poster is the loading art, the hero the
 * splash), Riot's rarity gems and names, addresses, and stars written as words.
 */

type Art = Pick<SkinCard, 'championId' | 'num'>

export const posterUrl = (skin: Art) => `/cdn/loading/${skin.championId}-${skin.num}.jpg`
export const splashUrl = (skin: Art) => `/cdn/splash/${skin.championId}-${skin.num}.jpg`

export const RARITY_NAMES: Record<SkinRarity, string> = {
  standard: 'Standard',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
  ultimate: 'Ultimate',
  transcendent: 'Transcendent',
  exalted: 'Exalted',
}

/** Riot's gem for a rarity that has one (`/cdn/gem/<rarity>`); standard and rare have none. */
const GEMS: ReadonlySet<SkinRarity> = new Set([
  'epic',
  'legendary',
  'mythic',
  'ultimate',
  'transcendent',
  'exalted',
])
export const gemUrl = (rarity: SkinRarity) => (GEMS.has(rarity) ? `/cdn/gem/${rarity}.png` : null)

export const skinPath = (id: number) => `/skins/${id}`
export const listPath = (id: string) => `/skins/lists/${id}`

/** Half stars as words: 7 → "3.5 stars", 2 → "1 star". */
export function starsWords(halves: number) {
  const stars = halves / 2
  return `${stars} ${stars === 1 ? 'star' : 'stars'}`
}

/** A count for a small label: 1,204 → "1.2k", 52,400 → "52.4k", under a thousand as it is. */
export function shortCount(n: number) {
  if (n < 1000) return String(n)
  const k = n / 1000
  return `${k >= 100 ? Math.round(k) : Math.round(k * 10) / 10}k`
}

/** 1 → "1st", 22 → "22nd", 13 → "13th". */
export function ordinal(n: number) {
  const tens = n % 100
  const suffix =
    tens >= 11 && tens <= 13
      ? 'th'
      : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th')
  return `${n}${suffix}`
}
