import { positionName, positionOf, queueName } from '@invadelol/ui/logic'
import matchRepository from '#services/analytics/match_repository'
import riotAssets from '#services/riot/assets'
import { matchCardVersion, type MatchCard } from '#services/match_card'
import { SITE_ORIGIN } from '#services/sitemap'
import { decodeSlug } from '../../inertia/lib/format.js'
import { detailOf, isRemake, scoreLobby } from '../../inertia/lib/match.js'
import type { Match } from '../../inertia/lib/types.js'

/** What the match page's meta tags say (resources/views/inertia_layout.edge). */
export interface MatchSocial {
  type: 'website'
  title: string
  description: string
  url: string
  canonical: string
  image: string
  imageType: 'image/jpeg'
  alt: string
}

/** One player's game, shareable: the card's facts, its version, and the page's meta tags. */
export interface MatchShare {
  card: MatchCard
  version: string
  social: MatchSocial
}

/** Arena's queues and map: its placement is not stored, so no card says "2nd place" yet. */
const ARENA_QUEUES = [1700, 1710, 1750]
const ARENA_MAP = 30

const MATCH_ID = /^[A-Z0-9]+_[0-9]+$/

/** `32:18`. */
function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * The share of the player whose Riot ID is `summoner` (the route's `Name-Tag`, compared as the
 * match page finds its owner) in a stored game. Null when nobody in it has that Riot ID, when
 * the player has no Riot ID, for a remake or an Arena game, and for a player with no score (AFK).
 * The score and MVP / ACE are the page's own (`scoreLobby`, `detailOf`).
 */
export function shareOf(
  match: Match,
  summoner: string,
  champions: Record<string, string> = {}
): MatchShare | null {
  if (isRemake(match)) return null
  if (ARENA_QUEUES.includes(Number(match.queueId)) || Number(match.mapId) === ARENA_MAP) return null
  const slug = decodeSlug(summoner)
  const player = match.participants.find(
    (p) => p.gameName && p.tagLine && `${p.gameName}-${p.tagLine}` === slug
  )
  if (!player) return null
  const score = scoreLobby(match)[player.puuid]?.score
  if (score === undefined) return null
  const badges = detailOf(match).players.find((p) => p.puuid === player.puuid)?.badges ?? []
  const tag = badges.includes('mvp') ? 'MVP' : badges.includes('ace') ? 'ACE' : ''
  const queueId = Number(match.queueId)
  const win = Boolean(player.win)
  const card: MatchCard = {
    championId: Number(player.championId),
    win,
    // As the match row names it.
    queue: queueId === 420 ? 'Ranked Solo' : queueName(queueId),
    duration: Number(match.duration) || 0,
    kills: Number(player.kills) || 0,
    deaths: Number(player.deaths) || 0,
    assists: Number(player.assists) || 0,
    score,
    tag,
  }
  const version = matchCardVersion(card)

  const riotId = `${player.gameName}#${player.tagLine}`
  const path = encodeURIComponent(`${player.gameName}-${player.tagLine}`)
  const result = win ? 'Victory' : 'Defeat'
  const champion = champions[String(card.championId)]
  const kda = `${card.kills}/${card.deaths}/${card.assists}`
  const role = positionName(positionOf(player.position))
  const facts = [role, queueName(queueId), clock(card.duration)].filter(Boolean).join(', ')
  const url = `${SITE_ORIGIN}/${path}/match/${match.matchId}`
  return {
    card,
    version,
    social: {
      type: 'website',
      title: `${riotId} · ${result}${champion ? ` on ${champion}` : ''}`,
      description: `${kda}, Invade score ${score}${tag ? `, ${tag}` : ''}. ${facts}.`,
      url,
      canonical: url,
      image: `${SITE_ORIGIN}/og/match/${match.matchId}/${path}.jpg?v=${version}`,
      imageType: 'image/jpeg',
      alt: `${result}${champion ? ` on ${champion}` : ''}: ${kda}, Invade score ${score}${tag ? `, ${tag}` : ''}`,
    },
  }
}

/** A stored game is read again after this; an unknown one sooner, as it may be stored by then. */
const FOUND_MS = 10 * 60 * 1000
const MISSING_MS = 60 * 1000
const MAX_MATCHES = 512

/**
 * The match page's meta tags and its share image read one light copy of a game (no timeline),
 * kept per match for ten minutes, so a link pasted in a busy channel costs one read.
 */
export class MatchShareService {
  private matches = new Map<string, { expires: number; match: Promise<Match | null> }>()

  constructor(private now = Date.now) {}

  /** The stored game, without timeline nor events. Concurrent misses share one read. */
  match(matchId: string): Promise<Match | null> {
    if (!MATCH_ID.test(matchId)) return Promise.resolve(null)
    const hit = this.matches.get(matchId)
    if (hit && hit.expires > this.now()) return hit.match
    this.matches.delete(matchId)
    if (this.matches.size >= MAX_MATCHES) this.matches.delete(this.matches.keys().next().value!)
    const entry = { expires: this.now() + FOUND_MS, match: Promise.resolve<Match | null>(null) }
    entry.match = (matchRepository.getSummaryById(matchId) as Promise<Match | null>).then(
      (match) => {
        if (!match) entry.expires = this.now() + MISSING_MS
        return match
      },
      (error) => {
        // A failed read is never kept.
        if (this.matches.get(matchId) === entry) this.matches.delete(matchId)
        throw error
      }
    )
    this.matches.set(matchId, entry)
    return entry.match
  }

  /** `summoner`'s share of the game `matchId`, or null (see `shareOf`). */
  async find(matchId: string, summoner: string): Promise<MatchShare | null> {
    const match = await this.match(matchId)
    if (!match) return null
    const champions = await riotAssets.names('champion').catch(() => ({}))
    return shareOf(match, summoner, champions)
  }

  /** Forgets every kept game (tests). */
  clear() {
    this.matches.clear()
  }
}

export default new MatchShareService()
