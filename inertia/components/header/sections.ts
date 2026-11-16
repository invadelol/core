/**
 * Positions and champion addresses as the home and the champion lists write them. The header's
 * own map of the site is lib/site_nav.ts.
 */

/** The tier list of each role. */
export const ROLE_LINKS = [
  { href: '/tier-list?role=top', label: 'Top', lane: 'TOP' },
  { href: '/tier-list?role=jungle', label: 'Jungle', lane: 'JUNGLE' },
  { href: '/tier-list?role=mid', label: 'Mid', lane: 'MID' },
  { href: '/tier-list?role=bot', label: 'Bot', lane: 'ADC' },
  { href: '/tier-list?role=support', label: 'Support', lane: 'SUPPORT' },
] as const

/** Riot's position (as the server sends it) to the shared role icons' lane and the site's words. */
export const POSITION = {
  TOP: { lane: 'TOP', label: 'Top', slug: 'top' },
  JUNGLE: { lane: 'JUNGLE', label: 'Jungle', slug: 'jungle' },
  MIDDLE: { lane: 'MID', label: 'Mid', slug: 'mid' },
  BOTTOM: { lane: 'ADC', label: 'Bot', slug: 'bot' },
  UTILITY: { lane: 'SUPPORT', label: 'Support', slug: 'support' },
} as const

export const positionOf = (p: string) => POSITION[p as keyof typeof POSITION] ?? POSITION.MIDDLE

/** A champion's page in one role. */
export const championHref = (slug: string, position: string) =>
  `/champions/${slug}?role=${positionOf(position).slug}`

export const TIER_LABELS = ['S+', 'S', 'A', 'B', 'C', 'D'] as const
