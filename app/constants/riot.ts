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
 * Riot's queues.json does not list League Classic yet (checked 2026-10-14). The ids below come
 * from the client's own queue list (patch 16.20), where League Classic is the "Jade" group:
 * PvP 4300-4311, co-op vs AI 4320-4321, customs 3260-3262. Brawl is 2300-2305. The desktop app
 * keeps the same ranges (`lcu::RESTRICTED_QUEUES`). Every read and write below goes through this list.
 */
const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
export const EXCLUDED_QUEUE_IDS: readonly number[] = [
  ...range(2300, 2305),
  ...range(3260, 3262),
  ...range(4300, 4321),
]

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

/**
 * Every platform as players say it, in the order server filters list them. `slug` is the
 * lowercase label, as in `?server=kr`.
 */
export const SERVERS = [
  { platform: 'EUW1', label: 'EUW' },
  { platform: 'EUN1', label: 'EUNE' },
  { platform: 'NA1', label: 'NA' },
  { platform: 'BR1', label: 'BR' },
  { platform: 'LA1', label: 'LAN' },
  { platform: 'LA2', label: 'LAS' },
  { platform: 'KR', label: 'KR' },
  { platform: 'JP1', label: 'JP' },
  { platform: 'OC1', label: 'OCE' },
  { platform: 'TR1', label: 'TR' },
  { platform: 'VN2', label: 'VN' },
  { platform: 'TW2', label: 'TW' },
  { platform: 'SG2', label: 'SEA' },
  { platform: 'ME1', label: 'ME' },
  { platform: 'RU', label: 'RU' },
].map((s) => ({ ...s, slug: s.label.toLowerCase() }))

/** A platform as players say it: `EUN1` reads "EUNE". */
export function serverLabel(platform: string) {
  return SERVERS.find((s) => s.platform === platform)?.label ?? platform
}

/**
 * Labels in reading order: "EUW, NA and BR". Past four, the count stands in for the list
 * ("12 servers").
 */
export function serverList(platforms: string[]) {
  const labels = SERVERS.filter((s) => platforms.includes(s.platform)).map((s) => s.label)
  if (!labels.length) return 'every server'
  if (labels.length > 4) return `${labels.length} servers`
  return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}` : labels[0]
}
