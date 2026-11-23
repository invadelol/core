import clipService from '#services/clips/clip_service'
import type { Clip } from '../../../inertia/lib/clip_types.js'
import type { ClipCard } from '../../../inertia/lib/profile_types.js'

const card = (clip: Clip): ClipCard => ({
  id: clip.id,
  url: `/clip/${clip.id}`,
  poster: clip.poster,
  title: clip.title,
  championId: clip.championId,
  matchId: clip.matchId,
  startMs: clip.startMs,
  durationMs: clip.durationMs,
  moment: clip.moment,
  visibility: clip.visibility,
  views: clip.views,
  comments: clip.commentCount,
  gg: clip.gg,
  postedAt: clip.postedAt,
})

/**
 * The clips an Invade profile shows to this visitor, newest first: the public ones, every one of
 * them to their owner. `pinned` is the one its owner pinned, when the visitor may see it.
 */
export async function loadProfileClips(
  profileUserId: string,
  viewerId: string | null
): Promise<{ pinned: ClipCard | null; clips: ClipCard[] }> {
  const clips = await clipService.ofUser(profileUserId, viewerId)
  const pinned = clips.find((c) => c.pinned)
  return { pinned: pinned ? card(pinned) : null, clips: clips.map(card) }
}
