import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * A refused account request: what the person did is not possible, and the message says why in
 * words the site and the app can show as they are. The site's routes answer it as
 * `{ errors: [{ message, code }] }`; the desktop routes turn it into a `DesktopException` with the
 * same status and code (docs/desktop-sync.md §10).
 */
export class AccountError extends Exception {
  constructor(message: string, status: number, code: string) {
    super(message, { status, code })
  }

  /** An answer the person acts on, not a fault: nothing to log. */
  async report() {}

  async handle(error: this, ctx: HttpContext) {
    ctx.response.header('Cache-Control', 'no-store')
    return ctx.response
      .status(error.status)
      .send({ errors: [{ message: error.message, code: error.code }] })
  }

  static signedOut() {
    return new AccountError('Sign in to continue.', 401, 'E_SIGNED_OUT')
  }

  /** A browser request from another origin: never acted on (cross-site request forgery). */
  static foreignOrigin() {
    return new AccountError('This request must come from the site itself.', 403, 'E_ORIGIN')
  }

  static invalid(message: string) {
    return new AccountError(message, 422, 'E_ACCOUNT_INVALID')
  }

  static notFound(message: string) {
    return new AccountError(message, 404, 'E_ACCOUNT_NOT_FOUND')
  }

  static limit(message: string) {
    return new AccountError(message, 422, 'E_ACCOUNT_LIMIT')
  }

  /**
   * The desktop app is not connected to an Invade account. 403, not 401: to the app a 401 means
   * its device token is gone (docs/desktop-sync.md §1).
   */
  static notConnected() {
    return new AccountError('Connect the app to your Invade account first.', 403, 'E_NOT_CONNECTED')
  }

  /**
   * The team suspended the Invade account: the site treats the person as signed out, and the
   * desktop app shows this instead of the account (docs/desktop-sync.md §10).
   */
  static suspended() {
    return new AccountError('This Invade account is suspended.', 403, 'E_ACCOUNT_SUSPENDED')
  }

  /** The app never reported this League account as signed in to the client on this computer. */
  static notDetected() {
    return new AccountError(
      'Sign in to this account in the League client with Invade open, then try again.',
      403,
      'E_NOT_DETECTED'
    )
  }

  static linkExpired() {
    return new AccountError(
      'This link has expired. Start again from the app.',
      410,
      'E_LINK_EXPIRED'
    )
  }

  static appTaken() {
    return new AccountError(
      'This app is connected to another Invade account. Disconnect it there first.',
      409,
      'E_APP_TAKEN'
    )
  }

  static rateLimited(retryAfter: number) {
    const error = new AccountError('Too many attempts. Try again later.', 429, 'E_RATE_LIMITED')
    ;(error as AccountError & { retryAfter?: number }).retryAfter = retryAfter
    return error
  }
}
