import type { ProMatch } from './pro_matches.js'

/**
 * What the esports overview and the teams page receive beyond the matches
 * (`app/services/esports_landing_service.ts`), and how their days and names read.
 */

export interface ProFace {
  slug: string
  name: string
  photo?: string
  role: string | null
  country: string | null
}

export interface TeamTag {
  id: string
  slug: string
  name: string
  shortName: string | null
}

/** The last international event's champion, while its final is stored. */
export interface LastEvent {
  league: { slug: string; code: string; name: string; region: string | null } | null
  year: number | null
  final: ProMatch
  champion: { id: string; slug: string; name: string; code: string | null }
  /** Their five starters on the day of the final. */
  lineup: ProFace[]
}

export interface RosterMove {
  at: string
  kind: 'joined' | 'left'
  team: TeamTag
  /** Joined: where they came from. Left: where they play now. */
  other: TeamTag | null
  players: ProFace[]
}

/** A pro who won LP in the last 24 hours. */
export interface Climber {
  pro: { slug: string; name: string; photo?: string; team: TeamTag | null }
  lp: number
  gained: number
}

/** A pro in the line-up of portraits (`ProLineup.vue`). */
export interface LineupCard {
  slug: string
  name: string
  photo?: string
  team: { id: string; name: string } | null
  tier: string
  lp: number
  /** The crest in the photo's corner. */
  league: { slug: string; code: string } | null
}

export interface TeamStarter {
  slug: string
  name: string
  photo?: string
  role: string
  /** Joined in the last weeks. */
  fresh: boolean
}

export interface TeamBoard {
  id: string
  slug: string
  name: string
  country: string | null
  lp: number | null
  /** Starters in Master and above. */
  apex: number
  five: TeamStarter[]
}

export interface LeagueBoard {
  league: { slug: string; code: string; name: string; region: string | null }
  teams: TeamBoard[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "14 Nov", in UTC (the same on the server and in the browser). */
export function dayMonth(iso: string) {
  const d = new Date(iso)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

/** A move's names: "Badlulu", "Badlulu and Manaty", "Badlulu, Manaty and 4 more". */
export function names(players: { name: string }[]) {
  if (players.length <= 2) return players.map((p) => p.name).join(' and ')
  if (players.length === 3) return `${players[0].name}, ${players[1].name} and ${players[2].name}`
  return `${players[0].name}, ${players[1].name} and ${players.length - 2} more`
}

const ROLE_ORDER = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'] as const

/** A team's five places by role, each with its starter or null. */
export const slots = (t: Pick<TeamBoard, 'five'>) =>
  ROLE_ORDER.map((role) => ({ role, p: t.five.find((x) => x.role === role) ?? null }))
