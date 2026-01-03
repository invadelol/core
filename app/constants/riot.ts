/**
 * Riot API Queue IDs
 * @see https://static.developer.riotgames.com/docs/lol/queues.json
 */
export const QUEUE_IDS = {
  ranked: [420], // 5v5 Ranked Solo/Duo
  flex: [440], // 5v5 Ranked Flex
  aram: [450], // ARAM
  normal: [400, 430], // 5v5 Draft Pick, 5v5 Blind Pick
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
  europe: ['EUW1', 'EUN1', 'EUNE1', 'TR1', 'RU', 'ME1'],
  asia: ['KR', 'JP1'],
  sea: ['OC1', 'PH2', 'SG2', 'TH2', 'TW2', 'VN2'],
} as const
