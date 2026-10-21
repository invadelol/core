import type { HttpContext } from '@adonisjs/core/http'
import proService from '#services/pro_service'
import teamLogoService from '#services/team_logo_service'

/** Professional players and teams: the directory, a pro's page, a team's page, search and logos. */
export default class ProsController {
  /** `/pros`: active teams by region and the best ranked pros now. */
  async index({ inertia }: HttpContext) {
    const directory = await proService.directory()
    return inertia.render('pros/index', { directory })
  }

  /** `/pro/:slug`: a pro, every account they play on, their teams and their games. */
  async show({ inertia, params, response }: HttpContext) {
    const pro = await proService.player(String(params.slug))
    if (!pro) return response.notFound()
    return inertia.render('pros/show', {
      pro,
      social: {
        title: `${pro.name} · invade.lol`,
        description: `${pro.name}${pro.team ? ` (${pro.team.name})` : ''}: every ranked account, champions and recent games.`,
        url: `https://invade.lol/pro/${pro.slug}`,
      },
    })
  }

  /** `/team/:slug`: a team's roster, past players and recent games. */
  async team({ inertia, params, response }: HttpContext) {
    const team = await proService.team(String(params.slug))
    if (!team) return response.notFound()
    return inertia.render('pros/team', {
      team,
      social: {
        title: `${team.name} · invade.lol`,
        description: `${team.name}: roster, every player's ranked accounts and recent games.`,
        url: `https://invade.lol/team/${team.slug}`,
      },
    })
  }

  /**
   * Pros and teams whose name starts with the query, for the site's search.
   * @paramQuery q - At least two characters
   */
  async search({ request, response }: HttpContext) {
    const q = String(request.input('q', ''))
    const found = await proService.search(q, 5).catch(() => ({ pros: [], teams: [] }))
    response.header('Cache-Control', 'public, max-age=300')
    return response.ok(found)
  }

  /** `/cdn/team/:id`: a team's logo, from our own origin. */
  async logo({ params, response }: HttpContext) {
    const logo = await teamLogoService.get(String(params.id))
    if (!logo) return response.notFound()
    response.header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    response.header('X-Content-Type-Options', 'nosniff')
    response.header('Cross-Origin-Resource-Policy', 'cross-origin')
    response.header('Content-Type', logo.contentType)
    return response.send(Buffer.from(logo.body))
  }
}
