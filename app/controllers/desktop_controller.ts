import type { HttpContext } from '@adonisjs/core/http'
import { errors as vineErrors } from '@vinejs/vine'
import env from '#start/env'
import deviceService from '#services/desktop/device_service'
import publicationService from '#services/desktop/publication_service'
import resolveService from '#services/desktop/resolve_service'
import playerSnapshotService from '#services/desktop/player_snapshot_service'
import rateLimiter, { DESKTOP_LIMITS } from '#services/desktop/rate_limiter'
import { DESKTOP_MAX_PAYLOAD_BYTES } from '#middleware/body_parser_middleware'
import { DesktopException } from '#exceptions/desktop_exception'
import {
  linkValidator,
  playersValidator,
  registerDeviceValidator,
  resolveValidator,
  unlinkValidator,
  uploadValidator,
} from '#validators/desktop'
import type DesktopDevice from '#models/desktop_device'
import type { MatchUpload, PlayerBatch } from '#types/desktop'

type Limit = (typeof DESKTOP_LIMITS)[keyof typeof DESKTOP_LIMITS]

/** Counts `amount` units against an hourly limit; over it answers 429 with `Retry-After`. */
async function limit(rule: Limit, id: string, amount = 1) {
  const result = await rateLimiter.hit(rule.bucket, id, rule.limit, 3600, amount)
  if (!result.allowed) throw DesktopException.rateLimited(result.retryAfter)
}

/** Set by the `desktopAuth` middleware on every authenticated route. */
function device(ctx: HttpContext): DesktopDevice {
  if (!ctx.desktopDevice) throw DesktopException.unauthorized()
  return ctx.desktopDevice
}

/**
 * The desktop app's API (docs/desktop-sync.md). Thin on purpose: the rules
 * live in `app/services/desktop`, where they can be tested without HTTP.
 */
export default class DesktopController {
  /**
   * Kill switches and limits the app reads before uploading
   * @tag Desktop
   * @responseBody 200 - {"uploads": true, "resolve": true, "maxPayloadBytes": 2000000, "minAppVersion": null}
   */
  async config({ response }: HttpContext) {
    response.header('Cache-Control', 'public, max-age=300')
    return response.ok({
      uploads: publicationService.enabled(),
      resolve: resolveService.enabled(),
      maxPayloadBytes: DESKTOP_MAX_PAYLOAD_BYTES,
      minAppVersion: env.get('DESKTOP_MIN_APP_VERSION') || null,
    })
  }

  /**
   * Register a device; the token and the signing secret are returned once
   * and never stored in clear
   * @tag Desktop
   * @requestBody {"app": "0.2.7", "os": "macos"}
   * @responseBody 201 - {"deviceId": "uuid", "token": "inv_dev_...", "secret": "64 hex"}
   * @responseBody 429 - Too many registrations from this address
   */
  async register({ request, response }: HttpContext) {
    await limit(DESKTOP_LIMITS.register, request.ip())
    const { app, os } = await request.validateUsing(registerDeviceValidator)
    return response.created(await deviceService.register(app, os))
  }

  /**
   * Revoke this device's token
   * @tag Desktop
   * @responseBody 204 - Revoked
   * @responseBody 401 - Unknown or revoked token
   */
  async revoke(ctx: HttpContext) {
    await deviceService.revoke(device(ctx).id, 'user')
    return ctx.response.noContent()
  }

  /**
   * Make an account one of this device's uploaders
   * @tag Desktop
   * @requestBody {"gameName": "Louhi", "tagLine": "727", "platform": "EUW1", "rawPuuid": null, "source": "riot_id"}
   * @responseBody 200 - {"puuid": "...", "profileUrl": "https://invade.lol/Louhi-727"}
   * @responseBody 404 - Unknown Riot ID
   */
  async link(ctx: HttpContext) {
    const current = device(ctx)
    await limit(DESKTOP_LIMITS.link, current.id)
    const payload = await ctx.request.validateUsing(linkValidator)
    return ctx.response.ok(await deviceService.link(current, payload))
  }

  /**
   * Stop uploading for an account
   * @tag Desktop
   * @paramPath puuid - API PUUID of the linked account
   * @responseBody 204 - Unlinked
   */
  async unlink(ctx: HttpContext) {
    const { puuid } = await ctx.request.validateUsing(unlinkValidator, { data: ctx.params })
    await deviceService.unlink(device(ctx).id, puuid)
    return ctx.response.noContent()
  }

  /**
   * Onboard a player by Riot ID without the League client
   * @tag Desktop
   * @paramQuery gameName - Riot ID name
   * @paramQuery tagLine - Riot ID tag
   * @responseBody 200 - {"puuid": "...", "solo": null, "flex": null, "mastery": [], "recent": [], "stale": false}
   * @responseBody 404 - Unknown Riot ID
   */
  async resolve(ctx: HttpContext) {
    const current = ctx.desktopDevice
    if (current) await limit(DESKTOP_LIMITS.resolveDevice, current.id)
    else await limit(DESKTOP_LIMITS.resolveIp, ctx.request.ip())

    const { gameName, tagLine, platform } = await ctx.request.validateUsing(resolveValidator, {
      data: ctx.request.qs(),
    })
    ctx.response.header('Cache-Control', 'no-store')
    return ctx.response.ok(await resolveService.resolve(gameName, tagLine, platform))
  }

  /**
   * Upload a finished game the uploader played
   * @tag Desktop
   * @responseBody 200 - {"matchId": "EUW1_1", "status": "stored", "lp": "none", "url": "https://invade.lol/Louhi-727/match/EUW1_1"}
   * @responseBody 403 - The uploader is not linked to this device
   * @responseBody 413 - Larger than 2 MB
   * @responseBody 422 - Not a plausible game
   */
  async upload(ctx: HttpContext) {
    const current = device(ctx)
    const ip = ctx.request.ip()
    await limit(DESKTOP_LIMITS.uploadDevice, current.id)
    await limit(DESKTOP_LIMITS.uploadIp, ip)
    if (!publicationService.enabled()) throw DesktopException.paused('uploads')

    const body = ctx.request.body()
    if (body.lp !== undefined && body.lp !== null && typeof body.lp !== 'object') {
      throw new DesktopException('lp must be an object or null', 422, 'E_INVALID_LP')
    }
    const payload = (await ctx.request.validateUsing(uploadValidator)) as unknown as MatchUpload
    const result = await publicationService.upload(payload, { device: current, ip })
    return ctx.response.ok(result)
  }

  /**
   * Report players the League client showed (identity, ranks, mastery)
   * @tag Desktop
   * @responseBody 200 - {"results": [{"rawPuuid": "uuid", "status": "applied"}]}
   * @responseBody 413 - Larger than 256 KB
   * @responseBody 422 - Not 1-25 players, or not schema 1
   */
  async players(ctx: HttpContext) {
    const current = device(ctx)
    const ip = ctx.request.ip()
    await limit(DESKTOP_LIMITS.playersDevice, current.id)
    await limit(DESKTOP_LIMITS.playersIp, ip)
    if (!publicationService.enabled()) throw DesktopException.paused('uploads')

    const batch = (await ctx.request.validateUsing(playersValidator)) as unknown as PlayerBatch
    // `distinct` compares the input as sent: catch a PUUID repeated in another case too.
    if (new Set(batch.players.map((player) => player.rawPuuid)).size !== batch.players.length) {
      throw new vineErrors.E_VALIDATION_ERROR([
        {
          message: 'The players field has duplicate values',
          rule: 'distinct',
          field: 'players',
          meta: { fields: 'rawPuuid' },
        },
      ])
    }
    await limit(DESKTOP_LIMITS.playersDevicePlayers, current.id, batch.players.length)
    return ctx.response.ok(await playerSnapshotService.ingest(batch, { device: current, ip }))
  }
}
