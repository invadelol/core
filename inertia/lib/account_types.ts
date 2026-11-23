/**
 * An Invade account as the site and the desktop app receive it (`GET /api/account`,
 * `GET /api/desktop/account`, docs/desktop-sync.md §10), and the changes both send. Shared by
 * the server and the pages.
 */

export type AccountProvider = 'discord'

/** A League account as an account lists it. */
export interface AccountProfile {
  /** The Riot API PUUID (78 characters), as on every other route of the site. */
  puuid: string
  gameName: string
  tagLine: string
  platform: string
  profileIconId: number | null
  /** The newest Solo/Duo rank stored, when there is one. */
  tier: string | null
  division: string | null
  lp: number | null
}

export interface OwnedAccount extends AccountProfile {
  /** When a connected app last proved it (ISO). */
  verifiedAt: string
  /** The owner lets their Invade profile show it. */
  shown: boolean
}

/** What a person can follow: another person, a League account, a professional player. */
export type FollowKind = 'user' | 'player' | 'pro'
export const FOLLOW_KINDS: readonly FollowKind[] = ['user', 'player', 'pro']

/** Someone or something followed, as a list row draws it. */
export interface FollowCard {
  kind: FollowKind
  /** The person's id, the League account's API PUUID, or the pro's slug. */
  id: string
  name: string
  /** A person's main Riot ID (when shown), a player's rank, a pro's team and role. */
  subtitle: string | null
  imageUrl: string | null
  /** The page it leads to on the site. */
  href: string
  /** When the follow started (ISO). */
  since: string
}

/** A row of a followers or following list, with whether the signed-in visitor follows it. */
export interface FollowRow extends FollowCard {
  viewerFollows: boolean
}

/** What a Follow button shows. */
export interface FollowState {
  /** The signed-in visitor follows it. */
  following: boolean
  /** How many people follow it. */
  followers: number
}

/** What a person keeps in their Favorites. */
export type SavedKind = 'clip' | 'match'
export const SAVED_KINDS: readonly SavedKind[] = ['clip', 'match']

export interface AccountDevice {
  id: string
  os: string
  app: string
  linkedAt: string
  lastSeenAt: string | null
}

export interface AccountUser {
  id: string
  name: string
  /** The person's address: `/u/<handle>`. */
  handle: string
  avatarUrl: string | null
  /** The sign-in methods attached to the account. */
  providers: AccountProvider[]
  createdAt: string
  /** Invade+ is active on the account. */
  premium: boolean
}

export interface AccountCounts {
  followers: number
  following: number
  /** People who follow the person back. */
  friends: number
  saved: number
}

/** Who may watch a new clip, and who may comment on it. */
export type ClipAudience = 'everyone' | 'link' | 'private'
export type ClipComments = 'everyone' | 'game' | 'off'

export interface AccountSettings {
  /** Who may watch a new clip by default. */
  clipVisibility: ClipAudience
  /** Who may comment on a new clip by default. */
  clipComments: ClipComments
  /** The person's clips show on their League accounts' profiles. */
  clipsOnProfile: boolean
  /** Other people may name the person in their clips. */
  allowTags: boolean
  /** With League's Hide My Name on, the person stays off other people's clips and comments. */
  streamerMode: boolean
}

export interface InvadeAccountData {
  user: AccountUser | null
  mainPuuid: string | null
  accounts: OwnedAccount[]
  /** Newest first. */
  following: FollowCard[]
  counts: AccountCounts
  devices: AccountDevice[]
  settings: AccountSettings | null
}

/** A change the app and the site both send (§10.4). */
export type AccountOp =
  | { op: 'follow' | 'unfollow'; kind: FollowKind; id: string }
  | { op: 'save' | 'unsave'; kind: SavedKind; id: string }
  | { op: 'main'; puuid: string }
  | { op: 'show'; puuid: string; shown: boolean }

/** The site's own changes, beside those of the app. */
export type SiteAccountOp =
  | AccountOp
  /** "Not mine": off the list until the app proves it again on request (§10.3). */
  | { op: 'notMine'; puuid: string }
  | { op: 'disconnect'; deviceId: string }
  | { op: 'rename'; name: string }
  | { op: 'settings'; settings: Partial<AccountSettings> }

/** What every page knows about the signed-in visitor (the header's account menu). */
export interface Viewer {
  id: string
  name: string
  handle: string
  avatarUrl: string | null
  main: AccountProfile | null
  saved: number
  following: number
  apps: number
}

export const emptyAccount = (): InvadeAccountData => ({
  user: null,
  mainPuuid: null,
  accounts: [],
  following: [],
  counts: { followers: 0, following: 0, friends: 0, saved: 0 },
  devices: [],
  settings: null,
})

/** Limits, the same for the site and the app. */
export const ACCOUNT_LIMITS = { follows: 2000, saved: 1000, displayName: 32, ops: 50 }
