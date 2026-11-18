import { createHash } from 'node:crypto'
import { matchCard } from '#services/og/game_cards'
import { RENDERER as OG_RENDERER } from '#services/og/version'

/**
 * The share card of one player's game, as a social link preview shows it (`/og/match/…`): the
 * result huge in its colour over the champion's splash, the player and the champion, the K/D/A
 * and the Invade score with a poro reacting to the game (`og/game_cards.ts`).
 */
export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630

/** Bump on any change to how the card is drawn: every `?v=` changes, so shared images refresh. */
export const RENDERER = 2

export interface MatchCard {
  championId: number
  win: boolean
  /** The queue as the match row names it ("Ranked Solo", "ARAM"). */
  queue: string
  /** Seconds. */
  duration: number
  kills: number
  deaths: number
  assists: number
  /** Invade score, 0 to 100. */
  score: number
  tag: 'MVP' | 'ACE' | ''
}

/** Who played it, drawn beside the result: the player's name and the champion's. */
export interface MatchCardPlayer {
  gameName: string | null
  champion: string | null
}

/** A short hash of everything the card draws and of the renderer: the image URL's `v`. */
export function matchCardVersion(card: MatchCard, player?: MatchCardPlayer) {
  const drawn = [
    RENDERER,
    OG_RENDERER,
    card.championId,
    card.win ? 1 : 0,
    card.queue,
    Math.round(card.duration),
    card.kills,
    card.deaths,
    card.assists,
    card.score,
    card.tag,
    player?.gameName ?? '',
    player?.champion ?? '',
  ]
  return createHash('sha256').update(JSON.stringify(drawn)).digest('base64url').slice(0, 10)
}

/** The card as a 1200 by 630 JPEG. `artwork` is the champion's centred splash, `icon` its portrait. */
export async function renderMatchCard(
  card: MatchCard,
  artwork?: Uint8Array,
  player: MatchCardPlayer = { gameName: null, champion: null },
  icon?: Uint8Array
) {
  return matchCard({ ...card, ...player, splash: artwork, icon })
}
