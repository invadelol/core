import type { FriendCard } from '../../../inertia/lib/profile_types.js'

/** The follows around an Invade profile, as its head and its Friends tab show them. */
export async function loadProfileSocial(
  _viewerId: string | null,
  _profileUserId: string
): Promise<{
  followers: number
  following: number
  viewerFollows: boolean
  followsViewer: boolean
  friends: FriendCard[]
  playingNow: FriendCard[]
}> {
  return {
    followers: 0,
    following: 0,
    viewerFollows: false,
    followsViewer: false,
    friends: [],
    playingNow: [],
  }
}
