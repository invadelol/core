/**
 * The multi search (`/multisearch?summoners=…`): several Riot IDs read from whatever was pasted,
 * scouted side by side. Shared by the page and the server, which reads the address the same way.
 */

export interface RiotIdentity {
  gameName: string
  tagLine: string
}

/** Two teams' worth: a whole lobby fits, more than that is no longer a lobby. */
export const MAX_PLAYERS = 10

/**
 * Every Riot ID in a paste, in order and once each: a list split by commas or lines, an op.gg
 * address's `summoners`, or the lobby chat ("Name #TAG joined the lobby", in any language). A
 * name is 3–16 characters without `#` or `,`; a tag is 2–5 letters or digits.
 */
export function parseRiotIds(text: string): RiotIdentity[] {
  const found: RiotIdentity[] = []
  const seen = new Set<string>()
  const pattern = /([^\n\r,#]{2,16}?)\s*#\s*([\p{L}\p{N}]{2,5})(?![\p{L}\p{N}])/gu
  for (const line of text.split(/[\n\r,]+/)) {
    for (const match of line.matchAll(pattern)) {
      const gameName = match[1].trim().replace(/\s+/g, ' ')
      const tagLine = match[2].trim()
      if (gameName.length < 2) continue
      const key = `${gameName}#${tagLine}`.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      found.push({ gameName, tagLine })
      if (found.length >= MAX_PLAYERS) return found
    }
  }
  return found
}

/** `Name#TAG,Name 2#TAG2`, the `summoners` value op.gg uses too. */
export function joinRiotIds(players: RiotIdentity[]) {
  return players.map((p) => `${p.gameName}#${p.tagLine}`).join(',')
}

/** The page's address for these players, on `region` when one was picked (`euw`). */
export function multisearchPath(players: RiotIdentity[], region?: string | null) {
  const base = region ? `/multisearch/${region.toLowerCase()}` : '/multisearch'
  if (!players.length) return base
  return `${base}?${new URLSearchParams({ summoners: joinRiotIds(players) })}`
}

/** The regions a lobby can be on, as players say them; the server maps them to platforms. */
export const MULTISEARCH_REGIONS = [
  'euw',
  'eune',
  'na',
  'kr',
  'br',
  'lan',
  'las',
  'oce',
  'jp',
  'tr',
  'ru',
  'me',
  'sea',
  'tw',
  'vn',
] as const
