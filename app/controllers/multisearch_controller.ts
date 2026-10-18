import type { HttpContext } from '@adonisjs/core/http'
import {
  multisearchPath,
  parseRiotIds,
  MULTISEARCH_REGIONS,
} from '../../inertia/lib/multisearch.js'

const DESCRIPTION =
  'Scout a whole lobby at once: rank, recent games, roles and champions of every player side by side.'

export default class MultisearchController {
  /**
   * `/multisearch/:region?summoners=Name#TAG,Name#TAG`: the players are read from the address here
   * so the page draws their cards from its first paint; each card then loads its own player. An
   * unknown region is dropped rather than refused, so an op.gg link with ours swapped in still works.
   */
  async show({ inertia, params, request, response }: HttpContext) {
    const raw = String(params.region ?? '').toLowerCase()
    const region = (MULTISEARCH_REGIONS as readonly string[]).includes(raw) ? raw : null
    if (raw && !region) {
      return response.redirect(multisearchPath(this.players(request), null), false, 302)
    }

    // The players come from the site's search (Riot IDs separated by commas): with none, there
    // is nothing to show here.
    const players = this.players(request)
    if (!players.length) return response.redirect('/', false, 302)

    return inertia.render('multisearch', {
      players,
      region,
      description: DESCRIPTION,
    })
  }

  private players(request: HttpContext['request']) {
    const value = request.input('summoners', '')
    return parseRiotIds(Array.isArray(value) ? value.join(',') : String(value))
  }
}
