import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type DesktopDevice from '#models/desktop_device'
import deviceService from '#services/desktop/device_service'
import { bearerToken } from '#services/desktop/tokens'
import { DesktopException } from '#exceptions/desktop_exception'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    /** The desktop app behind `Authorization: Bearer inv_dev_…`, when there is one. */
    desktopDevice?: DesktopDevice
  }
}

/**
 * Authenticates the desktop app by its device token (docs/desktop-sync.md §1).
 *
 * `optional` lets a request through without a token (onboarding before the
 * player opted in to publishing), but a token that is present must be valid:
 * answering 401 is what makes the app drop a revoked token and register again.
 */
export default class DesktopAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { optional?: boolean } = {}) {
    const header = ctx.request.header('authorization')
    if (!header && options.optional) return next()

    const token = bearerToken(header)
    const device = token ? await deviceService.authenticate(token) : null
    if (!device) throw DesktopException.unauthorized()

    await deviceService.touch(device)
    ctx.desktopDevice = device
    return next()
  }
}
