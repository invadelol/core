/** Generated from the real app captures (scratchpad export.py): natural size and exported widths. */
export interface ShotInfo {
  w: number
  h: number
  widths: number[]
  avif?: boolean
}
export const SHOTS = {
  'c-audio': { w: 2340, h: 528, widths: [800, 1600] },
  'c-dial': { w: 1468, h: 560, widths: [735, 1468] },
  'g-champions': { w: 1920, h: 1200, widths: [640, 1280] },
  'g-favorites': { w: 1920, h: 1200, widths: [640, 1280] },
  'g-languages': { w: 1920, h: 1200, widths: [640, 1280] },
  'g-live': { w: 1920, h: 1200, widths: [640, 1280] },
  'g-matchups': { w: 1920, h: 1200, widths: [640, 1280] },
  'g-search': { w: 1920, h: 1200, widths: [640, 1280] },
  'g-sync': { w: 1920, h: 1200, widths: [640, 1280] },
  'game': { w: 1920, h: 1080, widths: [960, 1920] },
  'home': { w: 2880, h: 1800, widths: [1280, 2560] },
  'live-draft': { w: 2880, h: 1800, widths: [1280, 2560] },
  'match': { w: 2880, h: 1800, widths: [1280, 2560] },
  'match-breakdown': { w: 2880, h: 1800, widths: [1280, 2560] },
  'match-gold': { w: 2880, h: 1800, widths: [1280, 2560] },
  'match-timeline': { w: 2880, h: 1800, widths: [1280, 2560] },
  'ov-build': { w: 536, h: 340, widths: [268, 536], avif: true },
  'ov-counters': { w: 576, h: 404, widths: [288, 576], avif: true },
  'ov-objectives': { w: 688, h: 220, widths: [344, 688], avif: true },
  'ov-odds': { w: 576, h: 472, widths: [288, 576], avif: true },
  'ov-perf': { w: 496, h: 458, widths: [248, 496], avif: true },
  'ov-runes': { w: 576, h: 546, widths: [288, 576], avif: true },
  'ov-tabgold': { w: 224, h: 1024, widths: [112, 224], avif: true },
  'recordings': { w: 2880, h: 1800, widths: [1280, 2560] },
} satisfies Record<string, ShotInfo>

export type ShotName = keyof typeof SHOTS
