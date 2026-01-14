import type { HttpContext } from '@adonisjs/core/http'

import matchRepository from '#services/analytics/match_repository'
import { matchIdParamsValidator } from '#validators/match'

export default class MatchesController {
  /**
   * Get match details by id (heavy, on-demand).
   *
   * This endpoint is intended to be called when the user expands a match row.
   * It includes timeline data, which is intentionally excluded from the match list.
   */
  async show({ request, params, response }: HttpContext) {
    await request.validateUsing(matchIdParamsValidator, { data: params })

    const match = await matchRepository.getById(params.id)
    if (!match) {
      return response.notFound({ message: 'Match not found' })
    }

    return response.ok(match)
  }
}

