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
    /** The mode's system changes (a map back in the rotation). */
    systems?: NoteLine[]
  } | null
  skins: { champion: number; skin: number; name: string; champions: string }[]
  chromas: string[]
  bugs: string[]
}

/** A chroma as the page draws it: its own name ("Ruby") and the client's swatch colour, if known. */
export interface PatchChroma {
  name: string
  color: string | null
}

/** A new skin as the page shows it, with what the game's data says about it. */
export interface PatchSkin {
  champion: number
  skin: number
  name: string
  /** Every champion the entry is for: one, or a set released together (Ahri, Evelynn, Kai'Sa). */
  champions: number[]
  /** "Epic", "Legendary", "Mythic"…; null for a standard skin or when unknown. */
  rarity: string | null
  /** Its skin line ("K/DA"), when known. */
  line: string | null
  chromas: PatchChroma[]
}

/** New chromas for a skin that is not itself new this patch. */
export interface PatchChromaSet {
  skin: string
  champion: number | null
  chromas: PatchChroma[]
}

export interface PatchSkins {
  skins: PatchSkin[]
  chromas: PatchChromaSet[]
}

/** "Music Fan Gragas (FIRESTARTER)": the skin and its chromas' names. */
export function chromaSet(line: string): { skin: string; names: string[] } {
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(line.trim())
  if (!m) return { skin: line.trim(), names: [] }
  return {
    skin: m[1],
    names: m[2]
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  }
}

/** How a champion did on the patch, in its main role (the site's own games). */
export interface PatchChampionStat {
  position: string
  win: number
  pick: number
  games: number
  /** Tier (0 S+ … 5 D) and place in the role on the patch; null when not ranked. */
  tier: number | null
  rank: number | null
  /** The same on the patch before, in the same role; null when it was not ranked there. */
  prevTier: number | null
  prevRank: number | null
}

/** Win rate each day of the last two weeks (UTC), one line per changed champion, in its main role. */
export interface PatchDaily {
  days: string[]
  lines: Record<number, (number | null)[]>
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

type Run = { ratio: boolean; parts: ValuePart[] }
const runText = (r: Run) =>
  r.parts.map((p) => (p.kind === 'stat' ? p.stat.toUpperCase() : p.text)).join('')

/**
 * The same parts in runs: each bracketed ratio ("(+110% AD)") is one run the page can keep on
 * one line, so a value breaks between its ratios rather than inside one. When both sides have the
 * same runs, each ratio is compared with its own old self ("(+90% AP)" to "(+100% AP)" changed,
 * even though the old AD ratio was 100%).
 */
export function valueRuns(value: string, before?: string): Run[] {
  const runs = splitRuns(valueParts(value, before))
  if (before === undefined) return runs
  const old = splitRuns(valueParts(before))
  if (old.length !== runs.length || old.some((r, i) => r.ratio !== runs[i].ratio)) return runs
  return runs.map((r, i) => {
    const changed = changedNumbers(runText(old[i]), runText(r))
    let n = 0
    return {
      ratio: r.ratio,
      parts: r.parts.map((p) => (p.kind === 'num' ? { ...p, changed: changed[n++] ?? false } : p)),
    }
  })
}

function splitRuns(parts: ValuePart[]): Run[] {
  const runs: Run[] = []
  let open: Run | null = null
  const push = (part: ValuePart) => {
    if (!open) runs.push((open = { ratio: false, parts: [] }))
    open.parts.push(part)
  }
  for (const part of parts) {
    if (part.kind !== 'text') {
      push(part)
      continue
    }
    for (const piece of part.text.split(/(?=\()|(?<=\))/)) {
      if (!piece) continue
      if (piece.startsWith('(')) runs.push((open = { ratio: true, parts: [] }))
      push({ kind: 'text', text: piece })
      if (piece.endsWith(')') && open?.ratio) open = null
    }
  }
  return runs
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

/** A value given per rank ("12 / 11 / 10 / 9 / 8s (+60% AP)"): the ranks, their unit, the rest. */
const RANKS = /^(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)+)(%|s| seconds)?(.*)$/

/**
 * The table Riot draws for a value per rank: both values as lists of the same length (two or
 * more ranks), the unit they share ("s", "%"), and what follows the list on each side ("(+60%
 * AP)"). Null when the change is not a list on both sides.
 */
export function rankTable(before: string, after: string) {
  const a = RANKS.exec(before.trim())
  const b = RANKS.exec(after.trim())
  if (!a || !b) return null
  const old = a[1].split('/').map((x) => x.trim())
  const next = b[1].split('/').map((x) => x.trim())
  if (old.length !== next.length || (a[2] ?? '') !== (b[2] ?? '')) return null
  const unit = (b[2] ?? '').trim() === 'seconds' ? 's' : (b[2] ?? '').trim()
  return { old, new: next, unit, restOld: a[3].trim(), restNew: b[3].trim() }
}

/* ── The patch's biggest buff ────────────────────────────────── */

/** A change's size: each number's relative move, at most 1 (a doubled value), averaged. */
function lineSize(line: NoteLine): number {
  if (line.type === 'new') return 0.3
  if (line.type === 'set') return 0.15
  if (line.type === 'desc') return 0.05
  const before = (line.old.match(NUM) ?? []).map(parseFloat)
  const after = (line.new.match(NUM) ?? []).map(parseFloat)
  if (!before.length || !after.length) return 0.1
  const moved = (x: number, y: number) => (x > 0 ? Math.min(1, Math.abs(y - x) / x) : 0)
  if (before.length === after.length) {
    const sizes = before.map((x, i) => moved(x, after[i]))
    return sizes.reduce((a, b) => a + b, 0) / sizes.length
  }
  // One value become a list (or the reverse): their averages.
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
  return moved(mean(before), mean(after))
}

/**
 * The champion the notes buffed the most: of the champions marked as buffed, the one whose
 * numbers moved the most (each line's average relative change, summed over its lines; a nerf
 * line inside the buff counts against it). Null when the patch buffed no champion.
 */
export function biggestBuff(
  notes: Pick<PatchNotes, 'champions'>
): { id: number; name: string } | null {
  let best: { id: number; name: string; size: number } | null = null
  for (const c of notes.champions) {
    if (c.kind !== 'up') continue
    let size = 0
    for (const block of c.blocks)
      for (const line of block.lines)
        size += ('dir' in line && line.dir === 'down' ? -1 : 1) * lineSize(line)
    if (!best || size > best.size) best = { id: c.id, name: c.name, size }
  }
  return best && { id: best.id, name: best.name }
}
