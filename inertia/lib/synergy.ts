import { POSITION_NAMES, POSITION_ORDER } from './assets.js'
import { killParticipation, matchMinutes, teamTotals } from './match.js'
import type { Match, Participant } from './types.js'

/**
 * Who someone actually plays with, worked out from their own match sample.
 *
 * The `/friends` endpoint counts games together but knows nothing about
 * lanes, and a duo is only interesting once you know which duo it was: a bot
 * lane, a mid and jungle, two solo laners who happened to queue. Every match
 * already carries all ten participants and their positions, so the pairing
 * comes out of data the page has already downloaded.
 */

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
  profileIconId: number
  games: number
  wins: number
  winrate: number
  /** Their most common role beside this player. */
  role: string
  roleLabel: string
  /** The player's own most common role in those games. */
  myRole: string
  /** The named lane partnership, when there is one. */
  pairing: { id: string; label: string } | null
  /** Champions they played in those games, most used first. */
  champions: number[]
  /** Win rate across every game where this teammate was absent. */
  soloWinrate: number
  /** How much better or worse this player does with them, in points.
   *  Null when they were in every game, leaving nothing to compare against. */
  lift: number | null
}

function mode(counts: Map<string, number>) {
  let best = ''
  let most = 0
  for (const [key, value] of counts) {
    if (value > most) {
      most = value
      best = key
    }
  }
  return best
}

export function teammatesFrom(matches: Match[], puuid: string, minimum = 2): Mate[] {
  interface Draft {
    p: Participant
    games: number
    wins: number
    roles: Map<string, number>
    myRoles: Map<string, number>
    champions: Map<number, number>
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
        champions: new Map(),
      }
      draft.p = other
      draft.games++
      if (other.win) draft.wins++
      if (other.position)
        draft.roles.set(other.position, (draft.roles.get(other.position) ?? 0) + 1)
      if (me.position) draft.myRoles.set(me.position, (draft.myRoles.get(me.position) ?? 0) + 1)
      draft.champions.set(other.championId, (draft.champions.get(other.championId) ?? 0) + 1)
      drafts.set(other.puuid, draft)
    }
  }

  return [...drafts.values()]
    .filter((draft) => draft.games >= minimum)
    .map((draft) => {
      const role = mode(draft.roles)
      const myRole = mode(draft.myRoles)
      const winrate = (draft.wins / draft.games) * 100
      // Games without them, so "better together" is measured against something.
      const withoutGames = ownGames - draft.games
      const withoutWins = ownWins - draft.wins
      const soloWinrate = withoutGames ? (withoutWins / withoutGames) * 100 : 0
      return {
        puuid: draft.p.puuid,
        gameName: draft.p.gameName,
        tagLine: draft.p.tagLine,
        profileIconId: 0,
        games: draft.games,
        wins: draft.wins,
        winrate,
        role,
        roleLabel: POSITION_NAMES[role] ?? '',
        myRole,
        pairing: pairingFor(myRole, role),
        champions: [...draft.champions.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([id]) => id),
        soloWinrate,
        lift: withoutGames ? winrate - soloWinrate : null,
      }
    })
    .sort((a, b) => b.games - a.games || b.winrate - a.winrate)
}

export function sortRoles(roles: string[]) {
  return [...roles].sort((a, b) => POSITION_ORDER.indexOf(a) - POSITION_ORDER.indexOf(b))
}

/* ── The duo, in detail ─────────────────────────────────────────
   A single percentage says two people win together; it does not say
   which lane they sat in, which champions they kept picking, or
   whether the player is actually playing differently beside them.
   All of that is already in the same sample, one level down.
   ─────────────────────────────────────────────────────────────── */

function bump<K>(counts: Map<K, number>, key: K) {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

/** Two champions picked on the same side, and how it went. */
export interface ChampionDuo {
  mine: number
  theirs: number
  games: number
  wins: number
}

function duoList(duos: Map<string, ChampionDuo>) {
  return [...duos.values()].sort((a, b) => b.games - a.games || b.wins - a.wins)
}

function countDuo(duos: Map<string, ChampionDuo>, mine: number, theirs: number, win: boolean) {
  const key = `${mine}:${theirs}`
  const duo = duos.get(key) ?? { mine, theirs, games: 0, wins: 0 }
  duo.games++
  if (win) duo.wins++
  duos.set(key, duo)
}

export interface Partnership {
  id: string
  label: string
  /** The seat each side took, most common first. */
  myRole: string
  theirRole: string
  /** Games where this pairing actually held, not games with these people. */
  games: number
  wins: number
  mates: Mate[]
  duos: ChampionDuo[]
}

/**
 * Lane partnerships counted game by game rather than from each teammate's
 * usual role, so the sample size is the number of games the two really did
 * sit in those two seats.
 */
export function partnershipsFrom(matches: Match[], puuid: string, mates: Mate[]): Partnership[] {
  const wanted = new Map(mates.map((mate) => [mate.puuid, mate]))
  interface Draft {
    id: string
    label: string
    games: number
    wins: number
    myRoles: Map<string, number>
    theirRoles: Map<string, number>
    mates: Map<string, Mate>
    duos: Map<string, ChampionDuo>
  }
  const drafts = new Map<string, Draft>()

  for (const match of matches) {
    const me = match.participants.find((x) => x.puuid === puuid)
    if (!me?.position) continue
    for (const other of match.participants) {
      if (other.puuid === puuid || other.teamId !== me.teamId) continue
      const mate = wanted.get(other.puuid)
      if (!mate) continue
      const pair = pairingFor(me.position, other.position)
      if (!pair) continue
      const draft = drafts.get(pair.id) ?? {
        id: pair.id,
        label: pair.label,
        games: 0,
        wins: 0,
        myRoles: new Map(),
        theirRoles: new Map(),
        mates: new Map(),
        duos: new Map(),
      }
      draft.games++
      if (me.win) draft.wins++
      bump(draft.myRoles, me.position)
      bump(draft.theirRoles, other.position)
      draft.mates.set(mate.puuid, mate)
      countDuo(draft.duos, me.championId, other.championId, me.win)
      drafts.set(pair.id, draft)
    }
  }

  return [...drafts.values()]
    .map((draft) => ({
      id: draft.id,
      label: draft.label,
      myRole: mode(draft.myRoles),
      theirRole: mode(draft.theirRoles),
      games: draft.games,
      wins: draft.wins,
      mates: [...draft.mates.values()].sort((a, b) => b.games - a.games),
      duos: duoList(draft.duos),
    }))
    .sort((a, b) => b.games - a.games)
}

/** One game the two were on the same side of, seen from this player's chair. */
export interface DuoGame {
  matchId: string
  gameStartMs: number
  duration: number
  queueId: number
  win: boolean
  myChampion: number
  myRole: string
  theirChampion: number
  theirRole: string
  kills: number
  deaths: number
  assists: number
}

/** The seats the two took, and how often. */
export interface RolePairing {
  myRole: string
  theirRole: string
  label: string
  games: number
  wins: number
}

/** One of this player's own averages, beside them and away from them. */
export interface DuoSplit {
  key: 'kda' | 'kp' | 'cs' | 'gold' | 'vision'
  label: string
  together: number
  /** Null when there is no game without them to compare against. */
  apart: number | null
}

export interface Duo {
  games: DuoGame[]
  apartGames: number
  roles: RolePairing[]
  duos: ChampionDuo[]
  splits: DuoSplit[]
}

interface Form {
  games: number
  kills: number
  deaths: number
  assists: number
  kp: number
  cs: number
  gold: number
  vision: number
  minutes: number
}

function emptyForm(): Form {
  return { games: 0, kills: 0, deaths: 0, assists: 0, kp: 0, cs: 0, gold: 0, vision: 0, minutes: 0 }
}

function addGame(form: Form, match: Match, me: Participant) {
  const totals = teamTotals(match)
  form.games++
  form.kills += me.kills || 0
  form.deaths += me.deaths || 0
  form.assists += me.assists || 0
  form.kp += killParticipation(me, totals)
  form.cs += me.cs || 0
  form.gold += me.goldEarned || 0
  form.vision += me.visionScore || 0
  form.minutes += matchMinutes(match)
}

function readForm(form: Form) {
  const minutes = Math.max(form.minutes, 1)
  return {
    kda: (form.kills + form.assists) / Math.max(1, form.deaths),
    kp: form.games ? form.kp / form.games : 0,
    cs: form.cs / minutes,
    gold: form.gold / minutes,
    vision: form.vision / minutes,
  }
}

const SPLIT_LABELS: Array<[DuoSplit['key'], string]> = [
  ['kda', 'KDA'],
  ['kp', 'Kill share'],
  ['cs', 'CS / min'],
  ['gold', 'Gold / min'],
  ['vision', 'Vision / min'],
]

/**
 * Everything the sample knows about one teammate: the games themselves, the
 * seats the two took, the champions they kept pairing, and how this player's
 * own numbers move between games beside them and games without them.
 */
export function duoFrom(matches: Match[], puuid: string, matePuuid: string): Duo {
  const games: DuoGame[] = []
  const roles = new Map<string, RolePairing>()
  const duos = new Map<string, ChampionDuo>()
  const together = emptyForm()
  const apart = emptyForm()

  for (const match of matches) {
    const me = match.participants.find((x) => x.puuid === puuid)
    if (!me) continue
    const them = match.participants.find(
      (x) => x.puuid === matePuuid && x.teamId === me.teamId && x.puuid !== puuid
    )
    if (!them) {
      addGame(apart, match, me)
      continue
    }

    addGame(together, match, me)
    games.push({
      matchId: match.matchId,
      // The API sends the timestamp as a string; every consumer wants a number.
      gameStartMs: Number(match.gameStartMs),
      duration: match.duration,
      queueId: match.queueId,
      win: Boolean(me.win),
      myChampion: me.championId,
      myRole: me.position,
      theirChampion: them.championId,
      theirRole: them.position,
      kills: me.kills || 0,
      deaths: me.deaths || 0,
      assists: me.assists || 0,
    })

    countDuo(duos, me.championId, them.championId, Boolean(me.win))

    // Modes without lanes leave both positions empty; there is no seat to name.
    // The two seats are named in order, this player first, because the same
    // partnership read from either side is two different games to play.
    if (me.position && them.position) {
      const key = `${me.position}:${them.position}`
      const entry = roles.get(key) ?? {
        myRole: me.position,
        theirRole: them.position,
        label: `${POSITION_NAMES[me.position] ?? me.position} + ${POSITION_NAMES[them.position] ?? them.position}`,
        games: 0,
        wins: 0,
      }
      entry.games++
      if (me.win) entry.wins++
      roles.set(key, entry)
    }
  }

  const here = readForm(together)
  const elsewhere = readForm(apart)

  return {
    games: games.sort((a, b) => b.gameStartMs - a.gameStartMs),
    apartGames: apart.games,
    roles: [...roles.values()].sort((a, b) => b.games - a.games || b.wins - a.wins),
    duos: duoList(duos),
    splits: SPLIT_LABELS.map(([key, label]) => ({
      key,
      label,
      together: here[key],
      apart: apart.games ? elsewhere[key] : null,
    })),
  }
}
