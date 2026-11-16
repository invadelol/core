/**
 * The last lobbies this browser scouted on the multisearch: who was in them, their icons and the
 * champion each plays most, and when. Kept on the device only, like the recent searches
 * (lib/recent.ts): nothing about who you scouted is sent anywhere.
 */
const KEY = 'invade-lobbies'
const LIMIT = 6

export interface LobbyPlayer {
  gameName: string
  tagLine: string
  /** The profile icon, once the player was found. */
  icon?: number | null
  /** The champion they play most this season, when known. */
  champion?: number | null
}

export interface Lobby {
  players: LobbyPlayer[]
  /** The server picked beside the field (`euw`), or null for any. */
  region: string | null
  at: number
}

const keyOf = (players: Pick<LobbyPlayer, 'gameName' | 'tagLine'>[]) =>
  players
    .map((p) => `${p.gameName}#${p.tagLine}`.toLowerCase())
    .sort()
    .join(',')

export function lastLobbies(): Lobby[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list)
      ? list.filter((l) => Array.isArray(l?.players) && l.players.length).slice(0, LIMIT)
      : []
  } catch {
    return []
  }
}

/** Keeps a lobby on top of the list (the same players scouted again move up, not twice). */
export function rememberLobby(players: LobbyPlayer[], region: string | null) {
  if (!players.length) return
  try {
    const key = keyOf(players)
    const next = [
      { players, region, at: Date.now() },
      ...lastLobbies().filter((l) => keyOf(l.players) !== key),
    ].slice(0, LIMIT)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode: the page works, it just doesn't remember */
  }
}

/** "Today, 22:41", "Yesterday, 21:58", "14 Nov, 19:12". */
export function lobbyTime(at: number, now = Date.now()) {
  const d = new Date(at)
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((day(new Date(now)) - day(d)) / 86_400_000)
  if (days === 0) return `Today, ${time}`
  if (days === 1) return `Yesterday, ${time}`
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`
}
