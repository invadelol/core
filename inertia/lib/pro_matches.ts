/**
 * Pro matches as the pages get them (`pro_match_service.ts`), and how their times read. A time is
 * rendered in UTC on the server and in the visitor's time zone once the page is mounted: the
 * first client render must match the server's, so components switch after `onMounted`.
 */

export type MatchStatus = 'not_started' | 'running' | 'finished' | 'canceled' | 'postponed'

export interface MatchTeam {
  id: string | null
  slug: string | null
  name: string
  code: string | null
  score: number | null
}

export interface ProMatch {
  id: number
  league: { slug: string; code: string; name: string } | null
  tournament: string | null
  name: string | null
  /** ISO, UTC. */
  at: string
  status: MatchStatus
  bestOf: number | null
  teams: [MatchTeam, MatchTeam]
  winner: 1 | 2 | null
  stream: string | null
}

/** Running now. The server leaves out a match still "running" long after its start. */
export const isLive = (m: ProMatch) => m.status === 'running'

/** A list of matches from a prop, without the malformed ones. */
export function matchList(v: unknown): ProMatch[] {
  return Array.isArray(v)
    ? v.filter(
        (m): m is ProMatch =>
          Boolean(m) &&
          typeof m.at === 'string' &&
          Array.isArray(m.teams) &&
          m.teams.length === 2 &&
          m.teams.every(Boolean)
      )
    : []
}

export const matchOrNull = (v: unknown): ProMatch | null => matchList([v])[0] ?? null

/** A team's short label: its code, else its name; "TBD" while the bracket has no team there. */
export const teamLabel = (t: MatchTeam) => t.code || t.name || 'TBD'

/** A team's full name, else its code, else "TBD". */
export const teamName = (t: MatchTeam) => t.name || t.code || 'TBD'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')

/** The server's (and first client render's) time: "5 Nov, 14:00 UTC". */
export function utcTime(iso: string) {
  const d = new Date(iso)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/**
 * The visitor's time, after mount: "Today, 15:00", "Tomorrow, 09:00", "Thu 5 Nov, 11:00", in
 * their clock's format.
 */
export function localTime(iso: string, now = Date.now()) {
  const d = new Date(iso)
  const today = new Date(now)
  const tomorrow = new Date(now + 86_400_000)
  const yesterday = new Date(now - 86_400_000)
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const day =
    dayKey(d) === dayKey(today)
      ? 'Today'
      : dayKey(d) === dayKey(tomorrow)
        ? 'Tomorrow'
        : dayKey(d) === dayKey(yesterday)
          ? 'Yesterday'
          : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${day}, ${time}`
}

/** "Bo3" (best of 3), or null. */
export const bestOfText = (m: ProMatch) => (m.bestOf ? `Bo${m.bestOf}` : null)

/** What the status corner says when it is not a time: live, postponed, canceled. */
export function statusText(m: ProMatch) {
  if (isLive(m)) return 'Live'
  if (m.status === 'postponed') return 'Postponed'
  if (m.status === 'canceled') return 'Canceled'
  return null
}
