import buildsService from '#services/builds/builds_service'
import type { ProfileBuild } from '../../../inertia/lib/profile_types.js'

/**
 * The builds an Invade profile shows to this visitor: the person's shared builds (every one of
 * them when they look at their own profile), then those they saved from others.
 */
export function loadProfileBuilds(
  profileUserId: string,
  viewerId: string | null
): Promise<ProfileBuild[]> {
  return buildsService.ofProfile(profileUserId, viewerId)
}
