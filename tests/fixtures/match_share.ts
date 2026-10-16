import sharp from 'sharp'
import type { Match, Participant } from '../../inertia/lib/types.js'

/**
 * A stored Ranked Solo/Duo game as `getSummaryById` reads it, for the share card. Made-up Riot
 * IDs: the player of interest is `Moonfern#EUW`, on LeBlanc in the middle lane, on the winning
 * side. Every other player had an even game.
 */
const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']
export const SHARE_MATCH_ID = 'EUW1_7000000001'
export const SHARE_PLAYER = 2

export function shareParticipant(index: number, overrides: Partial<Participant> = {}) {
  const teamId = index < 5 ? 100 : 200
  return {
    puuid: `share-${index}`,
    gameName: index === SHARE_PLAYER ? 'Moonfern' : `Lantern Moth ${index}`,
    tagLine: 'EUW',
    championId: index === SHARE_PLAYER ? 7 : index + 10,
    teamId,
    win: teamId === 100,
    kills: 4,
    deaths: 4,
    assists: 6,
    cs: 180,
    level: 300,
    champLevel: 15,
    visionScore: 25,
    damageTaken: 20000,
    totalDamageDealtToChampions: 18000,
    physicalDamageDealtToChampions: 9000,
    magicDamageDealtToChampions: 8000,
    trueDamageDealtToChampions: 1000,
    damageDealtToObjectives: 6000,
    damageDealtToTurrets: 2000,
    goldEarned: 11000,
    position: ROLES[index % 5],
    items: [0, 0, 0, 0, 0, 0, 0],
    spells: [4, 14],
    perks: { primary: 8100, sub: 8200, keystone: 8112 },
    wardsPlaced: 10,
    wardsKilled: 2,
    visionWardsBoughtInGame: 2,
    ...overrides,
  } as Participant
}

export function shareMatch(
  overrides: Record<number, Partial<Participant>> = {},
  game: Partial<Match> = {}
): Match {
  return {
    matchId: SHARE_MATCH_ID,
    platform: 'EUW1',
    gameStartMs: 1_790_000_000_000,
    duration: 1938,
    queueId: 420,
    mapId: 11,
    patch: '16.20',
    t1Win: 1,
    t2Win: 0,
    t1Towers: 9,
    t2Towers: 2,
    t1Inhibs: 2,
    t2Inhibs: 0,
    t1Dragons: 3,
    t2Dragons: 1,
    t1Barons: 1,
    t2Barons: 0,
    t1Heralds: 1,
    t2Heralds: 0,
    t1Bans: [],
    t2Bans: [],
    participants: Array.from({ length: 10 }, (_, i) => shareParticipant(i, overrides[i])),
    ...game,
  } as Match
}

/** The player of interest at 18/1/11 with the game's most damage: a 90+ score and the MVP. */
export const PEAK: Record<number, Partial<Participant>> = {
  [SHARE_PLAYER]: {
    kills: 18,
    deaths: 1,
    assists: 11,
    cs: 290,
    goldEarned: 19000,
    totalDamageDealtToChampions: 52000,
    damageDealtToObjectives: 14000,
    visionScore: 30,
  },
}

/** The game lost by the player's side, the player at 3/7/4. */
export const LOSS: Record<number, Partial<Participant>> = Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => [
    i,
    i === SHARE_PLAYER ? { kills: 3, deaths: 7, assists: 4, win: false } : { win: i >= 5 },
  ])
)

/** Splash-like art (1280 by 720): smooth colour with some texture, as JPEG. */
export async function shareArt() {
  return sharp({
    create: {
      width: 1280,
      height: 720,
      channels: 3,
      background: '#5a2a3a',
      noise: { type: 'gaussian', mean: 110, sigma: 40 },
    },
  })
    .blur(2.5)
    .jpeg({ quality: 85 })
    .toBuffer()
}
