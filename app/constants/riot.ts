/**
 * Riot API Queue IDs
 * @see https://static.developer.riotgames.com/docs/lol/queues.json
 */
export const QUEUE_IDS = {
  ranked: [420],
  flex: [440],
  aram: [450],
  normal: [400, 430],
} as const

export type RiotQueueType = keyof typeof QUEUE_IDS | 'all'

/**
 * Team positions in Summoner's Rift
 */
export const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'] as const

export type RiotRole = (typeof ROLES)[number] | 'all'

/**
 * Platform IDs grouped by region
 */
export const PLATFORMS = {
  americas: ['NA1', 'BR1', 'LA1', 'LA2'],
  europe: ['EUW1', 'EUN1', 'TR1', 'RU', 'ME1'],
  asia: ['KR', 'JP1'],
  sea: ['OC1', 'SG2', 'TW2', 'VN2'],
} as const
