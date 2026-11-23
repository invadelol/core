import type { ClipCard } from '../../../inertia/lib/profile_types.js'

/** The clips an Invade profile shows to this visitor, its pinned one apart. */
export async function loadProfileClips(
  _profileUserId: string,
  _viewerId: string | null
): Promise<{ pinned: ClipCard | null; clips: ClipCard[] }> {
  return { pinned: null, clips: [] }
}
