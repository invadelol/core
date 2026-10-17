import { damageShare, isAfk, isRemake, matchMinutes, teamTotals } from './match.js'
import type { Match } from './types.js'

/**
 * A light, self-deprecating tag on a clearly bad game, for the player's own eyes only: the
 * opposite of MVP. Only lost Summoner's Rift games of 20 minutes or more can earn one, at most one
 * per game, and never a game the player was away in. Showing them is the caller's call, and only
 * on the viewer's own profile: on anyone else's it would be mocking.
 */
export interface SelfTag {
  id: 'grey' | 'visiting' | 'spared' | 'pacifist' | 'dark'
  label: string
  /** What earned it, in plain words. */
  tip: string
}

const SUMMONERS_RIFT = 11
const MIN_MINUTES = 20

export function selfTag(match: Match, puuid: string): SelfTag | null {
  const me = match.participants.find((p) => p.puuid === puuid)
  if (!me || me.win || match.mapId !== SUMMONERS_RIFT || !match.queueId) return null
  if (isRemake(match) || isAfk(match, me)) return null
  const minutes = matchMinutes(match)
  if (minutes < MIN_MINUTES) return null

  const laner = ['TOP', 'MIDDLE', 'BOTTOM'].includes(me.position)
  const carry = laner || me.position === 'JUNGLE'

  if (me.deaths >= 10 && (me.kills + me.assists) / me.deaths < 0.7)
    return { id: 'grey', label: 'Grey screen tour', tip: `${me.deaths} deaths` }
  if (me.kills + me.assists <= 2)
    return { id: 'visiting', label: 'Just visiting', tip: 'Two takedowns or fewer' }
  if (laner && me.cs / minutes < 4)
    return { id: 'spared', label: 'Minions spared', tip: 'Under 4 CS per minute' }
  if (carry && damageShare(me, teamTotals(match)) < 7)
    return { id: 'pacifist', label: 'Pacifist run', tip: 'Under 7% of the team’s damage' }
  if (minutes >= 25 && me.visionScore / minutes < 0.25)
    return { id: 'dark', label: 'Played in the dark', tip: 'Almost no vision' }
  return null
}
