/**
 * The desktop app's CHANGELOG.md (resources/changelog, synced from the app by
 * scripts/sync_changelog.mjs) as versions, sections and lines, read the way the app's "What's new"
 * page reads it, so both say the same thing. No Markdown renderer: the file only uses
 * `## version`, `### Section`, `- ` bullets and, inside a line, `**bold**`, `*emphasis*` and
 * `` `code` ``.
 *
 * A heading may carry the release date: `## 0.3.1 - 2026-10-15` (none while unreleased). A bullet
 * may end with markers, HTML comments GitHub does not show:
 * - `<!-- highlight -->`: one of the version's 2–3 headlines;
 * - `<!-- image presence.webp -->`: its screenshot, a file in `public/changelog/`.
 *
 * Highlights: the marked bullets, else the first three of New, then Changed / Improved. Each is
 * cut to its first sentence, or to its bold lead when that sentence is long.
 */

/** A run of text: plain, bold (`b`), emphasis (`i`) or code (`c`). */
export interface Run {
  s: string
  b?: true
  i?: true
  c?: true
}

export interface Line {
  runs: Run[]
  /** Marked `<!-- highlight -->`. */
  highlight?: true
  /** Marked `<!-- image name.webp -->`. */
  image?: string
}

export interface Section {
  /** As written: New, Changed, Improved, Fixed, Removed. */
  title: string
  lines: Line[]
}

export interface Release {
  version: string
  /** `YYYY-MM-DD`, when the heading has it. */
  date?: string
  sections: Section[]
  /** Up to three, one sentence each, plain text. */
  highlights: string[]
}

const MARKS = /\s*<!--\s*(.*?)\s*-->/g
/** Sections the highlights fall back to, in order. */
const LEADS = ['new', 'changed', 'improved']
const MAX = 3
/** Characters past which a highlight falls back to its bold lead. */
const LONG = 90
/** Abbreviations whose full stop does not end a sentence ("e.g. Flash"). */
const ABBREVIATIONS = /(?:^|[\s(])(?:e\.g|i\.e|etc|vs|approx|cf)\.$/i

const plain = (line: Run[]) => line.map((r) => r.s).join('')

/** A line's inline formatting as runs. A lone `*` (`3 * 4`) stays text. */
export function runs(text: string): Run[] {
  const out: Run[] = []
  const pattern = /\*\*(.+?)\*\*|`([^`]+)`|\*([^*\s][^*]*?)\*/g
  let at = 0
  for (const m of text.matchAll(pattern)) {
    if (m.index > at) out.push({ s: text.slice(at, m.index) })
    if (m[1] !== undefined) out.push({ s: m[1], b: true })
    else if (m[2] !== undefined) out.push({ s: m[2], c: true })
    else out.push({ s: m[3], i: true })
    at = m.index + m[0].length
  }
  if (at < text.length) out.push({ s: text.slice(at) })
  return out
}

/**
 * Where the text's first sentence ends (just after its `.`, `!`, `?`, or `:` when asked, and any
 * closing quote or bracket), at or after `from`; -1 when it never does. A stop must be followed by
 * a space or the end, so "0.3.1", "invade.lol" and "→" never end one; nor do "e.g." or "etc.".
 */
export function sentenceEnd(text: string, from = 0, colon = false): number {
  const stop = colon ? /[.!?:]["'”’)\]]?(?=\s|$)/g : /[.!?]["'”’)\]]?(?=\s|$)/g
  stop.lastIndex = from
  for (let m = stop.exec(text); m; m = stop.exec(text)) {
    if (m[0][0] === '.' && ABBREVIATIONS.test(text.slice(0, m.index + 1))) continue
    return m.index + m[0].length
  }
  return -1
}

/** `runs` between two offsets of their plain text, formatting kept. */
export function sliceRuns(line: Run[], from: number, to = Infinity): Run[] {
  const out: Run[] = []
  let at = 0
  for (const r of line) {
    const a = Math.max(from - at, 0)
    const b = Math.min(to - at, r.s.length)
    if (a < b) out.push({ ...r, s: r.s.slice(a, b) })
    at += r.s.length
  }
  return out
}

/** The line's first sentence, as plain text. */
export function firstSentence(line: Run[]): string {
  const text = plain(line)
  const end = sentenceEnd(text)
  return (end < 0 ? text : text.slice(0, end)).trim()
}

/** A line as a headline: its first sentence, or its bold lead when that sentence runs long. */
export function highlight(line: Run[]): string {
  const sentence = firstSentence(line)
  const lead = line[0]?.b ? line[0].s.trim().replace(/[:,;]$/, '') : ''
  return sentence.length > LONG && lead ? lead : sentence
}

/**
 * A line as a headline and the rest, for a marked line: its bold lead when that ends in a stop,
 * else the text up to the first full stop or colon, without it ("Summoner spells go in with the
 * runes"); the rest keeps its formatting. Null when no break comes early enough for a headline.
 */
export function headline(line: Run[]): { title: string; rest: Run[] } | null {
  const text = plain(line)
  // A bold lead that ends a sentence is the headline whole, colons inside it included ("ARAM: Mayhem").
  const bold = line[0]?.b ? line[0].s.trimEnd() : ''
  const end =
    /[.!?:]$/.test(bold) && bold.length <= LONG ? line[0].s.length : sentenceEnd(text, 0, true)
  if (end < 0 || end > LONG) return null
  const title = text.slice(0, end).replace(/[.:]$/, '').trim()
  const rest = sliceRuns(line, end)
  if (rest.length) {
    rest[0] = { ...rest[0], s: rest[0].s.trimStart() }
    // "Safer release builds: each window…" reads as two lines once the colon is gone.
    if (text[end - 1] === ':') {
      rest[0].s = rest[0].s.charAt(0).toLocaleUpperCase() + rest[0].s.slice(1)
    }
    if (!rest[0].s) rest.shift()
  }
  return { title, rest }
}

/** A bullet's text without its markers, and what they say. */
function marks(text: string): { text: string; highlight: boolean; image?: string } {
  let marked = false
  let image: string | undefined
  for (const m of text.matchAll(MARKS)) {
    const [word, arg] = m[1].split(/\s+/, 2)
    if (/^highlight$/i.test(word)) marked = true
    else if (/^image$/i.test(word) && arg) image = arg
  }
  return { text: text.replace(MARKS, ''), highlight: marked, image }
}

export function parseChangelog(md: string): Release[] {
  const releases: Release[] = []
  let release: Release | undefined
  let section: Section | undefined
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd()
    let m: RegExpExecArray | null
    if ((m = /^##\s+v?(\d+\.\d+\.\d+\S*)(?:\s+-\s+(\d{4}-\d{2}-\d{2}))?\s*$/.exec(line))) {
      release = { version: m[1], sections: [], highlights: [] }
      if (m[2]) release.date = m[2]
      section = undefined
      releases.push(release)
    } else if ((m = /^###\s+(.+)$/.exec(line)) && release) {
      section = { title: m[1].trim(), lines: [] }
      release.sections.push(section)
    } else if ((m = /^[-*]\s+(.+)$/.exec(line)) && section) {
      const k = marks(m[1])
      const entry: Line = { runs: runs(k.text.trimEnd()) }
      if (k.highlight) entry.highlight = true
      if (k.image) entry.image = k.image
      section.lines.push(entry)
    } else if (/^\s+\S/.test(raw) && section?.lines.length) {
      // A bullet wrapped onto the next line.
      const last = section.lines[section.lines.length - 1]
      const k = marks(line.trim())
      if (k.text.trim()) last.runs.push(...runs(` ${k.text.trim()}`))
      if (k.highlight) last.highlight = true
      if (k.image) last.image = k.image
    }
  }
  for (const r of releases) {
    r.sections = r.sections.filter((s) => s.lines.length)
    const all = r.sections.flatMap((s) => s.lines)
    const marked = all.filter((l) => l.highlight)
    const picked = marked.length
      ? marked
      : LEADS.flatMap((lead) => r.sections.find((s) => s.title.toLowerCase() === lead)?.lines ?? [])
    r.highlights = picked.slice(0, MAX).map((l) => highlight(l.runs))
  }
  return releases
}
