import { createHash, createHmac, randomBytes } from 'node:crypto'

/**
 * Device tokens (docs/desktop-sync.md §1): 32 random bytes, base64url,
 * prefixed so a leaked one is recognisable in logs and secret scanners.
 */
export const TOKEN_PREFIX = 'inv_dev_'
const TOKEN_PATTERN = /^inv_dev_[A-Za-z0-9_-]{43}$/

export function generateToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`
}

/**
 * What the database stores and looks tokens up by. A plain SHA-256 is enough
 * here: the input is 256 bits of randomness, so there is nothing to brute
 * force and no need for a slow password hash on every request.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function isToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value)
}

/** `Authorization: Bearer inv_dev_…` → the token, or null when absent or malformed. */
export function bearerToken(header: string | undefined | null): string | null {
  if (!header) return null
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header)
  return match && isToken(match[1]) ? match[1] : null
}

/**
 * Corroboration only needs to know whether two uploads came from the same
 * address. A keyed hash answers that without keeping anyone's IP.
 */
export function hashAddress(ip: string, key: string): string {
  return createHmac('sha256', key).update(ip, 'utf8').digest('hex')
}
