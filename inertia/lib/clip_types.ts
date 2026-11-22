/** A clip as the site's pages and the desktop app receive it (docs/desktop-sync.md §11). */

export type ClipEvent = 'kill' | 'death' | 'assist' | 'objective' | 'manual'
export type ClipVisibility = 'everyone' | 'link'

export interface Clip {
  id: string
  /** The clip's page, absolute. */
  url: string
  /** The video (MP4) and its picture, on this site. */
  video: string
  poster: string | null
  matchId: string
  platform: string
  championId: number
  /** Where it starts in the game, seconds. */
  gameTime: number
  durationMs: number
  title: string
  event: ClipEvent
  visibility: ClipVisibility
  width: number | null
  height: number | null
  views: number
  bytes: number
  /** ISO. */
  createdAt: string
  /** The League account that played it. */
  player: { puuid: string; gameName: string; tagLine: string; profileIconId: number | null }
  /** Posted by the signed-in visitor. */
  mine: boolean
}
