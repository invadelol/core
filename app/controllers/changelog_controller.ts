import type { HttpContext } from '@adonisjs/core/http'
import { changelog, changelogSocial, normalizeVersion } from '#services/changelog'

/**
 * `/app/changelog`: the desktop app's release notes, every version newest first, as the app's
 * "What's new" page shows them. `/app/changelog/0.3.2` is the same page opened at that version,
 * with that version's link preview; `v0.3.2` leads there.
 */
export default class ChangelogController {
  async index({ inertia }: HttpContext) {
    const log = await changelog()
    const social = changelogSocial(log)
    return inertia.render('app/changelog', {
      releases: log.releases,
      version: null,
      description: social?.description,
      social,
    })
  }

  async show({ inertia, params, response }: HttpContext) {
    const raw = String(params.version)
    const version = normalizeVersion(raw)
    const log = await changelog()
    const social = changelogSocial(log, version)
    if (!social) {
      response.status(404)
      return inertia.render('errors/not_found', { error: { status: 404, message: null } })
    }
    if (raw !== version) return response.redirect(`/app/changelog/${version}`, false, 301)
    return inertia.render('app/changelog', {
      releases: log.releases,
      version,
      description: social.description,
      social,
    })
  }
}
