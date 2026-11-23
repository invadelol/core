import type { ClipCard, FriendCard, ProfileBuild } from './profile_types.js'
import type { ProfileSkinsData } from './skin_types.js'

/**
 * The Invade profile (`/u/<handle>`): a person, not a League account. What the page receives, the
 * choices its Customize panel offers, and which of them need Invade+. Shared by the server (which
 * checks every choice) and the page.
 */

export const ACCENTS = ['violet', 'rose', 'gold', 'teal', 'ice', 'white'] as const
export type Accent = (typeof ACCENTS)[number]
export const ACCENT_NAMES: Record<Accent, string> = {
  violet: 'Violet',
  rose: 'Rose',
  gold: 'Gold',
  teal: 'Teal',
  ice: 'Ice',
  white: 'White',
}
/** The one accent every account has; the others are Invade+. */
export const FREE_ACCENT: Accent = 'violet'

export const SHOWCASES = [
  'pinned',
  'favorites',
  'signature',
  'friends',
  'clips',
  'builds',
  'season',
] as const
export type ShowcaseKey = (typeof SHOWCASES)[number]
export const SHOWCASE_NAMES: Record<ShowcaseKey, string> = {
  pinned: 'Pinned clip',
  favorites: 'Favourite four',
  signature: 'Signature champions',
  friends: 'Friends',
  clips: 'Clips',
  builds: 'Builds',
  season: 'This season',
}
/** Showcases only an Invade+ account may switch on. */
export const PLUS_SHOWCASES: ReadonlySet<ShowcaseKey> = new Set(['clips', 'builds', 'season'])

export interface Showcase {
  key: ShowcaseKey
  on: boolean
}

/** A new profile: the free showcases on, in this order. */
export const DEFAULT_SHOWCASES: Showcase[] = SHOWCASES.map((key) => ({
  key,
  on: !PLUS_SHOWCASES.has(key),
}))

export const LINK_KINDS = ['twitch', 'x', 'youtube', 'instagram'] as const
export type LinkKind = (typeof LINK_KINDS)[number]
export const LINK_NAMES: Record<LinkKind, string> = {
  twitch: 'Twitch',
  x: 'X',
  youtube: 'YouTube',
  instagram: 'Instagram',
}
/** Each network's own rule for a handle, so a link always opens that network's page. */
export const LINK_HANDLE: Record<LinkKind, RegExp> = {
  twitch: /^[A-Za-z0-9_]{3,25}$/,
  x: /^[A-Za-z0-9_]{1,15}$/,
  youtube: /^[A-Za-z0-9._-]{3,30}$/,
  instagram: /^[A-Za-z0-9._]{1,30}$/,
}
export function linkUrl(kind: LinkKind, handle: string) {
  switch (kind) {
    case 'twitch':
      return `https://www.twitch.tv/${handle}`
    case 'x':
      return `https://x.com/${handle}`
    case 'youtube':
      return `https://www.youtube.com/@${handle}`
    case 'instagram':
      return `https://www.instagram.com/${handle}`
  }
}

export const PROFILE_LIMITS = { bio: 160 }

export type AvatarSource = 'backdrop' | 'icon'

/** What the owner chose, as Customize edits it and `PUT /api/profile` takes it. */
export interface ProfileSettings {
  bio: string
  links: { kind: LinkKind; handle: string }[]
  /** An owned skin's id, or null for the main champion's art. */
  backdrop: number | null
  avatar: AvatarSource
  accent: Accent
  frame: boolean
  showcases: Showcase[]
  /** The favourite four, skin ids in order. */
  favorites: number[]
}

export type ProfileTab =
  | 'overview'
  | 'clips'
  | 'skins'
  | 'builds'
  | 'friends'
  | 'solo'
  | 'champions'
  | 'career'

export interface ProfileBadge {
  kind: 'plus' | 'beta'
  label: string
}

/** A League account on the profile, as its plate draws it. */
export interface LeaguePlate {
  puuid: string
  gameName: string
  tagLine: string
  platform: string
  profileIconId: number | null
  main: boolean
  rank: { tier: string; division: string | null; lp: number; wins: number; losses: number } | null
  /** The main account's LP over 30 days: ladder values (`ladderValue`), oldest first. */
  line: { at: number; value: number }[]
  /** The LP gained or lost over those 30 days. */
  delta: number | null
  /** Its most played champions lately, most first. */
  champions: number[]
  /** Its last ranked results, oldest first (true: a win). */
  form: boolean[]
}

/** A pro's account (from the pro data), as the verified profile's plates draw it. */
export interface ProPlate {
  id: string
  platform: string
  gameName: string
  tagLine: string
  tier: string | null
  division: number | null
  lp: number | null
  wins: number | null
  losses: number | null
  peakTier: string | null
  peakDivision: number | null
  peakLp: number | null
}

/** A pro's facts on their verified Invade profile. */
export interface VerifiedPro {
  slug: string
  name: string
  realName: string | null
  country: string | null
  role: string | null
  team: { id: string; slug: string; name: string } | null
  league: { slug: string; code: string } | null
  photo: string | null
  socials: Record<string, string>
  accounts: ProPlate[]
}

/** The person: everything the head of every tab draws. */
export interface ProfileHead {
  id: string
  name: string
  handle: string
  /** The main shown League account's platform (`EUW1`), for the line under the name. */
  platform: string | null
  bio: string
  links: { kind: LinkKind; handle: string; url: string }[]
  badges: ProfileBadge[]
  accent: Accent
  frame: boolean
  avatarUrl: string | null
  backdrop: { url: string; skin: number | null } | null
  followers: number
  following: number
  viewerFollows: boolean
  followsViewer: boolean
  plates: LeaguePlate[]
  pro: VerifiedPro | null
  /** The visitor is the owner: Edit profile instead of Follow. */
  owner: boolean
  /** The owner holds Invade+ (their Customize choices beyond the free ones apply). */
  premium: boolean
  /** How many of each tab, for the tab bar. */
  counts: { clips: number; skins: number; builds: number; friends: number }
}

export interface SignatureChampion {
  championId: number
  name: string
  games: number
  wins: number
}

/** The main account's ranked season, as the This season showcase draws it. */
export interface SeasonLine {
  points: { at: number; value: number }[]
  from: { tier: string; division: string | null }
  to: { tier: string; division: string | null }
}

export interface OverviewData {
  showcases: ShowcaseKey[]
  pinned: ClipCard | null
  clips: ClipCard[]
  favorites: ProfileSkinsData['favorites']
  signature: SignatureChampion[]
  builds: ProfileBuild[]
  friends: FriendCard[]
  season: SeasonLine | null
}

/** What Customize offers the owner. */
export interface CustomizeData {
  settings: ProfileSettings
  /** Their owned skins, newest bought first: the backdrops they may pick. */
  backdrops: { id: number; championId: number; num: number; name: string }[]
  /** The main champion's art, used when no skin is picked. */
  fallbackChampion: number | null
  iconId: number | null
}
