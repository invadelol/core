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
 * Queues whose games are never stored nor shown, whatever their source (match-v5 or the
 * desktop app). Riot's developer policies: Brawl (2300) data is not approved for third-party
 * products, and League Classic data must not be shown in any form (since 2026-07-28).
 *
 * League Classic has no queue id in Riot's queues.json yet (checked 2026-10-14): add it here
 * as soon as Riot publishes it. Every read and write below goes through this list.
 */
export const EXCLUDED_QUEUE_IDS: readonly number[] = [2300]

/** Whether a game of this queue must never be stored nor shown. */
export function isExcludedQueue(queueId: unknown) {
  return EXCLUDED_QUEUE_IDS.includes(Number(queueId))
}

/** The ClickHouse condition that keeps excluded queues out of a read of `matches` or `participants`. */
export const VISIBLE_QUEUES_SQL = EXCLUDED_QUEUE_IDS.length
  ? `queue_id NOT IN (${EXCLUDED_QUEUE_IDS.map((id) => Math.trunc(id)).join(',')})`
  : '1=1'

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
