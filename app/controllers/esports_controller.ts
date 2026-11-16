import type { HttpContext } from '@adonisjs/core/http'
import esportsService from '#services/esports_service'
import { breadcrumbs, count, meta, today } from '#services/page_meta'

/** The esports overview (`/esports`): what to watch, the leagues, one league around now. */
export default class EsportsController {
  /** `/esports?league=lck`: the overview, opened on a league (the first listed by default). */
  async index({ inertia, request }: HttpContext) {
    const asked = String(request.input('league', '')).toLowerCase() || null
    const data = await esportsService.overview(asked)
    const focus = data.focus
    const players = focus?.counts?.players ?? 0
    return inertia.render('esports/index', {
      ...data,
      now: Date.now(),
      ...meta({
        title: 'Esports: live matches, leagues and pros in solo queue',
        description: focus
          ? `Pro matches live and next, every league, and the solo queue of ${count(players)} ${focus.league.code} players.`
          : 'Pro matches live and next, every league and the pros in solo queue.',
        path: '/esports',
        image: '/og/pros/all.jpg',
        version: today(),
        alt: 'Esports on invade.lol',
      }),
      robots: asked ? 'noindex,follow' : null,
      jsonld: [breadcrumbs([{ name: 'Esports', path: '/esports' }])],
    })
  }
}
