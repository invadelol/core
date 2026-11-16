/**
 * Patch notes: the facts of Riot's notes for a patch (champion, item and ARAM: Mayhem changes,
 * new skins, bug fixes), kept as one data file per patch in `resources/patch_notes/<patch>.json`,
 * read by the server (`app/services/patch_notes_service.ts`) and drawn by `pages/patch.vue`.
 * Values are written as Riot writes them ("50 / 75 / 100 (+60% AP)"); the page marks the numbers
 * that changed and puts the stat icons in.
 */

/** Buff, nerf, both, or new. */
export type ChangeKind = 'up' | 'down' | 'mix' | 'new'

/** One line of a change: a value going from old to new, a new effect, a value set, a description. */
export type NoteLine =
  | {
      type?: undefined
      label: string
      old: string
      new: string
      /** When it differs from the champion's: a nerf line inside a buff. */
      dir?: ChangeKind
      /** Where a base stat with growth is weaker or stronger, by level or rank. */
      chips?: { range: string; value: string; way: 'weaker' | 'stronger' | 'unchanged' }[]
    }
  | { type: 'new'; text: string }
  | { type: 'desc'; text: string }
  | { type: 'set'; label: string; value: string }

export interface NoteBlock {
  /** P, Q, W, E, R, or `base` for base stats. */
  key: string
  title: string
  lines: NoteLine[]
}

export interface ChampionNote {
  id: number
  name: string
  kind: ChangeKind
  blocks: NoteBlock[]
}

export interface PatchNotes {
  /** As players name it: "26.22". */
  patch: string
  /** The game version the statistics key on: "16.22". */
  version: string
  /** When Riot published the notes (yyyy-mm-dd). */
  published: string
  /** Riot's article. */
  source: string
  champions: ChampionNote[]
  items: { id: number; name: string; kind: ChangeKind; lines: NoteLine[] }[]
  aram: {
    note?: string | null
    champions: { id: number; name: string; kind: ChangeKind; scope?: string; lines: NoteLine[] }[]
    augments: { id: number | null; name: string; kind: ChangeKind; lines: NoteLine[] }[]
  } | null
  skins: { champion: number; skin: number; name: string; champions: string }[]
  chromas: string[]
  bugs: string[]
}

/** How a champion did on the patch, in its main role (the site's own games). */
export interface PatchChampionStat {
  position: string
  win: number
  pick: number
  games: number
}

/* ── Drawing a value ─────────────────────────────────────────────── */

export type ValuePart =
  | { kind: 'text'; text: string }
  | { kind: 'num'; text: string; changed: boolean }
  | { kind: 'stat'; stat: 'ad' | 'ap' }

const NUM = /\d+(?:\.\d+)?%?/g
const TOKEN = /(\d+(?:\.\d+)?%?)|\bAD\b|\bAP\b/g

/** Which numbers of `next` are not in `before` (a longest common subsequence of the two). */
function changedNumbers(before: string, next: string): boolean[] {
  const a = before.match(NUM) ?? []
  const b = next.match(NUM) ?? []
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const changed = new Array<boolean>(b.length).fill(true)
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      changed[j] = false
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return changed
}

/**
 * A value cut into text, numbers (the ones that changed from `before` marked) and AD / AP, which
 * the page draws with the stat's icon as the game's tooltips do.
 */
export function valueParts(value: string, before?: string): ValuePart[] {
  const changed = before === undefined ? null : changedNumbers(before, value)
  const parts: ValuePart[] = []
  let last = 0
  let n = 0
  for (const m of value.matchAll(TOKEN)) {
    if (m.index! > last) parts.push({ kind: 'text', text: value.slice(last, m.index) })
    if (m[1]) parts.push({ kind: 'num', text: m[1], changed: changed ? changed[n++] : false })
    else parts.push({ kind: 'stat', stat: m[0] === 'AD' ? 'ad' : 'ap' })
    last = m.index! + m[0].length
  }
  if (last < value.length) parts.push({ kind: 'text', text: value.slice(last) })
  return parts
}

/** The stat icon of a line's label (a cooldown, health, armor…), as /cdn/stat names it. */
const LABEL_STATS: [RegExp, string][] = [
  [/\bCooldown\b/, 'haste'],
  [/\b(Health|Heal|Shield)\b/, 'hp'],
  [/\b(AR|Armor)\b/, 'armor'],
  [/\b(Attack Damage|AD)\b/, 'ad'],
  [/\bAS\b/, 'as'],
  [/\bMove Speed\b/, 'ms'],
  [/\bMagic Damage\b/, 'ap'],
]
export function labelStat(label: string): string | null {
  return LABEL_STATS.find(([re]) => re.test(label))?.[1] ?? null
}

/** "26.22" from a game version ("16.22"), and back. */
export const versionOf = (patch: string) => {
  const [major, minor] = patch.split('.').map(Number)
  return major >= 26 ? `${major - 10}.${minor}` : patch
}

/** The counts a patch's head sums up: buffs, nerfs, adjusted champions, items. */
export function noteCounts(notes: PatchNotes) {
  const by = (k: ChangeKind) => notes.champions.filter((c) => c.kind === k).length
  return { up: by('up'), down: by('down'), mix: by('mix'), items: notes.items.length }
}
