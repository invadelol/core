import { Exception } from '@adonisjs/core/exceptions'

/**
 * An error the desktop app is expected to act on (docs/desktop-sync.md §1).
 *
 * The app decides what to do from the status and the `code` alone, so every
 * desktop error carries one, and 429/503 always carry a `Retry-After`.
 */
export class DesktopException extends Exception {
  constructor(
    message: string,
    status: number,
    code: string,
    public retryAfter?: number
  ) {
    super(message, { status, code })
  }

  static unauthorized() {
    return new DesktopException('Unknown or revoked device token', 401, 'E_DEVICE_UNAUTHORIZED')
  }

  /** A missing, malformed or wrong signature (§1.1): the app registers again. */
  static badSignature() {
    return new DesktopException('Missing or invalid request signature', 401, 'E_BAD_SIGNATURE')
  }

  /** The timestamp is too far from core's clock; the `Date` header gives core's time. */
  static clockSkew() {
    return new DesktopException(
      'Request timestamp is too far from server time',
      401,
      'E_CLOCK_SKEW'
    )
  }

  static replay() {
    return new DesktopException('This signed request was already received', 401, 'E_REPLAY')
  }

  static notLinked() {
    return new DesktopException('The uploader is not linked to this device', 403, 'E_NOT_LINKED')
  }

  static invalidMatch(reason: string) {
    return new DesktopException(`Invalid match: ${reason}`, 422, 'E_INVALID_MATCH')
  }

  static notFound() {
    return new DesktopException('Summoner not found', 404, 'E_SUMMONER_NOT_FOUND')
  }

  static rateLimited(retryAfter: number) {
    return new DesktopException('Too many requests', 429, 'E_RATE_LIMITED', retryAfter)
  }

  static paused(what: 'uploads' | 'resolve', retryAfter = 1800) {
    return new DesktopException(
      what === 'uploads' ? 'Uploads are paused' : 'Riot ID lookups are paused',
      503,
      'E_UPLOADS_PAUSED',
      retryAfter
    )
  }
}
