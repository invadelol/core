import { positionName, positionOf } from '@invadelol/ui/logic'
import { isRemake, killParticipation, scoreLobby, teamTotals } from './match.js'
import type { Match, Participant } from './types.js'

/* ── Who someone plays with, and what it does to their games ──────

   Read from the player's own latest games, where every teammate, seat,
   pick and result is already stored: the server runs this over a wide
   window (services/synergy_service.ts) and the page only draws it.

   A friend is a teammate seen in a fair share of the games. Solo queue
   puts the same stranger on your team now and then (often, in a small
   region or at a high rank), so a few games together are "occasional":
   a regular takes at least 3 % of the sample (and three games), a duo
   partner 8 % (and six).

   Synergy is honest about sample size. The win rate together is pulled
   toward the player's own win rate without that friend by SYNERGY_PRIOR
   imaginary games (a Bayesian average), and the gap that is left is the
   synergy. Two wins in two games end up a few points above the player's
   usual rate, not at 100 %; forty games at 62 % keep most of their edge.
   ─────────────────────────────────────────────────────────────── */

/** Imaginary games at the player's usual win rate added to every duo's record. */
export const SYNERGY_PRIOR = 20
/** The same for an average score, which swings less from game to game than a result. */
const SCORE_PRIOR = 8
/** Games together before a teammate is listed at all. */
const PARTNER_MIN = 2
/** A regular, a friend rather than a coincidence: this many games together, and this share. */
const FRIEND_MIN = 3
const FRIEND_SHARE = 0.03
/** A duo partner. */
const DUO_MIN = 6
const DUO_SHARE = 0.08
/** The most teammates a report lists, most games first. */
const PARTNER_LIMIT = 40
/** The same friends together this many times are a premade group. */
const GROUP_MIN = 3
const GROUP_LIMIT = 6
/** Seats and picks taken fewer times than this are not shown: a 2–0 pair is not a best pair. */
export const SAMPLE_MIN = 3
/** Without at least this many games apart, the player's overall win rate is the baseline. */
const APART_MIN = 10

export type Confidence = 'low' | 'fair' | 'solid'
export type Tier = 'duo' | 'regular' | 'occasional'

/** How far a record can be read: under five games it is a hint, from fifteen it holds. */
export function confidenceOf(games: number): Confidence {
  return games < 5 ? 'low' : games < 15 ? 'fair' : 'solid'
}

/** A rate of `wins` over `games`, pulled toward `baseline` by `prior` imaginary games. */
export function shrink(wins: number, games: number, baseline: number, prior = SYNERGY_PRIOR) {
  return (wins + prior * baseline) / (games + prior)
}

export interface Tally {
  games: number
  wins: number
}

export interface Identity {
  puuid: string
  gameName: string
  tagLine: string
  profileIconId: number
}

/** Two seats taken in the same games, this player's first. */
export interface RolePair extends Tally {
  mine: string
  theirs: string
}

/** Two champions picked together, this player's first. */
export interface ChampionPair extends Tally {
  mine: number
  theirs: number
}

/** This player's own averages over a set of games. */
export interface Form {
  games: number
  /** Average Invade score; null when none of the games was scored. */
  score: number | null
  kda: number
  /** Kill participation, 0–100. */
  kp: number
  deaths: number
}

/** One game together. */
export interface DuoPoint {
  t: number
  win: boolean
  /** This player's score in it. */
  score: number | null
}

export interface Partner extends Identity, Tally {
  tier: Tier
  firstMs: number
  lastMs: number
  /** Win rate together minus the baseline, in points, after the pull toward the baseline. */
  synergy: number
  /** The player's win rate without them (0–1): what the synergy is measured against. */
  baseline: number
  confidence: Confidence
  /** The usual seats: this player's, theirs. Empty in modes without lanes. */
  myRole: string
  theirRole: string
  /** The seats they took at least SAMPLE_MIN times, most games first. */
  roles: RolePair[]
  /** Picks played together at least SAMPLE_MIN times, best first (see `ranked`). */
  champions: ChampionPair[]
  /** Their most played champions beside this player. */
  theirChampions: number[]
  /** The player's form beside them; the score is pulled toward their usual one. */
  together: Form
  /** Null when every game of the sample was with them. */
  apart: Form | null
  /** Their own average score in the games together. */
  theirScore: number | null
  /** Oldest first. */
  series: DuoPoint[]
}

export interface Group extends Tally {
  members: Identity[]
  lastMs: number
  /** As a partner's: the group's win rate against the player's usual one, pulled toward it. */
  synergy: number
  confidence: Confidence
}

export interface SynergyReport {
  /** The sample: games that count (no customs, no remakes). */
  games: number
  wins: number
  firstMs: number
  lastMs: number
  /** Games with at least one friend on the team, and the rest. */
  friends: Tally & { score: number | null }
  alone: Tally & { score: number | null }
  /** Most games together first. */
  partners: Partner[]
  groups: Group[]
  /** Games together that make a regular and a duo partner in this sample. */
  thresholds: { regular: number; duo: number }
}

/* ── Accumulators ──────────────────────────────────────────────── */

/** One of this player's games, read once. */
interface GameRead {
  t: number
  win: boolean
  score: number | null
  kills: number
  deaths: number
  assists: number
  kp: number
  role: string
  champion: number
  mates: Participant[]
  scores: Record<string, { score: number }>
}

interface FormDraft {
  games: number
  scored: number
  score: number
  kills: number
  deaths: number
  assists: number
  kp: number
}

const emptyForm = (): FormDraft => ({
  games: 0,
  scored: 0,
  score: 0,
  kills: 0,
  deaths: 0,
  assists: 0,
  kp: 0,
})

function addForm(form: FormDraft, game: GameRead) {
  form.games++
  if (game.score !== null) {
    form.scored++
    form.score += game.score
  }
  form.kills += game.kills
  form.deaths += game.deaths
  form.assists += game.assists
  form.kp += game.kp
}

function minus(a: FormDraft, b: FormDraft): FormDraft {
  return {
    games: a.games - b.games,
    scored: a.scored - b.scored,
    score: a.score - b.score,
    kills: a.kills - b.kills,
    deaths: a.deaths - b.deaths,
    assists: a.assists - b.assists,
    kp: a.kp - b.kp,
  }
}

function readForm(form: FormDraft): Form {
  return {
    games: form.games,
    score: form.scored ? form.score / form.scored : null,
    kda: (form.kills + form.assists) / Math.max(1, form.deaths),
    kp: form.games ? form.kp / form.games : 0,
    deaths: form.games ? form.deaths / form.games : 0,
  }
}

function bump<K>(counts: Map<K, Tally>, key: K, win: boolean) {
  const tally = counts.get(key) ?? { games: 0, wins: 0 }
  tally.games++
  if (win) tally.wins++
  counts.set(key, tally)
}

function count<K>(counts: Map<K, number>, key: K) {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

function most(counts: Map<string, number>) {
  let best = ''
  let top = 0
  for (const [key, value] of counts) {
    if (value > top) {
      top = value
      best = key
    }
  }
  return best
}

/** Imaginary games at the player's usual rate when picks are ranked against each other. */
const PICK_PRIOR = 10

/**
 * Best first, by the win rate pulled toward the player's usual one: a 2–0 pair ranks below a
 * 14–8 one, and only a longer perfect run (5–0) can pass it.
 */
export function ranked<T extends Tally>(rows: T[], baseline: number) {
  const rate = (row: T) => shrink(row.wins, row.games, baseline, PICK_PRIOR)
  return rows.sort((a, b) => rate(b) - rate(a) || b.games - a.games)
}

const byGames = <T extends Tally>(a: T, b: T) => b.games - a.games || b.wins - a.wins

interface PartnerDraft {
  identity: Identity
  games: number
  wins: number
  firstMs: number
  lastMs: number
  form: FormDraft
  myRoles: Map<string, number>
  theirRoles: Map<string, number>
  roles: Map<string, Tally>
  champions: Map<string, Tally>
  theirChampions: Map<number, number>
  theirScored: number
  theirScore: number
  series: DuoPoint[]
}

function readGames(matches: Match[], puuid: string) {
  const games: GameRead[] = []
  for (const match of matches) {
    if (!match.queueId || isRemake(match)) continue
    const me = match.participants.find((p) => p.puuid === puuid)
    if (!me) continue
    const scores = scoreLobby(match)
    games.push({
      t: Number(match.gameStartMs) || 0,
      win: Boolean(me.win),
      score: scores[puuid]?.score ?? null,
      kills: me.kills || 0,
      deaths: me.deaths || 0,
      assists: me.assists || 0,
      kp: killParticipation(me, teamTotals(match)),
      role: me.position || '',
      champion: me.championId,
      mates: match.participants.filter(
        (p) => p.teamId === me.teamId && p.puuid && p.puuid !== puuid
      ),
      scores,
    })
  }
  return games.sort((a, b) => a.t - b.t)
}

/**
 * Everything the friends page shows, from one player's games (in any order). Customs and remakes
 * are left out: neither is a game anyone played to win.
 */
export function synergyReport(matches: Match[], puuid: string): SynergyReport {
  const games = readGames(matches, puuid)
  const overall = emptyForm()
  let wins = 0
  const drafts = new Map<string, PartnerDraft>()

  for (const game of games) {
    addForm(overall, game)
    if (game.win) wins++
    for (const mate of game.mates) {
      let draft = drafts.get(mate.puuid)
      if (!draft) {
        draft = {
          identity: { puuid: mate.puuid, gameName: '', tagLine: '', profileIconId: 0 },
          games: 0,
          wins: 0,
          firstMs: game.t,
          lastMs: game.t,
          form: emptyForm(),
          myRoles: new Map(),
          theirRoles: new Map(),
          roles: new Map(),
          champions: new Map(),
          theirChampions: new Map(),
          theirScored: 0,
          theirScore: 0,
          series: [],
        }
        drafts.set(mate.puuid, draft)
      }
      // Oldest first, so the latest Riot ID and icon are the ones kept.
      if (mate.gameName) {
        draft.identity.gameName = mate.gameName
        draft.identity.tagLine = mate.tagLine
      }
      if (mate.profileIconId) draft.identity.profileIconId = mate.profileIconId
      draft.games++
      if (game.win) draft.wins++
      draft.lastMs = game.t
      addForm(draft.form, game)
      if (game.role && mate.position) {
        count(draft.myRoles, game.role)
        count(draft.theirRoles, mate.position)
        bump(draft.roles, `${game.role}:${mate.position}`, game.win)
      }
      bump(draft.champions, `${game.champion}:${mate.championId}`, game.win)
      count(draft.theirChampions, mate.championId)
      const theirs = game.scores[mate.puuid]?.score
      if (theirs !== undefined) {
        draft.theirScored++
        draft.theirScore += theirs
      }
      draft.series.push({ t: game.t, win: game.win, score: game.score })
    }
  }

  const total = games.length
  const overallRate = total ? wins / total : 0.5
  const friendMin = Math.max(FRIEND_MIN, Math.ceil(total * FRIEND_SHARE))
  const duoMin = Math.max(DUO_MIN, Math.ceil(total * DUO_SHARE))

  const partners: Partner[] = [...drafts.values()]
    .filter((draft) => draft.games >= PARTNER_MIN)
    .sort((a, b) => b.games - a.games || b.lastMs - a.lastMs)
    .slice(0, PARTNER_LIMIT)
    .map((draft) => {
      const apartGames = total - draft.games
      const baseline = apartGames >= APART_MIN ? (wins - draft.wins) / apartGames : overallRate
      const together = readForm(draft.form)
      const apart = apartGames ? readForm(minus(overall, draft.form)) : null
      const tier: Tier =
        draft.games >= duoMin ? 'duo' : draft.games >= friendMin ? 'regular' : 'occasional'
      return {
        ...draft.identity,
        games: draft.games,
        wins: draft.wins,
        tier,
        firstMs: draft.firstMs,
        lastMs: draft.lastMs,
        synergy: (shrink(draft.wins, draft.games, baseline) - baseline) * 100,
        baseline,
        confidence: confidenceOf(draft.games),
        myRole: most(draft.myRoles),
        theirRole: most(draft.theirRoles),
        roles: [...draft.roles.entries()]
          .map(([key, tally]) => {
            const [mine, theirs] = key.split(':')
            return { mine, theirs, ...tally }
          })
          .filter((pair) => pair.games >= SAMPLE_MIN)
          .sort(byGames)
          .slice(0, 6),
        champions: ranked(
          [...draft.champions.entries()]
            .map(([key, tally]) => {
              const [mine, theirs] = key.split(':').map(Number)
              return { mine, theirs, ...tally }
            })
            .filter((pair) => pair.games >= SAMPLE_MIN),
          baseline
        ).slice(0, 6),
        theirChampions: [...draft.theirChampions.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([id]) => id),
        together: {
          ...together,
          score:
            together.score !== null && apart && apart.score !== null
              ? (draft.form.score + SCORE_PRIOR * apart.score) / (draft.form.scored + SCORE_PRIOR)
              : together.score,
        },
        apart,
        theirScore: draft.theirScored ? draft.theirScore / draft.theirScored : null,
        series: draft.series,
      }
    })

  /* Games with a friend against games without one, and the groups that queued together. */
  const friendIds = new Set(
    [...drafts.values()].filter((d) => d.games >= friendMin).map((d) => d.identity.puuid)
  )
  const withFriends = emptyForm()
  let friendWins = 0
  const groups = new Map<string, Omit<Group, 'synergy' | 'confidence'>>()
  for (const game of games) {
    const friends = game.mates.filter((mate) => friendIds.has(mate.puuid))
    if (!friends.length) continue
    addForm(withFriends, game)
    if (game.win) friendWins++
    if (friends.length < 2) continue
    const key = friends
      .map((mate) => mate.puuid)
      .sort()
      .join('|')
    const group = groups.get(key) ?? {
      members: friends
        .map((mate) => drafts.get(mate.puuid)!)
        .sort((a, b) => b.games - a.games)
        .map((draft) => draft.identity),
      games: 0,
      wins: 0,
      lastMs: 0,
    }
    group.games++
    if (game.win) group.wins++
    group.lastMs = game.t
    groups.set(key, group)
  }
  const alone = minus(overall, withFriends)

  return {
    games: total,
    wins,
    firstMs: games[0]?.t ?? 0,
    lastMs: games[total - 1]?.t ?? 0,
    friends: { games: withFriends.games, wins: friendWins, score: readForm(withFriends).score },
    alone: { games: alone.games, wins: wins - friendWins, score: readForm(alone).score },
    partners,
    groups: [...groups.values()]
      .filter((group) => group.games >= GROUP_MIN)
      .sort((a, b) => b.games - a.games || b.lastMs - a.lastMs)
      .slice(0, GROUP_LIMIT)
      .map((group) => ({
        ...group,
        synergy: (shrink(group.wins, group.games, overallRate) - overallRate) * 100,
        confidence: confidenceOf(group.games),
      })),
    thresholds: { regular: friendMin, duo: duoMin },
  }
}

/** "Mid", "Jungle"…, or an empty string in a mode without lanes. */
export function roleLabel(role: string) {
  return role ? positionName(positionOf(role)) || role : ''
}

/**
 * The duo's form at each game together, oldest first: the win rate over the last `window` games,
 * pulled toward the baseline by `prior` games so the first points start calm rather than at 0 or
 * 100 %.
 */
export function rollingForm(series: DuoPoint[], baseline: number, window = 10, prior = 4) {
  return series.map((_, index) => {
    const from = Math.max(0, index - window + 1)
    let won = 0
    for (let i = from; i <= index; i++) if (series[i].win) won++
    return shrink(won, index - from + 1, baseline, prior)
  })
}

/* ── Compare ───────────────────────────────────────────────────────
   The Compare section reads one teammate's record out of a match list
   it already holds (both players' latest games), with lane names.
   ─────────────────────────────────────────────────────────────── */

/** The lane partnerships that mean something in Summoner's Rift. */
const PAIRS: Array<{ id: string; label: string; roles: [string, string] }> = [
  { id: 'bot', label: 'Bot lane', roles: ['BOTTOM', 'UTILITY'] },
  { id: 'mid-jungle', label: 'Mid + jungle', roles: ['MIDDLE', 'JUNGLE'] },
  { id: 'top-jungle', label: 'Top + jungle', roles: ['TOP', 'JUNGLE'] },
  { id: 'bot-jungle', label: 'Bot + jungle', roles: ['BOTTOM', 'JUNGLE'] },
  { id: 'sup-jungle', label: 'Support + jungle', roles: ['UTILITY', 'JUNGLE'] },
  { id: 'sup-mid', label: 'Support roam', roles: ['UTILITY', 'MIDDLE'] },
]

export function pairingFor(mine: string, theirs: string) {
  if (!mine || !theirs) return null
  return (
    PAIRS.find(
      (pair) =>
        (pair.roles[0] === mine && pair.roles[1] === theirs) ||
        (pair.roles[1] === mine && pair.roles[0] === theirs)
    ) ?? null
  )
}

export interface Mate {
  puuid: string
  gameName: string
  tagLine: string
  games: number
  wins: number
  winrate: number
  /** Their most common role beside this player. */
  role: string
  /** The player's own most common role in those games. */
  myRole: string
  /** The named lane partnership, when there is one. */
  pairing: { id: string; label: string } | null
  /** Win rate across every game where this teammate was absent. */
  soloWinrate: number
  /** How much better or worse this player does with them, in points.
   *  Null when they were in every game, leaving nothing to compare against. */
  lift: number | null
}

export function teammatesFrom(matches: Match[], puuid: string, minimum = 2): Mate[] {
  interface Draft {
    p: Participant
    games: number
    wins: number
    roles: Map<string, number>
    myRoles: Map<string, number>
  }

  const drafts = new Map<string, Draft>()
  let ownGames = 0
  let ownWins = 0

  for (const match of matches) {
    const me = match.participants.find((x) => x.puuid === puuid)
    if (!me) continue
    ownGames++
    if (me.win) ownWins++

    for (const other of match.participants) {
      if (other.puuid === puuid || other.teamId !== me.teamId) continue
      const draft = drafts.get(other.puuid) ?? {
        p: other,
        games: 0,
        wins: 0,
        roles: new Map(),
        myRoles: new Map(),
      }
      draft.p = other
      draft.games++
      if (other.win) draft.wins++
      if (other.position) count(draft.roles, other.position)
      if (me.position) count(draft.myRoles, me.position)
      drafts.set(other.puuid, draft)
    }
  }

  return [...drafts.values()]
    .filter((draft) => draft.games >= minimum)
    .map((draft) => {
      const role = most(draft.roles)
      const myRole = most(draft.myRoles)
      const winrate = (draft.wins / draft.games) * 100
      // Games without them, so "better together" is measured against something.
      const withoutGames = ownGames - draft.games
      const withoutWins = ownWins - draft.wins
      const soloWinrate = withoutGames ? (withoutWins / withoutGames) * 100 : 0
      return {
        puuid: draft.p.puuid,
        gameName: draft.p.gameName,
        tagLine: draft.p.tagLine,
        games: draft.games,
        wins: draft.wins,
        winrate,
        role,
        myRole,
        pairing: pairingFor(myRole, role),
        soloWinrate,
        lift: withoutGames ? winrate - soloWinrate : null,
      }
    })
    .sort((a, b) => b.games - a.games || b.winrate - a.winrate)
}
