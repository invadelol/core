import env from '#start/env'
import Summoner from '#models/summoner'
import statsRepository from '#services/analytics/stats_repository'
import { CHAMPION_POSITIONS } from '#services/live/champion_positions'
import { POSITION_ORDER } from '#services/live/positions'
import type { SpectatorGame, SpectatorParticipant } from '#services/live/live_game'

/**
 * A live game for the fictional demo accounts (puuids starting with `demo`), so the Live tab can be
 * seen and checked locally without Riot. Off unless DEMO_LIVE is set, and never in production. The
 * ten players are other demo accounts of the same region; each team is listed in a shuffled order,
 * as Riot lists it, so the lane inference does its real work.
 */
export const DEMO_PUUID_PREFIX = 'demo'

export function demoLiveEnabled(puuid: string) {
  return (
    env.get('NODE_ENV') !== 'production' &&
    env.get('DEMO_LIVE') === true &&
    puuid.startsWith(DEMO_PUUID_PREFIX)
  )
}

/** Champions per lane (Top, Jungle, Mid, Bot, Support), with their usual spells and runes. */
const LANES = [
  {
    champions: [266, 122, 92, 516, 897, 58, 86],
    spells: [4, 12],
    perks: {
      perkIds: [8010, 9111, 9105, 8299, 8444, 8242, 5005, 5008, 5001],
      style: 8000,
      sub: 8400,
    },
  },
  {
    champions: [64, 104, 234, 121, 254, 59, 141],
    spells: [11, 4],
    perks: {
      perkIds: [8010, 9111, 9104, 8299, 8143, 8135, 5005, 5008, 5001],
      style: 8000,
      sub: 8100,
    },
  },
  {
    champions: [103, 61, 238, 134, 268, 1, 711],
    spells: [4, 14],
    perks: {
      perkIds: [8112, 8139, 8138, 8105, 8226, 8210, 5008, 5008, 5001],
      style: 8100,
      sub: 8200,
    },
  },
  {
    champions: [222, 202, 145, 51, 81, 236, 498],
    spells: [7, 4],
    perks: {
      perkIds: [8008, 9111, 9104, 8017, 8345, 8347, 5005, 5008, 5001],
      style: 8000,
      sub: 8300,
    },
  },
  {
    champions: [412, 89, 111, 117, 267, 497, 201],
    spells: [4, 14],
    perks: {
      perkIds: [8465, 8463, 8473, 8242, 8345, 8347, 5008, 5001, 5001],
      style: 8400,
      sub: 8300,
    },
  },
]
const BANS = [157, 777, 555, 875, 893, 910, 950, 800, 799, 901, 245, 517, 131, 84]

/** A small seeded generator (mulberry32), so a player's demo game stays the same between polls. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(list: T[], next: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const hash = (text: string) =>
  [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)

/** The demo game of a demo account, or null when demo games are off for it. */
export async function demoLiveGame(
  player: Summoner,
  now = Date.now()
): Promise<SpectatorGame | null> {
  if (!demoLiveEnabled(player.puuid)) return null
  const next = random(hash(player.puuid))
  const others = await Summoner.query()
    .whereLike('puuid', `${DEMO_PUUID_PREFIX}%`)
    .where('platform', player.platform)
    .whereNot('puuid', player.puuid)
    .orderBy('puuid')
    .limit(60)
  const mates = shuffle(others, next).slice(0, 9)
  if (mates.length < 9) return null

  // The viewed player takes a seeded lane on the blue side; everyone else fills in around them.
  const ownLane = Math.floor(next() * POSITION_ORDER.length)
  const lobby = [...mates]
  lobby.splice(ownLane, 0, player)
  // Each player picks, for their lane, the champion they have played most in their stored games
  // (so their record on it shows), else one of the lane's usual picks.
  const played = new Map<string, Map<number, number>>()
  for (const game of await statsRepository
    .getRecentGames(
      lobby.map((summoner) => summoner.puuid),
      100
    )
    .catch(() => [])) {
    const counts = played.get(game.puuid) ?? new Map<number, number>()
    counts.set(game.championId, (counts.get(game.championId) ?? 0) + 1)
    played.set(game.puuid, counts)
  }
  const picked = new Set<number>(BANS)
  const participants: SpectatorParticipant[] = lobby.map((summoner, i) => {
    const teamId = i < 5 ? 100 : 200
    const lane = LANES[i % 5]
    const favourite = [...(played.get(summoner.puuid) ?? [])]
      .filter(([id]) => !picked.has(id) && (CHAMPION_POSITIONS[id]?.[i % 5] ?? 0) >= 70)
      .sort((a, b) => b[1] - a[1])[0]?.[0]
    const pool = lane.champions.filter((id) => !picked.has(id))
    const championId = favourite ?? pool[Math.floor(next() * pool.length)]
    picked.add(championId)
    return {
      puuid: summoner.puuid,
      riotId: summoner.gameName ? `${summoner.gameName}#${summoner.tagLine}` : undefined,
      championId,
      teamId,
      spell1Id: next() < 0.5 ? lane.spells[0] : lane.spells[1],
      spell2Id: 0,
      bot: false,
      perks: {
        perkIds: lane.perks.perkIds,
        perkStyle: lane.perks.style,
        perkSubStyle: lane.perks.sub,
      },
    }
  })
  for (const [i, p] of participants.entries()) {
    const spells = LANES[i % 5].spells
    p.spell2Id = p.spell1Id === spells[0] ? spells[1] : spells[0]
  }

  // Riot lists a team in no lane order: shuffle each team.
  const ordered = [
    ...shuffle(participants.slice(0, 5), next),
    ...shuffle(participants.slice(5), next),
  ]
  const bans = shuffle(BANS, next)
    .slice(0, 10)
    .map((championId, i) => ({ championId, teamId: i < 5 ? 100 : 200, pickTurn: (i % 5) + 1 }))
  // A game of 32 minutes on a loop, so the timer runs and resets.
  const length = 32 * 60_000
  const gameStartTime = now - ((now + Math.abs(hash(player.puuid))) % length) - 60_000

  return {
    gameId: Math.abs(hash(`${player.puuid}:game`)),
    gameStartTime,
    gameLength: Math.floor((now - gameStartTime) / 1000),
    gameQueueConfigId: 420,
    mapId: 11,
    gameMode: 'CLASSIC',
    bannedChampions: bans,
    participants: ordered,
  }
}
