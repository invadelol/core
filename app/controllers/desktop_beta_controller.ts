import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import { SITE_ORIGIN } from '#services/sitemap'
import DesktopDevice from '#models/desktop_device'
import betaService, { type BetaTarget, userAgentApp } from '#services/desktop/beta_service'
import rateLimiter, { DESKTOP_LIMITS } from '#services/desktop/rate_limiter'
import { DesktopException } from '#exceptions/desktop_exception'
import { betaFeedbackValidator, betaFeedValidator } from '#validators/desktop'

type Limit = (typeof DESKTOP_LIMITS)[keyof typeof DESKTOP_LIMITS]

async function limit(rule: Limit, id: string) {
  const result = await rateLimiter.hit(rule.bucket, id, rule.limit, 3600)
  if (!result.allowed) throw DesktopException.rateLimited(result.retryAfter)
}

function device(ctx: HttpContext): DesktopDevice {
  if (!ctx.desktopDevice) throw DesktopException.unauthorized()
  return ctx.desktopDevice
}

/** Production links always point at invade.lol; a local core links back to itself. */
function origin(ctx: HttpContext) {
  if (app.inProduction) return SITE_ORIGIN
  return `${ctx.request.protocol()}://${ctx.request.host()}`
}

/**
 * Beta builds for the desktop app (docs/desktop-sync.md §8): the Beta panel,
 * the update feed, the installers and what testers send back. Only devices
 * linked to a Riot account with a live beta grant get anything.
 */
export default class DesktopBetaController {
  /**
   * Whether this device is in the beta, and the live builds with their notes
   * @tag Desktop
   * @responseBody 200 - {"tester": true, "label": "Name#TAG", "builds": [], "answers": []}
   */
  async show(ctx: HttpContext) {
    const current = device(ctx)
    await limit(DESKTOP_LIMITS.betaDevice, current.id)
    ctx.response.header('Cache-Control', 'no-store')
    const tester = await betaService.testerOf(current.id)
    if (!tester) return ctx.response.ok({ tester: false, label: null, builds: [], answers: [] })

    const running = userAgentApp(ctx.request.header('user-agent'))
    await betaService.seen(current, tester, running?.app ?? current.app, running?.os ?? current.os)
    const live = await betaService.builds()
    const builds = live.map(({ assets, ...build }) => ({
      ...build,
      platforms: Object.keys(assets),
    }))
    const answers = await betaService.answers(
      current.id,
      builds.map((build) => build.version)
    )
    return ctx.response.ok({ tester: true, label: tester.label, builds, answers })
  }

  /**
   * The Tauri updater feed of the newest beta build for one target; 204 when none
   * @tag Desktop
   * @paramPath target - windows-x86_64, darwin-aarch64 or darwin-x86_64
   */
  async feed(ctx: HttpContext) {
    const current = device(ctx)
    await limit(DESKTOP_LIMITS.betaDevice, current.id)
    const { target } = await ctx.request.validateUsing(betaFeedValidator, { data: ctx.params })
    ctx.response.header('Cache-Control', 'no-store')
    if (!(await betaService.testerOf(current.id))) throw DesktopException.notBetaTester()
    const build = await betaService.newestFor(target as BetaTarget)
    if (!build) return ctx.response.noContent()
    return ctx.response.ok(betaService.feed(build, target as BetaTarget, current.id, origin(ctx)))
  }

  /**
   * An installer, through a link from the feed (valid 30 minutes, bound to the device)
   * @tag Desktop
   */
  async download(ctx: HttpContext) {
    const link = betaService.readToken(String(ctx.params.token ?? ''))
    if (!link) throw DesktopException.unauthorized()
    await limit(DESKTOP_LIMITS.betaDownload, link.deviceId)
    // The grant and the device are checked again: a link outlives neither.
    const owner = await DesktopDevice.find(link.deviceId)
    if (!owner || owner.revokedAt) throw DesktopException.unauthorized()
    if (!(await betaService.testerOf(owner.id))) throw DesktopException.notBetaTester()
    const build = await betaService.build(link.version)
    const asset = build?.assets[link.target]
    if (!build || !asset) throw DesktopException.noBetaBuild()

    const file = await betaService.open(asset)
    if (!file) {
      throw new DesktopException('Beta downloads are unavailable', 503, 'E_BETA_UNAVAILABLE', 300)
    }
    ctx.response.header('Content-Type', 'application/octet-stream')
    ctx.response.header('Content-Disposition', `attachment; filename="${asset.name}"`)
    ctx.response.header('Cache-Control', 'private, no-store')
    if (file.length) ctx.response.header('Content-Length', String(file.length))
    return ctx.response.stream(file.stream)
  }

  /**
   * A tester's verdicts on a build's tests, and/or a free note
   * @tag Desktop
   * @requestBody {"version": "0.3.5-beta.1", "results": [{"test": "k3f9", "verdict": "broken", "note": "..."}], "note": "..."}
   * @responseBody 200 - {"results": 1, "note": true}
   */
  async feedback(ctx: HttpContext) {
    const current = device(ctx)
    await limit(DESKTOP_LIMITS.betaFeedback, current.id)
    const payload = await ctx.request.validateUsing(betaFeedbackValidator)
    if (!(await betaService.testerOf(current.id))) throw DesktopException.notBetaTester()
    const build = await betaService.build(payload.version)
    if (!build) throw DesktopException.noBetaBuild()
    const results = await betaService.results(current.id, build, payload.results ?? [])
    if (payload.note) await betaService.note(current.id, build.version, payload.note)
    return ctx.response.ok({ results, note: !!payload.note })
  }
}
