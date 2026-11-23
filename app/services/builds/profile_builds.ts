import type { ProfileBuild } from '../../../inertia/lib/profile_types.js'

/** The builds an Invade profile shows to this visitor. */
export async function loadProfileBuilds(
  _profileUserId: string,
  _viewerId: string | null
): Promise<ProfileBuild[]> {
  return []
}
