import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Handles: a person's address on the site (`/u/<handle>`), lower case letters, digits and
 * underscores, 2 to 24 characters. Made once, from the Discord name given at the first sign-in;
 * when that handle is taken, the first free one with a number after it (`ember2`, `ember3`…).
 */

export const HANDLE = /^[a-z0-9_]{2,24}$/
const MAX = 24

/** Words that read as the site speaking, never anyone's handle (underscores aside). */
const RESERVED = new Set([
  'admin',
  'administrator',
  'invade',
  'invadelol',
  'mod',
  'moderator',
  'official',
  'riot',
  'riotgames',
  'staff',
  'support',
  'system',
  'team',
])

const reserved = (handle: string) => RESERVED.has(handle.replace(/_/g, ''))

export const isHandle = (value: unknown): value is string =>
  typeof value === 'string' && HANDLE.test(value) && !reserved(value)

/**
 * The handle a display name suggests: accents dropped, everything else that is not a letter or a
 * digit turned into one underscore, at most 24 characters. A name with nothing usable (only
 * emoji, another script) gives `player`.
 */
export function handleBase(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX)
    .replace(/_+$/, '')
  return base.length >= 2 && !reserved(base) ? base : 'player'
}

/** `base` with a number after it, cut so the whole stays within 24 characters. */
const numbered = (base: string, n: number) => `${base.slice(0, MAX - String(n).length)}${n}`

/**
 * A free handle for a new account, inside the transaction that creates it. The few candidates
 * that share the base are read in one query; the unique index settles a race with another
 * sign-in at the same moment (the transaction fails and the person tries again).
 */
export async function freeHandle(trx: TransactionClientContract, name: string): Promise<string> {
  const base = handleBase(name)
  const stem = base.slice(0, MAX - 6)
  const rows = await trx
    .from('invade_user')
    .whereRaw('handle LIKE ?', [`${stem.replace(/_/g, '\\_')}%`])
    .select('handle')
  const taken = new Set<string>(rows.map((row: { handle: string }) => row.handle))
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const candidate = numbered(base, n)
    if (!taken.has(candidate)) return candidate
  }
}
