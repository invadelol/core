import type { HttpContext } from '@adonisjs/core/http'
import bugReportService, {
  type ReportArea,
  type ReportFile,
} from '#services/desktop/bug_report_service'
import betaService, { userAgentApp } from '#services/desktop/beta_service'
import rateLimiter, { DESKTOP_LIMITS } from '#services/desktop/rate_limiter'
import { DesktopException } from '#exceptions/desktop_exception'
import { bugReportValidator, similarReportsValidator } from '#validators/desktop'

type Limit = (typeof DESKTOP_LIMITS)[keyof typeof DESKTOP_LIMITS]

async function limit(rule: Limit, id: string) {
  const result = await rateLimiter.hit(rule.bucket, id, rule.limit, 3600)
  if (!result.allowed) throw DesktopException.rateLimited(result.retryAfter)
}

const SCREENSHOT_MAX = 3 * 1024 * 1024
const CLIP_MAX = 10 * 1024 * 1024

/** A base64 file, checked by size and by its first bytes. */
function decode(data: string, max: number) {
  const bytes = Buffer.from(data.replace(/^data:[^,]*,/, ''), 'base64')
  if (!bytes.length || bytes.length > max) return null
  return bytes
}

function imageType(bytes: Buffer) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { mime: 'image/jpeg', ext: 'jpg' }
  if (bytes.subarray(0, 4).toString('hex') === '89504e47') return { mime: 'image/png', ext: 'png' }
  return null
}

function clipType(name: string) {
  const ext = name.toLowerCase().split('.').pop()
  if (ext === 'mp4') return 'video/mp4'
  if (ext === 'webm') return 'video/webm'
  if (ext === 'mov') return 'video/quicktime'
  if (ext === 'mkv') return 'video/x-matroska'
  return null
}

/**
 * Bug reports from the desktop app (docs/desktop-sync.md §9), for every player, signed in
 * or not: kept for the admin, and posted on the Discord bug forum when the player asks.
 */
export default class DesktopReportsController {
  /**
   * A bug forum post whose title looks like the one being typed
   * @tag Desktop
   * @responseBody 200 - {"match": {"id": "1", "title": "...", "url": "https://discord.com/channels/…", "players": 3}}
   */
  async similar(ctx: HttpContext) {
    await limit(DESKTOP_LIMITS.similar, ctx.desktopDevice?.id ?? ctx.request.ip())
    const { q } = await ctx.request.validateUsing(similarReportsValidator, {
      data: ctx.request.qs(),
    })
    ctx.response.header('Cache-Control', 'no-store')
    return ctx.response.ok({ match: await bugReportService.similar(q) })
  }

  /**
   * A bug report, its screenshot or clip, and whether to post it on Discord
   * @tag Desktop
   * @responseBody 200 - {"id": 42, "discordUrl": "https://discord.com/channels/…", "discordError": false}
   */
  async store(ctx: HttpContext) {
    const device = ctx.desktopDevice ?? null
    if (device) await limit(DESKTOP_LIMITS.reportsDevice, device.id)
    await limit(DESKTOP_LIMITS.reportsIp, ctx.request.ip())
    const payload = await ctx.request.validateUsing(bugReportValidator)
    if (!payload.sameAs && !payload.title) {
      return ctx.response.unprocessableEntity({ error: 'A title is needed' })
    }
    if (!(await bugReportService.available())) {
      throw new DesktopException('Bug reports are unavailable', 503, 'E_REPORTS_UNAVAILABLE', 300)
    }

    const files: ReportFile[] = []
    if (payload.screenshot) {
      const bytes = decode(payload.screenshot, SCREENSHOT_MAX)
      const type = bytes && imageType(bytes)
      if (!bytes || !type) return ctx.response.unprocessableEntity({ error: 'Bad screenshot' })
      files.push({ kind: 'screenshot', name: `screenshot.${type.ext}`, mime: type.mime, bytes })
    }
    if (payload.clip) {
      const bytes = decode(payload.clip.data, CLIP_MAX)
      const mime = clipType(payload.clip.name)
      if (!bytes || !mime) return ctx.response.unprocessableEntity({ error: 'Bad clip' })
      const name = payload.clip.name.replace(/[^\w .()-]+/g, '_').slice(0, 120)
      files.push({ kind: 'clip', name, mime, bytes })
    }

    const running = userAgentApp(ctx.request.header('user-agent'))
    const tester = device ? await betaService.testerOf(device.id) : null
    const os = running?.os === 'macos' ? 'macOS' : running?.os === 'windows' ? 'Windows' : ''
    const result = await bugReportService.submit({
      title: payload.title ?? '',
      body: payload.body,
      page: payload.page ?? '',
      area: (payload.area ?? 'Other') as ReportArea,
      inGame: payload.inGame ?? '',
      diagnostics: payload.diagnostics ?? '',
      appVersion: running?.app ?? device?.app ?? '',
      os,
      reporter: tester?.label ?? (await bugReportService.reporterOf(device?.id ?? null)),
      deviceId: device?.id ?? null,
      files,
      discord: !!payload.discord,
      sameAs: payload.sameAs ?? null,
    })
    return ctx.response.ok(result)
  }
}
