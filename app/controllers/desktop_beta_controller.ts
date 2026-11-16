import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import { SITE_ORIGIN } from '#services/sitemap'
import DesktopDevice from '#models/desktop_device'
import betaService, {
  BETA_PACKAGE_NAME,
  BETA_TARGETS,
  BETA_VERSION,
  type BetaTarget,
  userAgentApp,
} from '#services/desktop/beta_service'
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
    if (!tester) {
      return ctx.response.ok({ tester: false, label: null, builds: [], answers: [], ratings: [] })
    }

    const running = userAgentApp(ctx.request.header('user-agent'))
    await betaService.seen(current, tester, running?.app ?? current.app, running?.os ?? current.os)
    const live = await betaService.builds()
    const builds = live.map(({ assets, ...build }) => ({
      ...build,
      platforms: Object.keys(assets),
    }))
    const versions = builds.map((build) => build.version)
    const [answers, ratings] = await Promise.all([
      betaService.answers(current.id, versions),
      betaService.ratings(current.id, versions),
    ])
    return ctx.response.ok({ tester: true, label: tester.label, builds, answers, ratings })
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
   * A tester's verdicts on a build's tests, a free note and/or a rating
   * @tag Desktop
   * @requestBody {"version": "0.3.5-beta.1", "results": [{"test": "k3f9", "verdict": "broken", "note": "..."}], "note": "...", "rating": 4, "comment": "..."}
   * @responseBody 200 - {"results": 1, "note": true, "rating": true}
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
    if (payload.rating) {
      await betaService.rate(current.id, build.version, payload.rating, payload.comment ?? '')
    }
    return ctx.response.ok({ results, note: !!payload.note, rating: !!payload.rating })
  }

  /**
   * One installer from the build workflow (§8.6): the body is the package, the
   * signature is its minisign `.sig` file
   * @tag Desktop
   * @responseBody 200 - {"version": "0.3.5-beta.1", "target": "windows-x86_64", "size": 15000000}
   */
  async upload(ctx: HttpContext) {
    if (!betaService.uploadAllowed(ctx.request.header('authorization'))) {
      throw DesktopException.unauthorized()
    }
    const version = String(ctx.request.qs().version ?? '')
    const target = String(ctx.request.qs().target ?? '')
    const name = String(ctx.request.qs().name ?? '')
    const signature = String(ctx.request.header('x-invade-signature') ?? '').trim()
    if (
      version.length > 40 ||
      !BETA_VERSION.test(version) ||
      !BETA_TARGETS.includes(target as BetaTarget) ||
      !BETA_PACKAGE_NAME.test(name) ||
      !/^[A-Za-z0-9+/=]{40,2000}$/.test(signature)
    ) {
      return ctx.response.unprocessableEntity({ error: 'Bad version, target, name or signature' })
    }
    if (!(await betaService.available())) {
      throw new DesktopException('Beta builds are unavailable', 503, 'E_BETA_UNAVAILABLE', 300)
    }
    const asset = await betaService.upload(
      version,
      target as BetaTarget,
      name,
      signature,
      ctx.request.request
    )
    return ctx.response.ok({ version, target, size: asset.size })
  }
}
