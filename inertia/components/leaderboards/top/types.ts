/**
 * One player at the head of a ladder, the same shape for the Solo/Duo ladder and the pros' one,
 * so the head's readings (the podium, the race, each role's first three) draw both.
 */
export interface TopPlayer {
  place: number
  name: string
  /** "#EUW" for a player, the team's name for a pro. */
  tag: string | null
  /** A non-pro's Riot ID: screenshots mask it. */
  riot: boolean
  href: string
  pro: {
    slug: string
    photo?: string
    team: { id: string; slug?: string; name: string } | null
  } | null
  icon: number | null
  tier: string | null
  lp: number | null
  role: string | null
  country?: string | null
  champions: { champion: number; games: number; wins?: number }[]
  /** Their record and what it counts ("season", "30 days"). */
  record: { wins: number; games: number; span: string } | null
  hot?: boolean
}

/** "st", "nd", "rd", "th" after a place. */
export const ord = (place: number) =>
  place % 100 >= 11 && place % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][place % 10] ?? 'th')
