/**
 * Skins as the site's pages receive them: the catalogue's facts (Community Dragon) and what people
 * say about them (ratings in half stars, reviews, likes, wishlists, lists, the diary of purchases).
 * Shared by the server and the pages.
 */

export type SkinRarity =
  | 'standard'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic'
  | 'ultimate'
  | 'transcendent'
  | 'exalted'

/** A skin as its poster draws it: the loading art (`/cdn/loading/<championId>-<num>`). */
export interface SkinCard {
  id: number
  championId: number
  /** Its number among the champion's skins (`id % 1000`): the art's address. */
  num: number
  name: string
  championName: string
  rarity: SkinRarity
}

/** Everything the catalogue says about a skin. */
export interface SkinFacts extends SkinCard {
  legacy: boolean
  lines: { id: number; name: string }[]
  chromas: { name: string; colors: string[] }[]
  /** Riot's own text. */
  description: string | null
  /** The patch it arrived in, when that is one of the last few. */
  newIn: string | null
}

/** Ratings in half stars (1 = half a star, 10 = five stars). */
export interface RatingSummary {
  /** Out of five, one decimal; null without ratings. */
  average: number | null
  count: number
  /** How many ratings of each value, half a star (index 0) to five stars (index 9). */
  histogram: number[]
}

export interface RatedSkin extends SkinCard {
  average: number | null
  ratings: number
}

/** A person as small rows name them. `tag`: their main League account's tag, when shown. */
export interface PersonRef {
  id: string
  name: string
  handle: string
  avatarUrl: string | null
  tag: string | null
}

export interface SkinReview {
  id: string
  skin: SkinCard
  author: PersonRef
  /** The author's rating of the skin, half stars. */
  rating: number | null
  /** The author's collection (the app's read) holds the skin. */
  owns: boolean
  body: string
  /** ISO. */
  createdAt: string
  likes: number
  liked: boolean
  mine: boolean
}

export interface SkinListCard {
  id: string
  title: string
  body: string
  owner: PersonRef
  count: number
  likes: number
  liked: boolean
  /** The first few skins, as the list's fan of posters. */
  posters: SkinCard[]
}

/** A list opened: its skins in the owner's order. */
export interface SkinListPage extends SkinListCard {
  skins: RatedSkin[]
  mine: boolean
  /** ISO. */
  updatedAt: string
}

/** What a friend did with a skin, for the skin page's Friends. */
export interface FriendSkinState {
  person: PersonRef
  owns: boolean
  rating: number | null
  wished: boolean
}

/** One thing a friend did this week, for the hub. */
export interface SkinActivity {
  person: PersonRef
  kind: 'rated' | 'reviewed' | 'wished'
  skin: SkinCard
  rating: number | null
  /** ISO. */
  at: string
}

/** A purchase the desktop app read from the League client, with what the person said of it. */
export interface DiaryEntry {
  skin: SkinCard & { lines: { id: number; name: string }[] }
  /** ISO. */
  purchasedAt: string
  rating: number | null
  liked: boolean
  reviewed: boolean
}

/** The person's collection as the desktop app last read it. */
export interface CollectionSummary {
  owned: number
  /** Skins in the game. */
  total: number
  byRarity: Partial<Record<SkinRarity, number>>
  /** ISO: the newest read of any of their League accounts. */
  readAt: string
}

/** The signed-in visitor and one skin. */
export interface ViewerSkinState {
  /** Null: no collection from the app yet, so whether they own it is unknown. */
  owned: boolean | null
  /** ISO. */
  wishedAt: string | null
  liked: boolean
  rating: number | null
  review: { id: string; body: string } | null
  /** Their lists, and whether this skin is in each. */
  lists: { id: string; title: string; has: boolean }[]
}

/** A skin's page (`/skins/<id>`). */
export interface SkinPageData {
  skin: SkinFacts
  ratings: RatingSummary
  /** Its place among its champion's skins by average rating, when rated. */
  place: { rank: number; of: number } | null
  viewer: ViewerSkinState | null
  reviews: { popular: SkinReview[]; recent: SkinReview[]; friends: SkinReview[]; total: number }
  friends: FriendSkinState[]
  line: { id: number; name: string; skins: RatedSkin[] } | null
  lists: SkinListCard[]
  listsTotal: number
  champion: { name: string; total: number; best: RatedSkin[] }
}

/** The skins hub (`/skins`). */
export interface SkinsHubData {
  popular: RatedSkin[]
  /** The week `popular` and `reviews` count, ISO dates. */
  week: { from: string; to: string }
  reviews: SkinReview[]
  activity: SkinActivity[]
  newest: (SkinCard & { newIn: string })[]
  lists: SkinListCard[]
  topRated: RatedSkin[]
  total: number
}

/** The profile's Skins tab. */
export interface ProfileSkinsData {
  favorites: (SkinCard & { rating: number | null })[]
  diary: DiaryEntry[]
  diaryTotal: number
  reviews: SkinReview[]
  reviewsTotal: number
  collection: CollectionSummary | null
  ratings: RatingSummary
  wishlist: SkinCard[]
  wishlistTotal: number
  lists: SkinListCard[]
}

/** Limits, the same for every page and route. */
export const SKIN_LIMITS = {
  review: 1000,
  listTitle: 80,
  listBody: 500,
  lists: 100,
  listSkins: 100,
  wishlist: 500,
  favorites: 4,
}
