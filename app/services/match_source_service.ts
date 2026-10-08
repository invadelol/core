import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import MatchSource, {
  type Completeness,
  type MatchOrigin,
  type Verification,
} from '#models/match_source'

export interface Provenance {
  source: MatchOrigin
  verification: Verification
  /** Null when nothing is known to be missing, as for every match stored before this table. */
  completeness: Completeness | null
}

/** What a match without a `match_source` row is: it predates desktop uploads and came from Riot. */
export const RIOT_PROVENANCE: Provenance = {
  source: 'riot',
  verification: 'verified',
  completeness: null,
}

/**
 * Who stored a match in ClickHouse, how far it is trusted, and what it lacks
 * (docs/desktop-sync.md §4.2).
 *
 * The row doubles as the single-writer lock for ingestion. ClickHouse's
 * tables are plain MergeTree, so the web sync and the desktop pipeline must
 * never both insert the same game: whoever's insert here returns a row
 * ingests, everyone else treats the match as already stored.
 */
class MatchSourceService {
  async claim(
    matchId: string,
    row: {
      source: MatchOrigin
      verification: Verification
      completeness: Completeness
      firstDeviceId?: string | null
    }
  ): Promise<boolean> {
    const inserted = await db
      .knexQuery()
      .table('match_source')
      .insert({
        match_id: matchId,
        source: row.source,
        verification: row.verification,
        completeness: JSON.stringify(row.completeness),
        first_device_id: row.firstDeviceId ?? null,
        created_at: new Date(),
        verified_at: row.verification === 'verified' ? new Date() : null,
      })
      .onConflict('match_id')
      .ignore()
      .returning('match_id')
    return inserted.length > 0
  }

  /** Gives the lock back when the ingestion it guarded failed before writing anything. */
  async release(matchId: string) {
    await db.from('match_source').where('match_id', matchId).delete()
  }

  async find(matchId: string) {
    return MatchSource.find(matchId)
  }

  async update(
    matchId: string,
    changes: { verification?: Verification; completeness?: Completeness },
    onlyFrom?: Verification[]
  ) {
    const query = db.from('match_source').where('match_id', matchId)
    if (onlyFrom) query.whereIn('verification', onlyFrom)
    return query.update({
      ...(changes.verification ? { verification: changes.verification } : {}),
      ...(changes.verification === 'verified' ? { verified_at: new Date() } : {}),
      ...(changes.completeness ? { completeness: JSON.stringify(changes.completeness) } : {}),
    })
  }

  /** Provenance for a page of matches, with the LP change of `puuid` where one was accepted. */
  async describe(matchIds: string[], puuid?: string) {
    const sources = new Map<string, Provenance>()
    const lp = new Map<string, number>()
    if (!matchIds.length) return { sources, lp }

    const [rows, changes] = await Promise.all([
      db
        .from('match_source')
        .select('match_id', 'source', 'verification', 'completeness')
        .whereIn('match_id', matchIds),
      puuid
        ? db
            .from('lp_change')
            .select('match_id', 'delta')
            .where('puuid', puuid)
            .whereIn('match_id', matchIds)
            .where('status', 'accepted')
        : Promise.resolve([]),
    ])
    for (const row of rows) {
      sources.set(row.match_id, {
        source: row.source,
        verification: row.verification,
        completeness: row.completeness ?? null,
      })
    }
    for (const row of changes) lp.set(row.match_id, Number(row.delta))
    return { sources, lp }
  }

  /**
   * Adds `source`, `verification`, `completeness` and, for match lists,
   * `lpChange` to matches read from ClickHouse. A disputed game shows no LP.
   * A Postgres hiccup degrades to Riot defaults rather than failing the page.
   */
  async decorate<T extends { matchId: string }>(matches: T[], puuid?: string) {
    let described: Awaited<ReturnType<MatchSourceService['describe']>>
    try {
      described = await this.describe(
        matches.map((match) => match.matchId),
        puuid
      )
    } catch (error) {
      logger.warn({ err: error }, 'match provenance unavailable')
      described = { sources: new Map(), lp: new Map() }
    }
    return matches.map((match) => {
      const provenance = described.sources.get(match.matchId) ?? RIOT_PROVENANCE
      const lpChange =
        provenance.verification === 'conflict' ? null : (described.lp.get(match.matchId) ?? null)
      return Object.assign(match, provenance, puuid === undefined ? {} : { lpChange })
    })
  }
}

export default new MatchSourceService()
