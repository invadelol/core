import type { HttpContext } from '@adonisjs/core/http'

import matchRepository from '#services/analytics/match_repository'
import matchSourceService from '#services/match_source_service'
import matchesService from '#services/matches_service'
import { matchIdParamsValidator } from '#validators/match'

export default class MatchesController {
  /**
   * Get match details by id (heavy, on-demand).
   *
   * This endpoint is intended to be called when the user expands a match row.
   * It includes timeline data and events, which are intentionally excluded from the match list.
   */
  async show({ request, params, response }: HttpContext) {
    await request.validateUsing(matchIdParamsValidator, { data: params })

    // Provenance travels with the match, so the page can say where a game came
    // from and hide what a desktop upload could not know. It needs nothing but
    // the id, so it is read alongside the match rather than after it.
    const [stored, [provenance]] = await Promise.all([
      matchRepository.getById(params.id),
      matchSourceService.decorate([{ matchId: params.id }]),
    ])
    let match = stored
    if (!match) {
      return response.notFound({ message: 'Match not found' })
    }

    // Stored before kills and objectives were kept: fetch them once, now that someone looks.
    if (!match.events.length && match.timeline.length && match.duration >= 300) {
      if (await matchesService.backfillEvents(match)) {
        match = (await matchRepository.getById(params.id)) ?? match
      }
    }

    return response.ok(Object.assign(match, provenance))
  }
}
