import type { HttpContext } from '@adonisjs/core/http'

import matchRepository from '#services/analytics/match_repository'
import matchSourceService from '#services/match_source_service'
import matchesService from '#services/matches_service'
import pendingMatches from '#services/pending_matches'
import { matchIdParamsValidator } from '#validators/match'

/** A stored match and where it came from. */
async function read(matchId: string) {
  // Provenance travels with the match, so the page can say where a game came from and hide what a
  // desktop upload could not know. It needs nothing but the id, so it is read alongside the match.
  const [match, [provenance]] = await Promise.all([
    matchRepository.getById(matchId),
    matchSourceService.decorate([{ matchId }]),
  ])
  return match ? { match, provenance } : null
}

export default class MatchesController {
  /**
   * Get match details by id (heavy, on-demand).
   *
   * This endpoint is intended to be called when the user expands a match row.
   * It includes timeline data and events, which are intentionally excluded from the match list.
   *
   * A match that is not stored (most often a game that just ended: Riot publishes it minutes
   * later) is queued to be fetched from Riot in the background, and the answer is 202 with
   * `Retry-After` until it is stored. 404 once Riot did not give it. Neither is ever cached.
   * @paramPath id - Match id (EUW1_7998180573)
   * @responseBody 200 - <Match>
   * @responseBody 202 - {"status": "pending", "matchId": "EUW1_7998180573", "retryAfter": 5}
   * @responseBody 404 - {"message": "Match not found"}
   * @responseHeader 202 - Retry-After - Seconds before asking again
   */
  async show({ request, params, response }: HttpContext) {
    await request.validateUsing(matchIdParamsValidator, { data: params })
    const matchId: string = params.id

    let found = await read(matchId)
    if (!found) {
      // Whatever comes next, this answer changes soon: no cache may keep it.
      response.header('Cache-Control', 'no-store')
      // Stored but never shown (a Brawl or League Classic game), or stored a moment ago.
      const stored = await matchRepository.getExistingIds([matchId])
      if (stored.has(matchId)) {
        found = await read(matchId)
        if (!found) return response.notFound({ message: 'Match not found' })
      } else {
        const answer = await pendingMatches.request(matchId, request.ip())
        if (answer.status === 'missing') return response.notFound({ message: 'Match not found' })
        response.header('Retry-After', String(answer.retryAfter))
        return response
          .status(202)
          .send({ status: 'pending', matchId, retryAfter: answer.retryAfter })
      }
    }
    let { match } = found
    const { provenance } = found

    // A Riot game without its frames (the timeline failed to store) or without its kills,
    // objectives or shop actions (stored before they were kept): fetch what is missing once, now
    // that someone looks. A desktop upload's timeline is the client's own, never patched with Riot's.
    const riot = provenance.source === 'riot'
    const frames = !match.timeline.length && riot
    const events =
      (!match.events.length || (riot && !match.shop.length)) &&
      (frames || match.timeline.length > 0)
    if ((frames || events) && match.duration >= 300) {
      if (await matchesService.backfillTimeline(match, { frames, events })) {
        match = (await matchRepository.getById(matchId)) ?? match
      }
    }

    return response.ok(Object.assign(match, provenance))
  }
}
