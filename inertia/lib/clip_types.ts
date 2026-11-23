/**
 * Clips as the site's pages and the desktop app receive them (docs/desktop-sync.md §11, §12).
 * Shared by the server and the pages.
 */

export type ClipVisibility = 'everyone' | 'link' | 'private'
export type ClipCommentRule = 'everyone' | 'game' | 'off'

export const CLIP_EVENT_KINDS = [
  'kill',
  'death',
  'assist',
  'multikill',
  'objective',
  'first_blood',
  'ace',
] as const
export type ClipEventKind = (typeof CLIP_EVENT_KINDS)[number]

/**
 * Something that happened in the clip's window, at its game time. Players are kept as their
 * champions only: a clip never names anyone else's Riot ID.
 */
export interface ClipEvent {
  /** Game time, ms. */
  t: number
  kind: ClipEventKind
  killer: number | null
  victim: number | null
  assisters: number[]
  /** The objective, or the multikill's size ("Baron", "3"). */
  detail: string | null
}

/** One source of damage in a kill's recap: an ability, attacks, a summoner spell. */
export interface DamageLine {
  /** `q`, `w`, `e`, `r`, `p` (passive), `attack`, or `other` (items, summoner spells). */
  source: string
  /** Its name: "Mystic Shot", "Attacks". */
  name: string
  /** How many hits landed. */
  hits: number
  damage: number
}

/** A kill in the clip from Riot's match timeline: who, when, and the damage both ways. */
export interface KillRecap {
  /** Game time, ms. */
  t: number
  killer: number
  victim: number
  bounty: number
  /** Damage the killer's side dealt to the victim, and the victim dealt back. */
  dealt: DamageLine[]
  taken: DamageLine[]
}

/** A clip's author as the page shows them. */
export interface ClipAuthor {
  /** Their Invade account. */
  id: string
  name: string
  handle: string
  avatarUrl: string | null
  /** The League account that played it, when its owner shows it on their profile. */
  account: { gameName: string; tagLine: string; profileIconId: number | null } | null
}

/** A posted clip, as its page and the lists draw it. */
export interface Clip {
  id: string
  /** Its page on this site. */
  url: string
  /** The video and its picture. */
  video: string
  poster: string | null
  matchId: string
  platform: string
  championId: number
  /** Where it starts in the game, ms. */
  startMs: number
  durationMs: number
  title: string
  /** What happened, in a few words ("Solo kill on Lee Sin"), or null without events. */
  moment: string | null
  visibility: ClipVisibility
  comments: ClipCommentRule
  events: ClipEvent[]
  recap: KillRecap[]
  views: number
  commentCount: number
  gg: number
  /** The signed-in visitor gave it a GG. */
  ggByViewer: boolean
  /** ISO. */
  postedAt: string
  author: ClipAuthor
  /** Posted by the signed-in visitor. */
  mine: boolean
  pinned: boolean
}

/** A comment and, for a top-level one, its replies (one level). */
export interface ClipComment {
  id: string
  body: string
  /** The clip's moment it names (ms from the clip's start), when it names one. */
  atMs: number | null
  /** ISO. */
  createdAt: string
  author: { name: string; handle: string; avatarUrl: string | null }
  /** The champion the commenter played in this game. */
  championId: number | null
  /** Written by the clip's author. */
  byAuthor: boolean
  mine: boolean
  gg: number
  ggByViewer: boolean
  replies: ClipComment[]
}

/** A clip of the person as the app lists them (`GET /api/desktop/clips`). */
export interface MyClip {
  id: string
  url: string
  matchId: string
  title: string
  championId: number
  startMs: number
  durationMs: number
  visibility: ClipVisibility
  comments: ClipCommentRule
  status: 'uploading' | 'ready'
  views: number
  commentCount: number
  gg: number
  /** ISO. */
  postedAt: string
}

/** Something that happened around the person's clips and account (`GET /api/desktop/notifications`). */
export interface ClipNotification {
  id: string
  kind: 'comment' | 'reply' | 'gg' | 'follow'
  /** ISO. */
  at: string
  actor: {
    name: string
    handle: string
    avatarUrl: string | null
    /** The champion they played in the clip's game. */
    championId: number | null
    /** They played in the clip's game. */
    inGame: boolean
  }
  clip: { id: string; title: string; url: string } | null
  text: string | null
}
