import { profilePath } from './format.js'

/**
 * The handful of profiles and pro pages this browser has opened.
 *
 * Kept entirely on the device: nothing about who you looked up is sent
 * anywhere. It exists so the landing page has something useful on it for a
 * returning visitor instead of an empty field.
 */
const KEY = 'invade-recent'
const LIMIT = 8

export interface RecentPlayer {
  gameName: string
  tagLine: string
  profileIconId: number | null
  /** What the profile showed when it was last opened; older entries lack them. */
  platform?: string
  level?: number | null
  /** Solo/Duo rank as last seen, when the player had one. */
  rank?: { tier: string; division: string; leaguePoints: number } | null
  /**
   * A pro's page rather than a Riot ID: `gameName` is their name, `tagLine` is empty, and the
   * entry opens `/pro/:slug` with their photo (its version, when they have one).
   */
  pro?: { slug: string; photo?: string | null; staff?: boolean }
  at: number
}

export function recentPlayers(): RecentPlayer[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list.slice(0, LIMIT) : []
  } catch {
    return []
  }
}

function keyOf(player: Pick<RecentPlayer, 'gameName' | 'tagLine' | 'pro'>) {
  if (player.pro) return `pro:${player.pro.slug}`
  return `${player.gameName}#${player.tagLine}`.toLowerCase()
}

/** Where an entry leads: the pro's page, or the player's profile. */
export function recentHref(player: RecentPlayer) {
  return player.pro
    ? `/pro/${encodeURIComponent(player.pro.slug)}`
    : profilePath(player.gameName, player.tagLine)
}

export function rememberPlayer(player: Omit<RecentPlayer, 'at' | 'pro'>) {
  if (!player.gameName || !player.tagLine) return
  remember(player)
}

/** A pro's page, listed beside the players with their name and photo. */
export function rememberPro(pro: {
  slug: string
  name: string
  photo?: string | null
  staff?: boolean
}) {
  if (!pro.slug || !pro.name) return
  remember({
    gameName: pro.name,
    tagLine: '',
    profileIconId: null,
    pro: { slug: pro.slug, photo: pro.photo ?? null, staff: pro.staff || undefined },
  })
}

function remember(player: Omit<RecentPlayer, 'at'>) {
  try {
    const key = keyOf(player)
    const previous = recentPlayers().find((p) => keyOf(p) === key)
    const next = [
      { ...previous, ...player, at: Date.now() },
      ...recentPlayers().filter((p) => keyOf(p) !== key),
    ].slice(0, LIMIT)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode: the app works, it just doesn't remember */
  }
}

/** Adds what arrived after the profile (its rank) to an entry already remembered. */
export function updateRecent(
  player: Pick<RecentPlayer, 'gameName' | 'tagLine'>,
  patch: Partial<Omit<RecentPlayer, 'gameName' | 'tagLine' | 'at'>>
) {
  try {
    const key = keyOf(player)
    const list = recentPlayers()
    const entry = list.find((p) => keyOf(p) === key)
    if (!entry) return
    Object.assign(entry, patch)
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* nothing to update */
  }
}

export function forgetRecent() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to forget */
  }
}
