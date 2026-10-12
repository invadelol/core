/** A pill of the Objectives widget: a spawn, or a buff the holding team still has. */
export interface ObjTimer {
  key: 'dragon' | 'grubs' | 'herald' | 'baron' | 'baronBuff' | 'elderBuff'
  label: string
  /** Game time it spawns, or the buff ends. */
  at: number
  team?: 'ally' | 'enemy'
}

/** What the Next item widget reads. */
export interface NextItem {
  path: Array<{ id: number; owned: boolean }>
  next: { id: number; name: string; missing: number; affordable: boolean; options: number[] }
}

/** Your figures, as the Performance widget reads them. */
export interface PerfInput {
  csm: number
  cs: number
  gpm: number
  kp: number
  kda: number
  level: number
  /** The lane opponent, for the CS and level rows. */
  vs: { cs: number; level: number }
}
