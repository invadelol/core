/**
 * The handful of profiles this browser has opened.
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

export function rememberPlayer(player: Omit<RecentPlayer, 'at'>) {
  if (!player.gameName || !player.tagLine) return
  try {
    const key = `${player.gameName}#${player.tagLine}`.toLowerCase()
    const next = [
      { ...player, at: Date.now() },
      ...recentPlayers().filter((p) => `${p.gameName}#${p.tagLine}`.toLowerCase() !== key),
    ].slice(0, LIMIT)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode: the app works, it just doesn't remember */
  }
}
