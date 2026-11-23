/**
 * What an Invade profile (`/u/<handle>`) receives from the services other parts of the site own:
 * the person's friends, clips and builds. Shared by the server and the pages, and by every branch
 * that fills one of these lists, so the shapes stay the same on both sides of the seam.
 */

/** A League account as a small card names it: its Riot ID and newest Solo/Duo rank. */
export interface CardAccount {
  /** The Riot API PUUID (78 characters), as on every other route of the site. */
  puuid: string
  gameName: string
  tagLine: string
  platform: string
  profileIconId: number | null
  tier: string | null
  division: string | null
}

/** A friend (both follow each other) as the profile's Friends tab and showcase draw them. */
export interface FriendCard {
  /** The friend's Invade account. */
  id: string
  name: string
  handle: string
  avatarUrl: string | null
  /** Their main League account, only when they show it on their profile. */
  main: CardAccount | null
  /** The champions of their latest games, newest first, at most three. */
  recentChampions: number[]
  /** In a game right now, from stored data (never a Riot call at request time). */
  live: {
    championId: number
    queueId: number
    /** When the game started, epoch ms: the page runs the clock. */
    startedAt: number
    /** The names of the profile's other friends in the same game. */
    with: string[]
  } | null
  /** Their latest stored game, when they are not in one. */
  lastGame: { championId: number; endedAt: string; win: boolean } | null
  /** This friend is the signed-in visitor. */
  isViewer: boolean
}

export type ClipCardVisibility = 'everyone' | 'link' | 'private'

/** A posted clip as the profile's Clips tab and showcases draw it. */
export interface ClipCard {
  id: string
  /** The clip's page, on this site. */
  url: string
  poster: string | null
  title: string
  championId: number
  matchId: string | null
  /** Where the clip starts in the game, milliseconds. */
  startMs: number
  durationMs: number
  /** What happened in it, from its events ("Solo kill on Lee Sin"); null without events. */
  moment: string | null
  visibility: ClipCardVisibility
  views: number
  comments: number
  gg: number
  /** ISO. */
  postedAt: string
}

export type ProfileBuildLane = 'top' | 'jungle' | 'mid' | 'bottom' | 'support'

/** A build the person made in the app or saved from someone else's link. */
export interface ProfileBuild {
  id: string
  /** The build's shared page, on this site. */
  url: string
  name: string
  championId: number
  lane: ProfileBuildLane
  /** The route a build card draws: the first starting set, boots, the core, each later slot's pick. */
  items: { start: number[]; boots: number | null; core: number[]; later: number[] }
  /** Max order of Q, W and E (`QEW`), `''` when the build leaves it open. */
  skillOrder: string
  shared: boolean
  opens: number
  imports: number
  /** ISO. */
  updatedAt: string
  /** Who made a build the person saved from a link; null for their own builds. */
  savedFrom: { name: string; handle: string | null } | null
}
