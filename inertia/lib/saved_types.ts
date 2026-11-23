import type { ClipCard } from './profile_types.js'
import type { Match } from './types.js'

/**
 * What a person keeps in their Favorites (the account's Saved items): clips and matches, as the
 * private Favorites page draws them.
 */

/** A saved clip with who posted it. */
export interface SavedClip {
  clip: ClipCard
  /**
   * The person who posted it: their Invade name, picture and profile (`/u/<handle>`). Never the
   * League account behind it, which only shows where its owner chose to show it.
   */
  by: { name: string; avatar: string | null; href: string | null }
  /** ISO. */
  savedAt: string
}

/** A saved match, from the side of the player it was saved from. */
export interface SavedMatch {
  match: Match
  /** Whose game it is on the row. */
  puuid: string
  gameName: string
  tagLine: string
  /** ISO. */
  savedAt: string
}

export interface SavedItems {
  clips: SavedClip[]
  matches: SavedMatch[]
  /** Everything saved, past the lists' first page. */
  counts: { clips: number; matches: number }
}

/** What the stars of a page need to know: the saved clips' ids and matches' game ids. */
export interface SavedKeys {
  clips: string[]
  /** The match id's number (`EUW1_7998180573` → `7998180573`), as the shared rows key a game. */
  games: string[]
}
