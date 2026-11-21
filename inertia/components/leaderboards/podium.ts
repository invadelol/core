/**
 * One of a ladder's first three as its podium draws them, the same shape for the Solo/Duo ladder
 * and the pros' one.
 */
export interface PodiumPlayer {
  place: number
  name: string
  /** A player's "#tag"; null for a pro (their team says who they are). */
  tag: string | null
  /** A non-pro's Riot ID. */
  riot: boolean
  href: string
  pro: {
    slug: string
    photo?: string
    team: { id: string; name: string } | null
  } | null
  /** Whether a pro's photo is a cutout, which stands before their champion's art. */
  cutout: boolean
  icon: number | null
  tier: string | null
  lp: number | null
  role: string | null
  country?: string | null
  /** Their most played champions, with wins when the ladder knows them. */
  champions: { champion: number; games: number; wins?: number }[]
  /** What the champions and the record count ("in 30 days", "this season"). */
  span: string
  record: { wins: number; games: number; span: string } | null
  hot?: boolean
}

/** "st", "nd", "rd", "th" after a place. */
export const ord = (place: number) =>
  place % 100 >= 11 && place % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][place % 10] ?? 'th')
