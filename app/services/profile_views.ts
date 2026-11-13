import { createHmac } from 'node:crypto'
import logger from '@adonisjs/core/services/logger'
import redis from '@adonisjs/redis/services/main'
import { appKey } from '#config/app'

/** A visitor's view of a profile counts once in this window. */
export const VIEW_WINDOW_SECONDS = 24 * 60 * 60

/**
 * The Redis key that stands for one visitor's view of one profile: a keyed hash (the app key) of
 * the visitor's address, browser and the player, so none of them is stored in clear and the key
 * cannot be traced back without the app key. No cookie: invade.lol sets none.
 */
export function viewKey(visitor: { ip: string; userAgent: string }, puuid: string) {
  const digest = createHmac('sha256', appKey.release())
    .update(`${visitor.ip}\n${visitor.userAgent}\n${puuid}`)
    .digest('base64url')
  return `profile:seen:${digest}`
}

/**
 * Whether this is the visitor's first view of the profile in the window; reloads within it are
 * not counted. The key expires with the window. Redis down counts the view, as before.
 */
export async function firstViewInWindow(
  visitor: { ip: string; userAgent: string },
  puuid: string
): Promise<boolean> {
  try {
    const set = await redis.set(viewKey(visitor, puuid), '1', 'EX', VIEW_WINDOW_SECONDS, 'NX')
    return set === 'OK'
  } catch (error) {
    logger.warn({ err: error }, 'profile view dedupe unavailable')
    return true
  }
}
