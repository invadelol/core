import { randomBytes } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import { clipKey, clipStore } from '#services/clips/storage'

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/**
 * A clip already online, written straight to the tables (and its two files to the clip storage
 * in use), for tests about what happens to clips rather than how they are posted. The poster
 * played `puuid` in `matchId`. Its rows go with its poster's account.
 */
export async function storedClip(
  poster: { id: string },
  puuid: string,
  overrides: Record<string, unknown> = {}
) {
  const id = Array.from(randomBytes(10), (b) => BASE62[b % BASE62.length]).join('')
  await db.table('invade_clip').insert({
    id,
    user_id: poster.id,
    puuid,
    match_id: 'EUW1_7000000101',
    platform: 'EUW1',
    champion_id: 81,
    start_ms: 541_000,
    duration_ms: 21_000,
    title: 'the flash was not ready',
    visibility: 'everyone',
    comments: 'everyone',
    status: 'ready',
    ready_at: new Date(),
    ...overrides,
  })
  await clipStore().put(clipKey(id, 'video'), Buffer.from('video'))
  await clipStore().put(clipKey(id, 'poster'), Buffer.from('poster'))
  return id
}
