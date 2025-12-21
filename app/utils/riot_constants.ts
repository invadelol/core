export const QUEUE_IDS = {
  ranked: [420],
  flex: [440],
  aram: [450],
  normal: [400, 430],
} as const

export type RiotQueueType = keyof typeof QUEUE_IDS | 'all'

export const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'] as const

export type RiotRole = (typeof ROLES)[number] | 'all'
