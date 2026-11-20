import type { HttpContext } from '@adonisjs/core/http'
import esportsService from '#services/esports_service'
import esportsLandingService from '#services/esports_landing_service'
import { breadcrumbs, meta, today } from '#services/page_meta'

/**
 * The esports overview (`/esports`): the best pro of each league in solo queue, the match on now
 * or next (between seasons the last champion), who climbed today, the roster moves and the games.
 */
export default class EsportsController {
  async index({ inertia }: HttpContext) {
    const [data, leaders, event, climbers, moves] = await Promise.all([
      esportsService.overview(),
      esportsLandingService.leaders().catch(() => []),
      esportsLandingService.lastEvent(),
      esportsLandingService.climbers(5),
      esportsLandingService.moves(8),
    ])
    return inertia.render('esports/index', {
      ...data,
      leaders,
      event,
      climbers,
      moves,
      ...meta({
        title: 'Esports: live matches, leagues and pros in solo queue',
        description:
          'The best pro of each league in solo queue, pro matches live and next, the last champions and the roster moves.',
        path: '/esports',
        image: '/og/esports.jpg',
        version: today(),
        alt: 'The match on now or next, its two team logos face to face (else the leagues’ logos), with the hype poro',
      }),
      jsonld: [breadcrumbs([{ name: 'Esports', path: '/esports' }])],
    })
  }
}
