import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import RiotPuuidAlias, { type AliasStatus } from '#models/riot_puuid_alias'
import { DesktopException } from '#exceptions/desktop_exception'

/**
 * Raw (League client) PUUIDs → API PUUIDs (docs/desktop-sync.md §3).
 *
 * The client and the Riot API encrypt PUUIDs differently, so the two can
 * only be joined through something both sides report: the Riot ID, or the
 * participant slot of a match-v5 game. Every mapping here is free; the one
 * Riot call that settles the rest belongs to the publication policy.
 */

export interface AliasRow {
  rawPuuid: string
  puuid: string
  status: AliasStatus
}

export interface PlayerRow {
  puuid: string
  platform: string
  gameName: string
  tagLine: string
}

export interface IdentityInput {
  participantId: number
  /** Lower case. */
  rawPuuid: string
  gameName: string
  tagLine: string
}

export interface IdentityLookups {
  /** Alias rows of the upload's raw PUUIDs, whatever their status. */
  aliases: AliasRow[]
  /** `riot_player` rows whose Riot ID matches a participant's. */
  players: PlayerRow[]
  /** Alias rows of any raw PUUID claiming one of the candidate API PUUIDs. */
  claims: AliasRow[]
}

export interface IdentityResolution {
  /** Raw → API PUUID for every participant mapped for free. */
  puuids: Map<string, string>
  via: Map<string, 'alias' | 'riot_player'>
  unmapped: string[]
  /** New `asserted` aliases learned from `riot_player`. */
  learned: Array<AliasRow & { gameName: string; tagLine: string }>
  /** Raw PUUIDs whose aliases must be marked `conflict`. */
  conflicts: string[]
}

const usable = (status: AliasStatus) => status === 'verified' || status === 'asserted'
const riotId = (gameName: string, tagLine: string) =>
  `${gameName.toLowerCase()}#${tagLine.toLowerCase()}`

/**
 * The mapping itself, pure. In order: a known alias, then the stored player
 * with the participant's Riot ID at game time. Two raw PUUIDs that land on
 * one API PUUID cannot both be right; neither is used until Riot says which.
 */
export function resolveIdentities(
  identities: IdentityInput[],
  platform: string,
  lookups: IdentityLookups
): IdentityResolution {
  const aliases = new Map(lookups.aliases.map((row) => [row.rawPuuid.toLowerCase(), row]))
  const players = new Map<string, PlayerRow>()
  for (const player of lookups.players) {
    // The game was played on `platform`, so a namesake elsewhere is someone else.
    if (player.platform !== platform) continue
    players.set(riotId(player.gameName, player.tagLine), player)
  }

  const candidates = new Map<
    string,
    { puuid: string; via: 'alias' | 'riot_player'; verified: boolean }
  >()
  const learned: IdentityResolution['learned'] = []
  for (const identity of identities) {
    const alias = aliases.get(identity.rawPuuid)
    if (alias && usable(alias.status)) {
      candidates.set(identity.rawPuuid, {
        puuid: alias.puuid,
        via: 'alias',
        verified: alias.status === 'verified',
      })
      continue
    }
    // A disputed raw PUUID waits for Riot rather than being re-asserted by name.
    if (alias?.status === 'conflict') continue
    const player = players.get(riotId(identity.gameName, identity.tagLine))
    if (!player) continue
    candidates.set(identity.rawPuuid, { puuid: player.puuid, via: 'riot_player', verified: false })
    learned.push({
      rawPuuid: identity.rawPuuid,
      puuid: player.puuid,
      status: 'asserted',
      gameName: identity.gameName,
      tagLine: identity.tagLine,
    })
  }

  const conflicts = new Set<string>()

  // Two participants of one game cannot be the same account.
  const byPuuid = new Map<string, string[]>()
  for (const [raw, candidate] of candidates) {
    byPuuid.set(candidate.puuid, [...(byPuuid.get(candidate.puuid) ?? []), raw])
  }
  for (const raws of byPuuid.values()) {
    if (raws.length > 1) for (const raw of raws) conflicts.add(raw)
  }

  // Nor can another raw PUUID already be that account.
  for (const claim of lookups.claims) {
    if (!usable(claim.status)) continue
    const claimRaw = claim.rawPuuid.toLowerCase()
    for (const [raw, candidate] of candidates) {
      if (candidate.puuid !== claim.puuid || raw === claimRaw) continue
      if (claim.status === 'verified' && !candidate.verified) {
        // Riot already tied that account to another raw PUUID: this claim is the wrong one.
        conflicts.add(raw)
      } else if (candidate.verified && claim.status !== 'verified') {
        conflicts.add(claimRaw)
      } else {
        conflicts.add(raw)
        conflicts.add(claimRaw)
      }
    }
  }

  const puuids = new Map<string, string>()
  const via = new Map<string, 'alias' | 'riot_player'>()
  for (const [raw, candidate] of candidates) {
    if (conflicts.has(raw)) continue
    puuids.set(raw, candidate.puuid)
    via.set(raw, candidate.via)
  }

  return {
    puuids,
    via,
    unmapped: identities.map((i) => i.rawPuuid).filter((raw) => !puuids.has(raw)),
    learned: learned.filter((alias) => !conflicts.has(alias.rawPuuid)),
    conflicts: [...conflicts],
  }
}

class IdentityService {
  /** Maps an upload's participants without calling Riot, and records what it learned. */
  async map(platform: string, identities: IdentityInput[]): Promise<IdentityResolution> {
    const lookups = await this.lookups(identities)
    const resolution = resolveIdentities(identities, platform, lookups)
    await this.persist(resolution)
    return resolution
  }

  async lookups(identities: IdentityInput[]): Promise<IdentityLookups> {
    const raws = identities.map((identity) => identity.rawPuuid)
    const aliases = raws.length
      ? await RiotPuuidAlias.query()
          .select('raw_puuid', 'puuid', 'status')
          .whereIn('raw_puuid', raws)
      : []
    const known = new Set(
      aliases.filter((alias) => alias.status !== 'conflict').map((alias) => alias.rawPuuid)
    )
    const unknown = identities.filter((identity) => !known.has(identity.rawPuuid))

    // `game_name`/`tag_line` are citext, so these comparisons are case-insensitive
    // and served by `riot_player_global_riot_id_idx`.
    const rows = unknown.length
      ? await db
          .from('riot_player')
          .select('puuid', 'platform', 'game_name', 'tag_line')
          .where((query) => {
            for (const identity of unknown) {
              query.orWhere((pair) =>
                pair.where('game_name', identity.gameName).where('tag_line', identity.tagLine)
              )
            }
          })
      : []
    const players: PlayerRow[] = rows.map((row) => ({
      puuid: row.puuid,
      platform: row.platform,
      gameName: row.game_name,
      tagLine: row.tag_line,
    }))

    const candidates = [
      ...new Set([
        ...aliases.map((alias) => alias.puuid),
        ...players.map((player) => player.puuid),
      ]),
    ]
    const claims = candidates.length
      ? await RiotPuuidAlias.query()
          .select('raw_puuid', 'puuid', 'status')
          .whereIn('puuid', candidates)
      : []

    const row = (alias: RiotPuuidAlias): AliasRow => ({
      rawPuuid: alias.rawPuuid,
      puuid: alias.puuid,
      status: alias.status,
    })
    return { aliases: aliases.map(row), players, claims: claims.map(row) }
  }

  async persist(resolution: IdentityResolution) {
    if (resolution.learned.length) {
      await db
        .knexQuery()
        .table('riot_puuid_alias')
        .insert(
          resolution.learned.map((alias) => ({
            raw_puuid: alias.rawPuuid,
            puuid: alias.puuid,
            game_name: alias.gameName,
            tag_line: alias.tagLine,
            status: 'asserted',
            observed_at: new Date(),
          }))
        )
        .onConflict('raw_puuid')
        .ignore()
    }
    await this.markConflicts(resolution.conflicts)
  }

  async markConflicts(raws: string[]) {
    if (!raws.length) return
    await RiotPuuidAlias.query()
      .whereIn('raw_puuid', raws)
      .update({ status: 'conflict', observed_at: new Date() })
  }

  /**
   * Aliases match-v5 confirmed. They overwrite whatever was asserted, and any
   * other raw PUUID still claiming one of these accounts is now known wrong.
   */
  async learnVerified(
    entries: Array<{ rawPuuid: string; puuid: string; gameName: string; tagLine: string }>
  ) {
    if (!entries.length) return
    const now = new Date()
    await db
      .knexQuery()
      .table('riot_puuid_alias')
      .insert(
        entries.map((entry) => ({
          raw_puuid: entry.rawPuuid,
          puuid: entry.puuid,
          game_name: entry.gameName,
          tag_line: entry.tagLine,
          status: 'verified',
          observed_at: now,
        }))
      )
      .onConflict('raw_puuid')
      .merge(['puuid', 'game_name', 'tag_line', 'status', 'observed_at'])

    await RiotPuuidAlias.query()
      .whereIn(
        'puuid',
        entries.map((entry) => entry.puuid)
      )
      .whereNotIn(
        'raw_puuid',
        entries.map((entry) => entry.rawPuuid)
      )
      .whereNot('status', 'verified')
      .update({ status: 'conflict', observed_at: now })
  }

  /**
   * The alias a link asserts (§2.3). A raw PUUID Riot already tied to another
   * account means the Riot ID given is not the one signed in to the client.
   */
  async assertFromLink(rawPuuid: string, puuid: string, gameName: string, tagLine: string) {
    const raw = rawPuuid.toLowerCase()
    const [existing, claims] = await Promise.all([
      RiotPuuidAlias.find(raw),
      RiotPuuidAlias.query().where('puuid', puuid).whereNot('raw_puuid', raw),
    ])
    const verifiedElsewhere = claims.some((claim) => claim.status === 'verified')
    if ((existing?.status === 'verified' && existing.puuid !== puuid) || verifiedElsewhere) {
      throw new DesktopException(
        'This Riot ID belongs to another account than the one signed in',
        422,
        'E_RIOT_ID_MISMATCH'
      )
    }

    if (existing?.puuid === puuid) {
      existing.merge({ gameName, tagLine, observedAt: DateTime.now() })
      await existing.save()
    } else {
      await RiotPuuidAlias.updateOrCreate(
        { rawPuuid: raw },
        { puuid, gameName, tagLine, status: 'asserted', observedAt: DateTime.now() }
      )
    }

    const disputed = claims.filter((claim) => claim.status === 'asserted').map((c) => c.rawPuuid)
    if (disputed.length) await this.markConflicts([raw, ...disputed])
  }
}

export default new IdentityService()
