import matchRepository from '#services/analytics/match_repository'
import matchSourceService from '#services/match_source_service'
import { synergyReport, type SynergyReport } from '../../inertia/lib/synergy.js'
import type { Match } from '../../inertia/lib/types.js'

/**
 * How many of a player's latest stored games the friends page reads. Wide enough that a duo
 * partner's record means something, small enough to score every lobby in a few milliseconds.
 */
export const SYNERGY_WINDOW = 300

/**
 * The friends page (inertia/lib/synergy.ts): who a player queues with and what it does to their
 * games, computed here from their stored games rather than in the browser, which would need every
 * one of them downloaded with all ten players.
 */
class SynergyService {
  async report(puuid: string): Promise<SynergyReport> {
    const matches = (await matchRepository.getByPuuid(puuid, {
      view: 'summary',
      count: SYNERGY_WINDOW,
    })) as Match[]
    return synergyReport(matches, puuid)
  }

  /** The games two players played on the same side, newest first, with where each came from. */
  async together(puuid: string, matePuuid: string, page: { count: number; offset: number }) {
    const matches = await matchRepository.getTogether(puuid, matePuuid, page)
    return matchSourceService.decorate(matches, puuid)
  }
}

export default new SynergyService()
