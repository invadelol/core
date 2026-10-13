import { positionOf, type Position } from '@invadelol/ui/logic'
import { assignPositions, POSITION_ORDER } from '#services/live/positions'

/** Stored games read per player: the champion record and the lanes come from these. */
export const LOBBY_HISTORY_GAMES = 100
/** The newest of those, for the player's recent form. */
export const RECENT_FORM_GAMES = 20

/** A participant as Riot's spectator-v5 sends it (only the fields read here). */
export interface SpectatorParticipant {
  puuid?: string | null
  riotId?: string
  championId: number
  teamId: number
  spell1Id: number
  spell2Id: number
  bot?: boolean
  perks?: { perkIds: number[]; perkStyle: number; perkSubStyle: number }
}

/** A game as Riot's spectator-v5 sends it (only the fields read here). */
export interface SpectatorGame {
  gameId: number
  gameStartTime: number
  gameLength: number
  gameQueueConfigId: number
  mapId?: number
  gameMode?: string
  bannedChampions?: Array<{ championId: number; teamId: number; pickTurn?: number }>
  participants: SpectatorParticipant[]
}

export interface LobbyRank {
  puuid: string
  tier: string | null
  division: string | null
  leaguePoints: number | null
  wins: number | null
  losses: number | null
}

export interface LobbyGame {
  puuid: string
  championId: number
  /** Riot's `teamPosition` ("UTILITY"…), empty outside Summoner's Rift. */
  position: string
  win: boolean
}

export interface LiveParticipant {
  puuid?: string | null
  riotId?: string
  championId: number
  teamId: number
  spell1Id: number
  spell2Id: number
  bot: boolean
  perks?: SpectatorParticipant['perks']
  /** Games and win rate on this champion in the player's last stored games. */
  championStats: { games: number; winrate: number } | null
  /** Their newest stored games: how they are doing lately. */
  recent: { games: number; wins: number } | null
  rank: {
    tier: string
    division: string
    leaguePoints: number
    wins: number | null
    losses: number | null
  } | null
  /** The inferred lane; null in a mode without lanes. */
  position: Position | null
  /** How sure that lane is, 0 to 1. */
  positionConfidence: number | null
}

export interface LiveGame {
  gameId: number
  gameStartTime: number
  gameLength: number
  gameQueueConfigId: number
  mapId: number | null
  gameMode: string | null
  bannedChampions: Array<{ championId: number; teamId: number }>
  /** Team by team as Riot lists them, each seated Top, Jungle, Mid, Bot, Support. */
  participants: LiveParticipant[]
}

/** Riot's puuids; anything else (a bot's empty id) is never looked up. */
export const isPuuid = (id: unknown): id is string =>
  typeof id === 'string' && /^[a-zA-Z0-9_-]{78}$/.test(id)

const emptyCounts = () => POSITION_ORDER.map(() => 0)

/** What one player's stored games say, from their newest games first. */
function playerContext(games: LobbyGame[], championId: number) {
  if (!games.length)
    return {
      championStats: null,
      recent: null,
      history: null,
      championHistory: null,
    }
  const history = emptyCounts()
  const championHistory = emptyCounts()
  let championGames = 0
  let championWins = 0
  for (const game of games) {
    const lane = POSITION_ORDER.indexOf(positionOf(game.position) as Position)
    const onChampion = game.championId === championId
    if (onChampion) {
      championGames++
      if (game.win) championWins++
    }
    if (lane < 0) continue
    history[lane]++
    if (onChampion) championHistory[lane]++
  }
  const recent = games.slice(0, RECENT_FORM_GAMES)
  return {
    championStats: championGames
      ? { games: championGames, winrate: Math.round((championWins / championGames) * 1e4) / 1e4 }
      : null,
    recent: { games: recent.length, wins: recent.filter((game) => game.win).length },
    history: history.some(Boolean) ? history : null,
    championHistory: championHistory.some(Boolean) ? championHistory : null,
  }
}

/**
 * The live game as the profile shows it: each player with their rank and stored-game context, and
 * each team of five seated in lane order. No observer credentials or other Riot fields pass.
 */
export function buildLiveGame(
  data: SpectatorGame,
  ranks: readonly LobbyRank[],
  games: readonly LobbyGame[]
): LiveGame {
  const byPlayer = new Map<string, LobbyGame[]>()
  for (const game of games) {
    const list = byPlayer.get(game.puuid)
    if (list) list.push(game)
    else byPlayer.set(game.puuid, [game])
  }

  const players = data.participants.map((p) => {
    const tracked = isPuuid(p.puuid)
    const rank = tracked ? ranks.find((r) => r.puuid === p.puuid) : undefined
    const context = playerContext((tracked && byPlayer.get(p.puuid!)) || [], p.championId)
    return {
      evidence: {
        championId: p.championId,
        spell1Id: p.spell1Id,
        spell2Id: p.spell2Id,
        history: context.history,
        championHistory: context.championHistory,
      },
      participant: {
        puuid: p.puuid,
        riotId: p.riotId,
        championId: p.championId,
        teamId: p.teamId,
        spell1Id: p.spell1Id,
        spell2Id: p.spell2Id,
        bot: Boolean(p.bot),
        perks: p.perks,
        championStats: context.championStats,
        recent: context.recent,
        rank:
          rank?.tier && rank.division
            ? {
                tier: rank.tier,
                division: rank.division,
                leaguePoints: rank.leaguePoints ?? 0,
                wins: rank.wins,
                losses: rank.losses,
              }
            : null,
        position: null,
        positionConfidence: null,
      } as LiveParticipant,
    }
  })

  // Lanes exist on Summoner's Rift only (map 11; a game without a map id is read as one).
  const laned = (data.mapId ?? 11) === 11
  const teams = [...new Set(players.map((p) => p.participant.teamId))]
  const participants = teams.flatMap((teamId) => {
    const team = players.filter((p) => p.participant.teamId === teamId)
    const seats = laned ? assignPositions(team.map((p) => p.evidence)) : null
    if (!seats) return team.map((p) => p.participant)
    return team
      .map((p, i) => ({
        ...p.participant,
        position: seats[i].position,
        positionConfidence: seats[i].confidence,
      }))
      .sort((a, b) => POSITION_ORDER.indexOf(a.position!) - POSITION_ORDER.indexOf(b.position!))
  })

  return {
    gameId: data.gameId,
    gameStartTime: data.gameStartTime,
    gameLength: data.gameLength,
    gameQueueConfigId: data.gameQueueConfigId,
    mapId: data.mapId ?? null,
    gameMode: data.gameMode ?? null,
    bannedChampions: (data.bannedChampions ?? []).map((ban) => ({
      championId: ban.championId,
      teamId: ban.teamId,
    })),
    participants,
  }
}
